const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = 'https://kqpxhefvnrlsuxmiqhhy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhoZWZ2bnJsc3V4bWlxaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzE4NjEsImV4cCI6MjA5MDgwNzg2MX0.-fw759yENbo2UZTdgzIU4TpjUqOON4ogtpEUYvE8fqA';
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) console.warn('[WARN] ADMIN_SECRET is not set in environment variables');

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

// Redirect /page.html -> /page
app.use((req, res, next) => {
  if (req.path.endsWith('.html') && req.path !== '/') {
    return res.redirect(301, req.path.slice(0, -5));
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const aiLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'For mange forsøg. Prøv igen om et minut.' } });
const trackLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

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
  'weekend': 'a 2-day weekend trip',
  'vacation': 'a 3 to 5 day vacation',
};

function buildPrompt(who, budget, time, setting, mood, city, lang = 'da') {
  const location = city ? `in ${city}, Denmark` : 'in their city';
  const langNote = lang === 'da' ? 'Reply in Danish.' : 'Reply in English.';
  const isMultiDay = time === 'weekend' || time === 'vacation';

  if (isMultiDay) {
    const numDays = time === 'weekend' ? 2 : 4;
    const totalTimeLabel = time === 'weekend' ? '2 dage' : '4 dage';
    return `Activity planner. ${langNote} Generate exactly 3 JSON multi-day plans for: ${WHO_LABELS[who] || who}, ${BUDGET_LABELS[budget] || budget}, ${TIME_LABELS[time]}, ${setting}, mood: ${mood}, ${location}. Each plan has a "days" array with exactly ${numDays} day objects, each day has 2-3 steps. Return ONLY a raw JSON array:
[{"id":1,"title":"short title","tagline":"one sentence","emoji":"emoji","why":"one sentence","totalTime":"${totalTimeLabel}","totalCost":"X-Xkr","goodFor":["l1","l2"],"days":[{"day":1,"label":"Dag 1 – Theme","steps":[{"order":1,"name":"place","type":"Café/Restaurant/Bar/Museum/Park/etc","activity":"one sentence","duration":"X min","estimatedCost":"Xkr","mapSearch":"query"}]},{"day":2,"label":"Dag 2 – Theme","steps":[...]}]}]`;
  }

  return `Activity planner. ${langNote} Generate exactly 3 JSON plans for: ${WHO_LABELS[who] || who}, ${BUDGET_LABELS[budget] || budget}, ${TIME_LABELS[time] || time}, ${setting}, mood: ${mood}, ${location}. 3 distinct plans, each exactly 2 steps. Return ONLY a raw JSON array:
[{"id":1,"title":"short title","tagline":"one sentence","emoji":"emoji","why":"one sentence","totalTime":"X hours","totalCost":"X-Xkr","goodFor":["l1","l2"],"steps":[{"order":1,"name":"place","type":"Café/Restaurant/Bar/Museum/Park/Bowling/Cinema/Escape Room/etc","activity":"one sentence","duration":"X min","estimatedCost":"Xkr","mapSearch":"query"}]}]`;
}

async function streamPlans(res, prompt, city, isMultiDay = false) {
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    const stream = getAnthropic().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: isMultiDay ? 3000 : 1200,
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
    plans.forEach(plan => {
      const allSteps = plan.days
        ? plan.days.flatMap(d => d.steps)
        : (plan.steps || []);
      allSteps.forEach(step => {
        step.yelpPlace = findPlace(step.type, city);
      });
    });

    send({ plans });
  } catch (err) {
    console.error('Error generating plans:', err);
    send({ error: 'Kunne ikke generere planer. Prøv igen.' });
  }
  res.end();
}

