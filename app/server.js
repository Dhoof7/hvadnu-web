const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = 'https://kqpxhefvnrlsuxmiqhhy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhoZWZ2bnJsc3V4bWlxaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzE4NjEsImV4cCI6MjA5MDgwNzg2MX0.-fw759yENbo2UZTdgzIU4TpjUqOON4ogtpEUYvE8fqA';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dhoof12349';

const fs = require('fs');
let SPONSORS = [];
try {
  SPONSORS = JSON.parse(fs.readFileSync(path.join(__dirname, 'sponsors.json'), 'utf8'));
} catch { SPONSORS = []; }

let PLACES = [];
try {
  PLACES = JSON.parse(fs.readFileSync(path.join(__dirname, 'places.json'), 'utf8'));
} catch { PLACES = []; }

function findSponsor(stepType, city) {
  if (!city) return null;
  const cityNorm = city.toLowerCase().trim();
  const typeNorm = stepType.toLowerCase();
  return SPONSORS.find(s =>
    s.active &&
    s.city === cityNorm &&
    s.categories.some(c => typeNorm.includes(c) || c.includes(typeNorm))
  ) || null;
}

function findPlace(stepType, city) {
  const sponsor = findSponsor(stepType, city);
  if (sponsor) {
    return {
      name: sponsor.name,
      rating: sponsor.rating,
      address: sponsor.address,
      url: sponsor.url,
      image: sponsor.image,
      phone: sponsor.phone,
      sponsored: true,
    };
  }
  return findLocalPlace(stepType, city);
}

function findLocalPlace(stepType, city) {
  if (!city) return null;
  const cityNorm = city.toLowerCase().trim();
  const typeNorm = stepType.toLowerCase().trim();
  const matches = PLACES.filter(p =>
    p.active &&
    p.city === cityNorm &&
    p.type.toLowerCase().includes(typeNorm) || typeNorm.includes(p.type.toLowerCase())
  );
  if (!matches.length) return null;
  const p = matches[Math.floor(Math.random() * matches.length)];
  return { name: p.name, address: p.address, url: p.url, image: p.image, phone: p.phone, description: p.description, sponsored: false };
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WHO_LABELS = {
  couple: 'a romantic couple on a date',
  friends: 'a group of friends hanging out',
  family: 'a family (possibly with kids)',
};
const BUDGET_LABELS = {
  low: 'very low budget, under 100kr per person (free activities preferred)',
  medium: 'medium budget, 100–300kr per person',
  high: 'generous budget, 300kr+ per person, quality over price',
};
const TIME_LABELS = {
  '1h': 'about 1 hour',
  '2-3h': '2 to 3 hours',
  'fullday': 'a full day, 6+ hours',
};

function buildPrompt(who, budget, time, setting, mood, city, lang = 'da') {
  const location = city ? `in ${city}, Denmark` : 'in their city';
  const langNote = lang === 'da' ? 'Reply in Danish.' : 'Reply in English.';
  return `Activity planner. ${langNote} Generate exactly 3 JSON plans for: ${WHO_LABELS[who] || who}, ${BUDGET_LABELS[budget] || budget}, ${TIME_LABELS[time] || time}, ${setting}, mood: ${mood}, ${location}. 3 distinct plans, each 2–4 steps. Return ONLY a raw JSON array:
[{"id":1,"title":"3-5 word title","tagline":"one sentence","emoji":"emoji","why":"2 sentences why this fits","priceLevel":"kr/kr kr/kr kr kr","totalTime":"X hours","totalCost":"X-Xkr per person","highlights":["h1","h2","h3"],"goodFor":["l1","l2"],"steps":[{"order":1,"name":"place name","type":"English type: Café/Restaurant/Bar/Museum/Park/Bowling/Cinema/Escape Room/Paintball/Karting/Outdoor Activity/Market/Swimming/etc","activity":"one sentence","duration":"X min","estimatedCost":"Xkr","tip":"one tip","mapSearch":"query"}]}]`;
}

async function streamPlans(res, prompt, city) {
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    const stream = getAnthropic().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    // Abort if AI takes more than 25 seconds
    const timeout = setTimeout(() => {
      stream.abort();
    }, 25000);

    let raw = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        raw += chunk.delta.text;
        send({ chunk: chunk.delta.text });
      }
    }
    clearTimeout(timeout);

    // Strip markdown fences if present
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    // Find the JSON array even if there's garbage around it
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);

    const plans = JSON.parse(raw);
    send({ status: 'enriching' });

    // Place lookup is synchronous (reads from memory) — no async needed
    plans.forEach(plan =>
      plan.steps.forEach(step => {
        step.yelpPlace = findPlace(step.type, city);
      })
    );

    send({ plans });
  } catch (err) {
    console.error('Error generating plans:', err);
    send({ error: 'Kunne ikke generere planer. Prøv igen.' });
  }
  res.end();
}

