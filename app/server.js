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
};

function buildPrompt(who, budget, time, setting, mood, city, lang = 'da', days = 1) {
  const location = city ? `in ${city}, Denmark` : 'in their city';
  const langNote = lang === 'da' ? 'Reply in Danish.' : 'Reply in English.';
  const numDays = parseInt(days) || 1;

  if (numDays > 1) {
    return `Activity planner. ${langNote} Generate exactly 3 JSON multi-day plans for: ${WHO_LABELS[who] || who}, ${BUDGET_LABELS[budget] || budget}, a ${numDays}-day trip, ${setting}, mood: ${mood}, ${location}. Each plan has a "days" array with exactly ${numDays} day objects, each day has 2-3 steps. Return ONLY a raw JSON array:
[{"id":1,"title":"short title","tagline":"one sentence","emoji":"emoji","why":"one sentence","totalTime":"${numDays} dage","totalCost":"X-Xkr","goodFor":["l1","l2"],"days":[{"day":1,"label":"Dag 1 – Theme","steps":[{"order":1,"name":"place","type":"Café/Restaurant/Bar/Museum/Park/etc","activity":"one sentence","duration":"X min","estimatedCost":"Xkr","mapSearch":"query"}]},{"day":2,"label":"Dag 2 – Theme","steps":[...]}]}]`;
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
  const { who, budget, time, setting, mood, city, lang, days } = req.body;
  const numDays = parseInt(days) || 1;
  const isMultiDay = numDays > 1;
  if (!who || !budget || (!time && !isMultiDay) || !setting || !mood) {
    return res.status(400).json({ error: 'Missing preferences' });
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  await streamPlans(res, buildPrompt(who, budget, time, setting, mood, city, lang, numDays), city, isMultiDay);
});

app.get('/api/sponsors', (_req, res) => {
  res.json(SPONSORS.filter(s => s.active));
});

app.get('/api/cities', (_req, res) => {
  const labels = { aalborg: 'Aalborg', aarhus: 'Aarhus', københavn: 'København', odense: 'Odense', esbjerg: 'Esbjerg', randers: 'Randers', kolding: 'Kolding', horsens: 'Horsens', vejle: 'Vejle', roskilde: 'Roskilde' };
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

// ===== BOOKING API =====
const bookingLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

function sbHeaders(token) {
  return { apikey: SUPABASE_ANON, Authorization: `Bearer ${token || SUPABASE_ANON}`, 'Content-Type': 'application/json' };
}
function sbServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function getUserEmail(userId) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const u = await r.json();
    return u.email || null;
  } catch { return null; }
}

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'UdNu <noreply@udnu.dk>', to, subject, html }),
    });
  } catch (e) { console.error('Email fejl:', e.message); }
}
function extractToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}
async function getUserId(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: sbHeaders(token) });
  const u = await r.json();
  return u.id || null;
}