app.post('/api/recommend-free', aiLimiter, async (req, res) => {
  const { description, lang, city: bodyCity } = req.body;
  if (!description) return res.status(400).json({ error: 'Missing description' });
  if (typeof description !== 'string') return res.status(400).json({ error: 'Invalid input' });
  const safeDesc = description.slice(0, 500).replace(/[<>]/g, '');
  const langNote = lang === 'da' ? 'IMPORTANT: Write ALL content in Danish.' : 'Write all content in English.';

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

  const prompt = `Activity planner. ${langNote} User request: "${safeDesc}". Extract city, who, budget, time, vibe. Generate exactly 3 distinct JSON plans, each exactly 2 steps. Return ONLY raw JSON array:
[{"id":1,"title":"short title","tagline":"one sentence","emoji":"emoji","why":"one sentence","totalTime":"X hours","totalCost":"X-Xkr","goodFor":["l1","l2"],"steps":[{"order":1,"name":"place","type":"Café/Restaurant/Bar/Museum/Park/Bowling/Cinema/Escape Room/etc","activity":"one sentence","duration":"X min","estimatedCost":"Xkr","mapSearch":"query"}]}]`;

  const cityMatch =
    safeDesc.match(/(?:^|\s)i\s+([A-ZÆØÅ][a-zæøå]+(?:\s[A-ZÆØÅ][a-zæøå]+)?)/) ||
    safeDesc.match(/\bin\s+([A-ZÆØÅ][a-zæøå]+(?:\s[A-ZÆØÅ][a-zæøå]+)?)\b/i) ||
    safeDesc.match(/\b([A-ZÆØÅ][a-zæøå]{3,}(?:\s[A-ZÆØÅ][a-zæøå]+)?)\b/);
  const city = bodyCity || (cityMatch ? cityMatch[1] : '');

  await streamPlans(res, prompt, city);
});

app.post('/api/recommend', aiLimiter, async (req, res) => {
  const { who, budget, time, setting, mood, city, lang } = req.body;
  if (!who || !budget || !time || !setting || !mood) {
    return res.status(400).json({ error: 'Missing preferences' });
  }
  const isMultiDay = time === 'weekend' || time === 'vacation';
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  await streamPlans(res, buildPrompt(who, budget, time, setting, mood, city, lang), city, isMultiDay);
});

app.get('/api/sponsors', (_req, res) => {
  res.json(SPONSORS.filter(s => s.active));
});

app.get('/api/cities', (_req, res) => {
  const labels = { aalborg: 'Aalborg', aarhus: 'Aarhus', copenhagen: 'København', odense: 'Odense', lystrup: 'Lystrup' };
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



app.get('/api/admin/debug', (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    supabaseUrlSet: !!process.env.SUPABASE_URL,
    supabaseServiceKeySet: !!process.env.SUPABASE_SERVICE_KEY,
    supabaseServiceKeyLength: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0,
  });
});