app.post('/api/recommend-free', async (req, res) => {
  const { description, lang, city: bodyCity } = req.body;
  if (!description) return res.status(400).json({ error: 'Missing description' });
  const langNote = lang === 'da' ? 'IMPORTANT: Write ALL content in Danish.' : 'Write all content in English.';

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

  const prompt = `Activity planner. ${langNote} User request: "${description}". Extract city, who, budget, time, vibe. Generate exactly 3 distinct JSON plans (2–4 steps each). Return ONLY raw JSON array:
[{"id":1,"title":"3-5 word title","tagline":"one sentence","emoji":"emoji","why":"2 sentences","priceLevel":"kr/kr kr/kr kr kr","totalTime":"X hours","totalCost":"X-Xkr","highlights":["h1","h2","h3"],"goodFor":["l1","l2"],"steps":[{"order":1,"name":"place","type":"English: Café/Restaurant/Bar/Museum/Park/Bowling/Cinema/Escape Room/etc","activity":"one sentence","duration":"X min","estimatedCost":"Xkr","tip":"one tip","mapSearch":"query"}]}]`;

  const cityMatch =
    description.match(/(?:^|\s)i\s+([A-ZÆØÅ][a-zæøå]+(?:\s[A-ZÆØÅ][a-zæøå]+)?)/) ||
    description.match(/\bin\s+([A-ZÆØÅ][a-zæøå]+(?:\s[A-ZÆØÅ][a-zæøå]+)?)\b/i) ||
    description.match(/\b([A-ZÆØÅ][a-zæøå]{3,}(?:\s[A-ZÆØÅ][a-zæøå]+)?)\b/);
  const city = bodyCity || (cityMatch ? cityMatch[1] : '');

  await streamPlans(res, prompt, city);
});

app.post('/api/recommend', async (req, res) => {
  const { who, budget, time, setting, mood, city, lang } = req.body;
  if (!who || !budget || !time || !setting || !mood) {
    return res.status(400).json({ error: 'Missing preferences' });
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  await streamPlans(res, buildPrompt(who, budget, time, setting, mood, city, lang), city);
});

app.get('/api/sponsors', (_req, res) => {
  res.json(SPONSORS.filter(s => s.active));
});

app.get('/api/cities', (_req, res) => {
  const labels = { aalborg: 'Aalborg', aarhus: 'Aarhus', copenhagen: 'København', odense: 'Odense' };
  const unique = [...new Set(PLACES.filter(p => p.active).map(p => p.city))].sort();
  res.json(unique.map(c => ({ value: c, label: labels[c] || c.charAt(0).toUpperCase() + c.slice(1) })));
});

app.get('/api/test', async (req, res) => {
  const results = { anthropic: false, errors: [] };
  try {
    await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
    });
    results.anthropic = true;
  } catch (e) {
    results.errors.push('Anthropic: ' + e.message);
  }
  res.json(results);
});

app.get('/api/admin/debug', (_req, res) => {
  res.json({
    supabaseUrlSet: !!process.env.SUPABASE_URL,
    supabaseServiceKeySet: !!process.env.SUPABASE_SERVICE_KEY,
    supabaseServiceKeyLength: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0,
  });
});

app.get('/api/admin/stats', async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET || 'dhoof12349';
  if (req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const [statsRes, plansRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_admin_stats`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
      fetch(`${SUPABASE_URL}/rest/v1/saved_plans?select=count`, {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          Prefer: 'count=exact',
          'Range-Unit': 'items',
          Range: '0-0',
        },
      }),
    ]);

    const stats = await statsRes.json();
    const totalPlans = parseInt(plansRes.headers.get('content-range')?.split('/')[1] || '0', 10);
    const recentUsers = (stats.recent_users || []).map(u => ({
      email: u.email,
      name: u.name || '—',
      city: u.city || null,
      provider: u.provider || 'email',
      created_at: u.created_at,
      confirmed: u.confirmed,
    }));

    res.json({ totalUsers: parseInt(stats.total_users || 0), totalPlans, recentUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/nearby', (req, res) => {
  const { city, query } = req.query;
  if (!city || !query) return res.json([]);

  const q = query.toLowerCase().trim();
  const cityNorm = city.toLowerCase().trim();

  const matchScore = (p) => {
    let score = 0;
    if (p.type.toLowerCase().includes(q)) score += 3;
    if (p.name.toLowerCase().includes(q)) score += 2;
    if ((p.description || '').toLowerCase().includes(q)) score += 1;
    return score;
  };

  // Sponsors first (paid placements)
  const sponsorResults = SPONSORS
    .filter(s => s.active && s.city === cityNorm && s.categories.some(c => c.includes(q) || q.includes(c)))
    .map(s => ({
      name: s.name, type: s.categories[0] || '', address: s.address,
      url: s.url, image: s.image, phone: s.phone, rating: s.rating,
      sponsored: true,
    }));

  // Then places from places.json
  const placeResults = PLACES
    .filter(p => p.active && p.city === cityNorm && matchScore(p) > 0)
    .sort((a, b) => matchScore(b) - matchScore(a))
    .slice(0, 8)
    .map(p => ({
      name: p.name, type: p.type, address: p.address,
      url: p.url, image: p.image, phone: p.phone,
      description: p.description, sponsored: false,
    }));

  res.json([...sponsorResults, ...placeResults]);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  What Should We Do Today?\n  Running at http://localhost:${PORT}\n`);
});