// GET /api/listings
app.get('/api/listings', async (req, res) => {
  const { city } = req.query;
  let url = `${SUPABASE_URL}/rest/v1/listings?active=eq.true&order=created_at.desc`;
  if (city) url += `&city=eq.${encodeURIComponent(city)}`;
  try {
    const r = await fetch(url, { headers: sbHeaders() });
    res.json(await r.json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/listings/:id  — must come before /api/listings/:id/unavailable
app.get('/api/listings/:id/unavailable', async (req, res) => {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?listing_id=eq.${req.params.id}&status=eq.confirmed&select=check_in,check_out`,
      { headers: sbServiceHeaders() }
    );
    res.json(await r.json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${req.params.id}&active=eq.true&limit=1`,
      { headers: sbHeaders() }
    );
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) return res.status(404).json({ error: 'Ikke fundet' });
    res.json(data[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/listings
app.post('/api/listings', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const { title, description, city, address, price_per_night, max_guests, amenities, image_url, images } = req.body;
  if (!title || !city || !price_per_night) return res.status(400).json({ error: 'Titel, by og pris er påkrævet' });
  const price = parseFloat(price_per_night);
  if (isNaN(price) || price <= 0) return res.status(400).json({ error: 'Ugyldig pris' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  const imgArray = Array.isArray(images) ? images.filter(Boolean).slice(0, 20) : (image_url ? [String(image_url).slice(0, 500)] : []);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
      method: 'POST',
      headers: { ...sbHeaders(token), Prefer: 'return=representation' },
      body: JSON.stringify({
        host_id: userId,
        title: String(title).slice(0, 200),
        description: String(description || '').slice(0, 2000),
        city: String(city).slice(0, 100).toLowerCase().trim(),
        address: String(address || '').slice(0, 300),
        price_per_night: price,
        max_guests: Math.max(1, Math.min(20, parseInt(max_guests) || 2)),
        amenities: Array.isArray(amenities) ? amenities.slice(0, 20) : [],
        image_url: imgArray[0] || null,
        images: imgArray,
        active: true,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || 'Kunne ikke oprette opslag' });
    res.status(201).json(Array.isArray(data) ? data[0] : data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/listings/:id/deactivate
app.patch('/api/listings/:id/deactivate', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(token), Prefer: 'return=representation' },
      body: JSON.stringify({ active: false }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Fejl' });
    res.json(Array.isArray(data) ? (data[0] || {}) : data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/bookings
app.post('/api/bookings', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const { listing_id, check_in, check_out, guests, message,
          guest_first_name, guest_last_name, guest_email, guest_address, guest_phone } = req.body;
  if (!listing_id || !check_in || !check_out) return res.status(400).json({ error: 'Mangler felter' });
  if (!guest_first_name || !guest_last_name || !guest_email || !guest_phone)
    return res.status(400).json({ error: 'Navn, e-mail og telefon er påkrævet' });
  const cin   = new Date(check_in  + 'T00:00:00');
  const cout  = new Date(check_out + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (isNaN(cin) || isNaN(cout)) return res.status(400).json({ error: 'Ugyldige datoer' });
  if (cout <= cin)   return res.status(400).json({ error: 'Check-out skal være efter check-in' });
  if (cin < today)   return res.status(400).json({ error: 'Check-in kan ikke være i fortiden' });
  const [userId, listingRes] = await Promise.all([
    getUserId(token),
    fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listing_id}&active=eq.true&limit=1`, { headers: sbHeaders() }),
  ]);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  const listings = await listingRes.json();
  if (!Array.isArray(listings) || !listings.length) return res.status(404).json({ error: 'Opslag ikke fundet' });
  const listing = listings[0];
  if (listing.host_id === userId) return res.status(400).json({ error: 'Du kan ikke booke dit eget opslag' });
  const nights      = Math.round((cout - cin) / 86400000);
  const total_price = nights * listing.price_per_night;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: { ...sbHeaders(token), Prefer: 'return=representation' },
      body: JSON.stringify({
        listing_id,
        guest_id: userId,
        check_in,
        check_out,
        guests: Math.max(1, Math.min(listing.max_guests, parseInt(guests) || 1)),
        total_price,
        status: 'pending',
        message:          String(message || '').slice(0, 500),
        guest_first_name: String(guest_first_name || '').slice(0, 100),
        guest_last_name:  String(guest_last_name  || '').slice(0, 100),
        guest_email:      String(guest_email      || '').slice(0, 200),
        guest_address:    String(guest_address    || '').slice(0, 300),
        guest_phone:      String(guest_phone      || '').slice(0, 50),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (data.code === '23P01' || String(data.message || '').includes('no_overlap')) {
        return res.status(409).json({ error: 'Disse datoer er allerede booket. Vælg andre datoer.' });
      }
      return res.status(r.status).json({ error: data.message || 'Booking fejlede' });
    }
    res.status(201).json(Array.isArray(data) ? data[0] : data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/my-bookings
app.get('/api/my-bookings', async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?guest_id=eq.${userId}&order=check_in.asc&select=*,listings(id,title,city,address,price_per_night,image_url)`,
      { headers: sbHeaders(token) }
    );
    res.json(await r.json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/my-listings
app.get('/api/my-listings', async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?host_id=eq.${userId}&order=created_at.desc`,
      { headers: sbHeaders(token) }
    );
    res.json(await r.json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/host-bookings — bookings made on the host's listings
app.get('/api/host-bookings', async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  try {
    // Fetch all listings owned by this host first
    const lRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?host_id=eq.${userId}&select=id`,
      { headers: sbHeaders(token) }
    );
    const listings = await lRes.json();
    if (!listings.length) return res.json([]);

    const ids = listings.map(l => l.id).join(',');
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?listing_id=in.(${ids})&order=check_in.asc&select=*,listings(id,title,city,address,price_per_night,image_url)`,
      { headers: sbHeaders(token) }
    );
    res.json(await r.json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/bookings/:id/cancel
app.patch('/api/bookings/:id/cancel', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${req.params.id}&status=in.(pending,confirmed)`, {
      method: 'PATCH',
      headers: { ...sbHeaders(token), Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Fejl' });
    if (!Array.isArray(data) || !data.length) return res.status(404).json({ error: 'Booking ikke fundet' });
    res.json(data[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/bookings/:id/approve — host approves a pending booking
app.patch('/api/bookings/:id/approve', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  try {
    // Fetch the booking + listing to verify host ownership
    const bRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${req.params.id}&status=eq.pending&select=*,listings(host_id,title,city)`,
      { headers: sbServiceHeaders() }
    );
    const rows = await bRes.json();
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Booking ikke fundet eller ikke afventende' });
    const booking = rows[0];
    if (booking.listings?.host_id !== userId) return res.status(403).json({ error: 'Ingen adgang' });

    // Confirm the booking (service key bypasses RLS)
    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { ...sbServiceHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    const data = await upRes.json();
    if (!upRes.ok) {
      if ((data.code === '23P01' || String(data.message || '').includes('no_overlap')))
        return res.status(409).json({ error: 'Datoerne er allerede booket. Afvis denne booking.' });
      return res.status(upRes.status).json({ error: 'Kunne ikke godkende' });
    }

    // Email host with guest contact info
    const hostEmail = await getUserEmail(userId);
    if (hostEmail) {
      await sendEmail({
        to: hostEmail,
        subject: `Booking godkendt — ${booking.listings?.title || 'dit opslag'}`,
        html: `
          <h2>Du har godkendt en booking</h2>
          <p><strong>Opslag:</strong> ${booking.listings?.title || ''} (${booking.listings?.city || ''})</p>
          <p><strong>Datoer:</strong> ${booking.check_in} → ${booking.check_out}</p>
          <p><strong>Gæst:</strong> ${booking.guest_first_name} ${booking.guest_last_name}</p>
          <p><strong>E-mail:</strong> ${booking.guest_email}</p>
          <p><strong>Telefon:</strong> ${booking.guest_phone}</p>
          ${booking.guest_address ? `<p><strong>Adresse:</strong> ${booking.guest_address}</p>` : ''}
          ${booking.message ? `<p><strong>Besked:</strong> ${booking.message}</p>` : ''}
          <p><strong>Total:</strong> ${booking.total_price} kr</p>
        `,
      });
    }

    res.json(Array.isArray(data) ? data[0] : data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/bookings/:id/reject — host rejects a pending booking
app.patch('/api/bookings/:id/reject', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  try {
    const bRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${req.params.id}&status=eq.pending&select=listing_id,listings(host_id)`,
      { headers: sbServiceHeaders() }
    );
    const rows = await bRes.json();
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Booking ikke fundet' });
    if (rows[0].listings?.host_id !== userId) return res.status(403).json({ error: 'Ingen adgang' });

    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { ...sbServiceHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const data = await upRes.json();
    if (!upRes.ok) return res.status(upRes.status).json({ error: 'Fejl' });
    res.json(Array.isArray(data) ? data[0] : data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/listings/:id
app.delete('/api/listings/:id', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  try {
    // Verify ownership first
    const chk = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${req.params.id}&host_id=eq.${userId}&select=id`, { headers: sbServiceHeaders() });
    const rows = await chk.json();
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Opslag ikke fundet' });

    // Delete bookings first (foreign key on delete restrict blocks listing delete)
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?listing_id=eq.${req.params.id}`, {
      method: 'DELETE',
      headers: sbServiceHeaders(),
    });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${req.params.id}`, {
      method: 'DELETE',
      headers: sbServiceHeaders(),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Kunne ikke slette' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/listings/:id/edit
app.patch('/api/listings/:id/edit', bookingLimiter, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Login krævet' });
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Ugyldig session' });
  const { title, description, city, address, price_per_night, max_guests, amenities, image_url, images } = req.body;
  if (!title || !city || !price_per_night) return res.status(400).json({ error: 'Titel, by og pris er påkrævet' });
  const price = parseFloat(price_per_night);
  if (isNaN(price) || price <= 0) return res.status(400).json({ error: 'Ugyldig pris' });
  try {
    // Verify ownership
    const chk = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${req.params.id}&host_id=eq.${userId}&select=id`, { headers: sbServiceHeaders() });
    const rows = await chk.json();
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Opslag ikke fundet' });

    const imgArray = Array.isArray(images) ? images.filter(Boolean).slice(0, 20) : (image_url ? [String(image_url).slice(0, 500)] : []);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { ...sbServiceHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({
        title:           String(title).slice(0, 200),
        description:     String(description || '').slice(0, 2000),
        city:            String(city).slice(0, 100).toLowerCase().trim(),
        address:         String(address || '').slice(0, 300),
        price_per_night: price,
        max_guests:      Math.max(1, Math.min(20, parseInt(max_guests) || 2)),
        amenities:       Array.isArray(amenities) ? amenities.slice(0, 20) : [],
        image_url:       imgArray[0] || null,
        images:          imgArray,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Kunne ikke opdatere' });
    res.json(Array.isArray(data) ? data[0] : data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  hvadnu — running at http://localhost:${PORT}`);
  console.log(`  ADMIN_SECRET set: ${!!ADMIN_SECRET}\n`);
});