app.get('/api/admin/stats', async (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const [statsRes, plansRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_admin_stats`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_plans_count`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
    ]);

    const stats = await statsRes.json();
    const totalPlans = parseInt(await plansRes.json() || 0, 10);
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


app.get('/api/smart-search', aiLimiter, async (req, res) => {
  const q = (req.query.q || '').trim().slice(0, 200);
  const intent = (req.query.intent || '').trim().slice(0, 100);
  const city = (req.query.city || '').toLowerCase().trim();
  if (!q) return res.json([]);

  const qLower = q.toLowerCase();
  const matchesCity = (c) => !city || c === city;
  const matchesQ = (text) => (text || '').toLowerCase().includes(qLower) || qLower.split(' ').some(w => w.length > 2 && (text || '').toLowerCase().includes(w));

  const sponsorCandidates = SPONSORS.filter(s =>
    s.active && matchesCity(s.city) &&
    (s.categories.some(c => matchesQ(c)) || matchesQ(s.name) || matchesQ(s.description || ''))
  ).map(s => ({ name: s.name, type: s.categories[0] || '', address: s.address || '', description: s.description || '', image: s.image || null, url: s.url || null, phone: s.phone || null, sponsored: true, tags: [] }));

  const seen = new Set(sponsorCandidates.map(s => s.name.toLowerCase()));
  const placeCandidates = PLACES.filter(p =>
    p.active && matchesCity(p.city) &&
    (matchesQ(p.type) || matchesQ(p.name) || matchesQ(p.description || '') || (p.tags || []).some(t => matchesQ(t)))
  ).filter(p => !seen.has(p.name.toLowerCase()))
   .map(p => ({ name: p.name, type: p.type || '', address: p.address || '', description: p.description || '', image: p.image || null, url: p.url || null, phone: p.phone || null, sponsored: false, tags: p.tags || [] }));

  const candidates = [...sponsorCandidates, ...placeCandidates].slice(0, 15);
  if (!candidates.length) return res.json([]);
  if (candidates.length <= 3) return res.json(candidates.map(p => ({ ...p, reasons: [], badge: null })));

  const intentText = intent ? ` De vil specifikt have: "${intent}".` : '';
  const prompt = `Du er en dansk lokal guide. Brugeren søger: "${q}".${intentText}

Tilgængelige steder:
${candidates.map((p, i) => `${i + 1}. ${p.name} (${p.type}) — ${p.description}${p.tags.length ? ' Tags: ' + p.tags.join(', ') : ''}`).join('\n')}

Vælg de 3 bedste steder der matcher søgningen og intent. For hvert: 2-3 korte grunde (max 6 ord pr. grund, på dansk). Vælg ét badge: "Bedste valg", "Billigste option", "Mest populær", "Perfekt til date", "God til venner", "God til arbejde".
Svar KUN i JSON: [{"index":1,"reasons":["...","..."],"badge":"..."}]`;

  try {
    const msg = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) throw new Error('no json');
    const picks = JSON.parse(jsonMatch[0]);
    const results = picks
      .filter(pick => pick.index >= 1 && pick.index <= candidates.length)
      .slice(0, 3)
      .map(pick => ({ ...candidates[pick.index - 1], reasons: pick.reasons || [], badge: pick.badge || null }));
    res.json(results);
  } catch {
    res.json(candidates.slice(0, 3).map(p => ({ ...p, reasons: [], badge: null })));
  }
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const city = (req.query.city || '').toLowerCase().trim();
  if (!q && !city) return res.json([]);

  const matchesCity = (c) => !city || c === city;
  const matchesQuery = (text) => !q || (text || '').toLowerCase().includes(q);

  const sponsorHits = SPONSORS.filter(s =>
    s.active && matchesCity(s.city) &&
    (s.categories.some(c => matchesQuery(c)) || matchesQuery(s.name))
  ).map(s => ({ name: s.name, type: s.categories[0], address: s.address, url: s.url, image: s.image, phone: s.phone, description: null, instagram: s.instagram || null, facebook: s.facebook || null, sponsored: true }));

  const seen = new Set(sponsorHits.map(s => s.name.toLowerCase()));
  const placeHits = PLACES.filter(p =>
    p.active && matchesCity(p.city) &&
    (matchesQuery(p.type) || matchesQuery(p.name) || matchesQuery(p.description))
  ).filter(p => !seen.has(p.name.toLowerCase()))
   .map(p => ({ name: p.name, type: p.type, address: p.address, url: p.url, image: p.image, phone: p.phone, description: p.description, instagram: p.instagram || null, facebook: p.facebook || null, sponsored: false }));

  res.json([...sponsorHits, ...placeHits].slice(0, 9));
});

// Track page view (anonymous, called from all pages)
app.post('/api/track', trackLimiter, async (req, res) => {
  const { page, referrer } = req.body || {};
  if (!page || typeof page !== 'string') return res.json({ ok: false });
  const safePage = page.slice(0, 200).replace(/[<>]/g, '');
  const safeRef  = referrer ? String(referrer).slice(0, 500).replace(/[<>]/g, '') : null;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ page: safePage, referrer: safeRef }),
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// Admin traffic stats
app.get('/api/admin/traffic', async (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const now = new Date();
    const dayAgo   = new Date(now - 86400000).toISOString();
    const weekAgo  = new Date(now - 7 * 86400000).toISOString();
    const monthAgo = new Date(now - 30 * 86400000).toISOString();

    const [todayRes, weekRes, monthRes, pagesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/page_views?select=count&created_at=gte.${dayAgo}`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/page_views?select=count&created_at=gte.${weekAgo}`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/page_views?select=count&created_at=gte.${monthAgo}`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/page_views?select=page&created_at=gte.${monthAgo}&order=created_at.desc&limit=500`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      }),
    ]);

    const today  = parseInt(todayRes.headers.get('content-range')?.split('/')[1] || '0');
    const week   = parseInt(weekRes.headers.get('content-range')?.split('/')[1] || '0');
    const month  = parseInt(monthRes.headers.get('content-range')?.split('/')[1] || '0');

    const pagesData = await pagesRes.json();
    const pageCounts = {};
    (pagesData || []).forEach(({ page }) => { pageCounts[page] = (pageCounts[page] || 0) + 1; });
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([page, views]) => ({ page, views }));

    res.json({ today, week, month, topPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  hvadnu — running at http://localhost:${PORT}`);
  console.log(`  ADMIN_SECRET set: ${!!ADMIN_SECRET}\n`);
});
