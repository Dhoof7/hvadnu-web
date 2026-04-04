const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SB_URL = 'https://kqpxhefvnrlsuxmiqhhy.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhoZWZ2bnJsc3V4bWlxaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzE4NjEsImV4cCI6MjA5MDgwNzg2MX0.-fw759yENbo2UZTdgzIU4TpjUqOON4ogtpEUYvE8fqA';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dhoof12349';

const fs = require('fs');
let SPONSORS = [];
try {
  SPONSORS = JSON.parse(fs.readFileSync(path.join(__dirname, 'sponsors.json'), 'utf8'));
} catch { SPONSORS = []; }

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

async function findPlace(stepType, city) {
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

async function findLocalPlace(stepType, city) {
  if (!city) return null;
  try {
    const cityNorm = city.toLowerCase().trim();
    const typeNorm = stepType.toLowerCase().trim();
    const params = new URLSearchParams({
      city: `eq.${cityNorm}`,
      type: `ilike.*${typeNorm}*`,
      active: 'eq.true',
      limit: 1,
      order: 'random()',
    });
    const res = await fetch(`${SB_URL}/rest/v1/places?${params}`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data[0];
    if (!p) return null;
    return {
      name: p.name,
      address: p.address,
      url: p.url,
      image: p.image,
      phone: p.phone,
      description: p.description,
      sponsored: false,
    };
  } catch {
    return null;
  }
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
  const location = city ? `in or around ${city}` : 'in their city';
  const langNote = lang === 'da' ? 'IMPORTANT: Write ALL content in Danish.' : 'Write all content in English.';
  return `You are a creative local activity planner. A user wants personalized plans for what to do today. ${langNote}

User preferences:
- Who: ${WHO_LABELS[who] || who}
- Budget: ${BUDGET_LABELS[budget] || budget}
- Time available: ${TIME_LABELS[time] || time}
- Setting preference: ${setting} (indoor, outdoor, or a mix)
- Mood / vibe: ${mood}
- Location: ${location}

Your task: Generate exactly 3 complete activity plans. Each plan is a sequence of 2–4 stops or activities that flow naturally together. The 3 plans should each have a distinct personality — don't just vary one detail.

Rules:
- Match the time: a 1-hour plan has 2 quick stops; a full-day plan has 4 stops with meals
- Match the budget strictly: low budget = mostly free or very cheap activities
- Match the mood: cozy = coffee shops, bookstores, calm parks; active = sports, hiking, markets; romantic = scenic walks, nice dinners, art
- Match who they are: date ideas feel different from family or friends plans
- Make the "why" field genuinely explain the match — don't be generic

Return ONLY a valid JSON array, no markdown, no explanation, no code fences. Exactly 3 plans:

[
  {
    "id": 1,
    "title": "Short creative plan title (3–5 words)",
    "tagline": "One catchy sentence that sells the vibe",
    "emoji": "one relevant emoji",
    "why": "2–3 sentences explaining specifically why this plan fits this user — mention their mood, who they're with, and budget",
    "priceLevel": "use: kr / kr kr / kr kr kr (one symbol = cheap, three = expensive)",
    "totalTime": "e.g. 2.5 hours",
    "totalCost": "e.g. 0–80kr per person",
    "highlights": ["short highlight 1", "short highlight 2", "short highlight 3"],
    "goodFor": ["label 1", "label 2"],
    "steps": [
      {
        "order": 1,
        "name": "Name of place or activity",
        "type": "ALWAYS in English: Park / Café / Restaurant / Museum / Bar / Market / Beach / Bowling / Cinema / Escape Room / Paintball / etc.",
        "activity": "What exactly to do here — one specific sentence",
        "duration": "e.g. 45 minutes",
        "estimatedCost": "Free or e.g. 40–65kr per person",
        "tip": "One practical tip to make this stop better",
        "mapSearch": "search query for Google Maps e.g. 'cozy café near Nørreport Copenhagen'"
      }
    ]
  }
]`;
}

async function streamPlans(res, prompt, city) {
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    const stream = getAnthropic().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    let raw = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        raw += chunk.delta.text;
        send({ chunk: chunk.delta.text });
      }
    }
    raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const plans = JSON.parse(raw);
    send({ status: 'enriching' });
    await Promise.all(
      plans.flatMap(plan =>
        plan.steps.map(async step => {
          step.yelpPlace = await findPlace(step.type, city);
        })
      )
    );
    send({ plans });
  } catch (err) {
    console.error('Error generating plans:', err);
    send({ error: err.message || 'Could not generate plans.' });
  }
  res.end();
}

app.post('/api/recommend-free', async (req, res) => {
  const { description, lang } = req.body;
  if (!description) return res.status(400).json({ error: 'Missing description' });
  const langNote = lang === 'da' ? 'IMPORTANT: Write ALL content in Danish.' : 'Write all content in English.';

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

  const prompt = `You are a creative local activity planner. ${langNote} A user described their situation in their own words:

"${description}"

Read their description carefully and extract: who they are, what city, budget hints, time of day, and what kind of experience they want.

Generate exactly 3 complete activity plans that fit their description. Each plan is a sequence of 2–4 stops that flow naturally together.

Rules:
- If they mention food/dinner, include a restaurant step with a real booking option
- Match the energy: party night = bars/clubs; relaxed = cafés/parks; family = kid-friendly
- Each plan should have a distinct personality
- Use the city they mention for all mapSearch queries

Return ONLY a valid JSON array, no markdown, no explanation, no code fences. Exactly 3 plans:

[
  {
    "id": 1,
    "title": "Short creative plan title (3–5 words)",
    "tagline": "One catchy sentence that sells the vibe",
    "emoji": "one relevant emoji",
    "why": "2–3 sentences explaining why this fits their specific situation",
    "priceLevel": "use: kr / kr kr / kr kr kr (one symbol = cheap, three = expensive)",
    "totalTime": "e.g. 4 hours",
    "totalCost": "e.g. 200–350kr per person",
    "highlights": ["short highlight 1", "short highlight 2", "short highlight 3"],
    "goodFor": ["label 1", "label 2"],
    "steps": [
      {
        "order": 1,
        "name": "Name of place or activity",
        "type": "ALWAYS in English: Park / Café / Restaurant / Bar / Club / Museum / Bowling / Cinema / Escape Room / etc.",
        "activity": "What exactly to do here — one specific sentence",
        "duration": "e.g. 1.5 hours",
        "estimatedCost": "Free or e.g. 150–200kr per person",
        "tip": "One practical tip",
        "mapSearch": "search query e.g. 'best steakhouse Copenhagen city center'",
        "bookable": true
      }
    ]
  }
]

Set "bookable": true only for Restaurant and Bar steps where a reservation makes sense.`;

  const cityMatch =
    description.match(/(?:^|\s)i\s+([A-ZÆØÅ][a-zæøå]+(?:\s[A-ZÆØÅ][a-zæøå]+)?)/) ||
    description.match(/\bin\s+([A-ZÆØÅ][a-zæøå]+(?:\s[A-ZÆØÅ][a-zæøå]+)?)\b/i) ||
    description.match(/\b([A-ZÆØÅ][a-zæøå]{3,}(?:\s[A-ZÆØÅ][a-zæøå]+)?)\b/);
  const city = cityMatch ? cityMatch[1] : '';

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

app.get('/api/cities', async (_req, res) => {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/places?select=city&active=eq.true`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
    });
    const data = await r.json();
    const unique = [...new Set(data.map(p => p.city))].sort();
    const labels = { aalborg: 'Aalborg', aarhus: 'Aarhus', copenhagen: 'København', odense: 'Odense' };
    res.json(unique.map(c => ({ value: c, label: labels[c] || c.charAt(0).toUpperCase() + c.slice(1) })));
  } catch {
    res.json([]);
  }
});

app.get('/api/test', async (req, res) => {
  const results = { anthropic: false, yelp: false, errors: [] };
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
  try {
    const r = await fetch('https://api.yelp.com/v3/businesses/search?term=cafe&location=Copenhagen&limit=1', {
      headers: { Authorization: `Bearer ${YELP_API_KEY}` },
    });
    results.yelp = r.ok;
    if (!r.ok) results.errors.push('Yelp: ' + r.status + ' ' + r.statusText);
  } catch (e) {
    results.errors.push('Yelp: ' + e.message);
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
  const sbUrl = 'https://kqpxhefvnrlsuxmiqhhy.supabase.co';
  const sbAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhoZWZ2bnJsc3V4bWlxaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzE4NjEsImV4cCI6MjA5MDgwNzg2MX0.-fw759yENbo2UZTdgzIU4TpjUqOON4ogtpEUYvE8fqA';
  try {
    const [statsRes, plansRes] = await Promise.all([
      fetch(`${sbUrl}/rest/v1/rpc/get_admin_stats`, {
        method: 'POST',
        headers: { apikey: sbAnon, Authorization: `Bearer ${sbAnon}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
      fetch(`${sbUrl}/rest/v1/saved_plans?select=count`, {
        headers: {
          apikey: sbAnon,
          Authorization: `Bearer ${sbAnon}`,
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

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  What Should We Do Today?\n  Running at http://localhost:${PORT}\n`);
});
