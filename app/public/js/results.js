function stripEmoji(str) {
  if (!str) return str;
  return String(str).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/gu, '').replace(/[\u2702-\u27B0]/g, '').trim();
}

function da(str) {
  if (!str) return '–';
  return str
    .replace(/\babout\b/gi, 'ca.')
    .replace(/\baround\b/gi, 'ca.')
    .replace(/\bapprox\.?\b/gi, 'ca.')
    .replace(/\bfull day\b/gi, 'hel dag')
    .replace(/\bhalf day\b/gi, 'halv dag')
    .replace(/(\d[\d.,]*)\s*hours?\b/gi, (_, n) => `${n} ${parseFloat(n) === 1 ? 'time' : 'timer'}`)
    .replace(/(\d[\d.,]*)\s*minutes?\b/gi, (_, n) => `${n} min`)
    .replace(/\bfree\b/gi, 'gratis')
    .replace(/\bper person\b/gi, 'per person');
}

const loadingScreen = document.getElementById('loadingScreen');
const errorScreen   = document.getElementById('errorScreen');
const resultsPage   = document.getElementById('resultsPage');
const resultsGrid   = document.getElementById('resultsGrid');
const loadingHint   = document.getElementById('loadingHint');

const HINTS = () => [
  t('results.hint1'),
  t('results.hint2'),
  t('results.hint3'),
  t('results.hint4'),
];

let hintIndex = 0;
const hintInterval = setInterval(() => {
  const hints = HINTS();
  hintIndex = (hintIndex + 1) % hints.length;
  if (loadingHint) loadingHint.textContent = hints[hintIndex];
}, 2500);

function showError(msg) {
  clearInterval(hintInterval);
  loadingScreen.style.display = 'none';
  errorScreen.style.display = 'flex';
  const el = document.getElementById('errorMsg');
  if (el) el.textContent = msg;
}

function buildPreferencesSummary(p) {
  const who = { couple: 'date', friends: 'venner', family: 'familie' };
  const time = { '1h': '1 time', '2-3h': '2–3 timer', 'fullday': 'hel dag' };
  const parts = [];
  if (p.who) parts.push(who[p.who] || p.who);
  if (p.mood) parts.push(p.mood);
  if (p.days > 1) parts.push(`${p.days} dage`);
  else if (p.time) parts.push(time[p.time] || p.time);
  if (p.city) parts.push(p.city);
  return parts.join(' · ');
}

function renderCard(plan, index) {
  const highlights = (plan.highlights || []).map(h => `<li>${h}</li>`).join('');
  const pills = (plan.goodFor || []).map(g => `<span class="pill">${g}</span>`).join('');

  return `
    <div class="result-card" data-plan-index="${index}">
      <div class="result-card-top">
        <h3>${stripEmoji(plan.title)}</h3>
        <p class="result-card-tagline">${stripEmoji(plan.tagline)}</p>

        <div class="why-box">
          <p>${stripEmoji(plan.why)}</p>
        </div>

        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-label">Tid</span>
            <span class="stat-value">${da(plan.totalTime)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Pris</span>
            <span class="stat-value">${da(plan.totalCost)}</span>
          </div>
          ${plan.days ? `<div class="stat-item"><span class="stat-label">Dage</span><span class="stat-value">${plan.days.length}</span></div>` : ''}
        </div>

        <ul class="highlights">${highlights}</ul>
        <div class="good-for-pills">${pills}</div>
      </div>
      <div class="result-card-footer">
        <button class="btn-view-plan" onclick="selectPlan(${index})">${t('results.viewPlan')}</button>
      </div>
    </div>
  `;
}

function selectPlan(index) {
  const plans = JSON.parse(localStorage.getItem('plans') || '[]');
  localStorage.setItem('selectedPlan', JSON.stringify(plans[index]));
  window.location.href = '/plan';
}

window.selectPlan = selectPlan;

async function fetchPlans() {
  const raw = localStorage.getItem('preferences');
  if (!raw) {
    window.location.href = '/quiz';
    return;
  }

  const preferences = JSON.parse(raw);

  const sub = document.getElementById('resultsSub');
  if (sub) sub.textContent = buildPreferencesSummary(preferences);

  // Show cached plans instantly if available
  const cached = localStorage.getItem('plans');
  if (cached) {
    const plans = JSON.parse(cached);
    if (plans && plans.length) {
      clearInterval(hintInterval);
      loadingScreen.style.display = 'none';
      resultsPage.style.display = 'block';
      resultsGrid.innerHTML = plans.map((plan, i) => renderCard(plan, i)).join('');
      return;
    }
  }

  try {
    const endpoint = preferences.freetext ? '/api/recommend-free' : '/api/recommend';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let streamBuffer = '';
    let renderedCount = 0;

    function tryRenderStreamedPlans(text) {
      // Find complete plan objects in the stream and render them progressively
      const matches = [...text.matchAll(/\{[^{}]*"steps"\s*:\s*\[[^\]]*\][^{}]*\}/gs)];
      if (matches.length > renderedCount) {
        for (let i = renderedCount; i < matches.length; i++) {
          try {
            const plan = JSON.parse(matches[i][0]);
            if (!plan.title) continue; // skip day-level objects in multi-day streams
            plan.id = i + 1;
            if (renderedCount === 0) {
              clearInterval(hintInterval);
              loadingScreen.style.display = 'none';
              resultsPage.style.display = 'block';
              resultsGrid.innerHTML = '';
            }
            resultsGrid.innerHTML += renderCard(plan, i);
            renderedCount++;
          } catch {}
        }
      }
    }

    const handleEvent = (raw) => {
      if (!raw.startsWith('data: ')) return;
      let data;
      try { data = JSON.parse(raw.slice(6)); } catch { return; }

      if (data.error) { showError(data.error); return; }

      if (data.chunk) {
        streamBuffer += data.chunk;
        tryRenderStreamedPlans(streamBuffer);
      }

      if (data.status === 'enriching') {
        clearInterval(hintInterval);
        if (loadingHint) loadingHint.textContent = 'Finder rigtige steder nær dig...';
      }

      if (data.plans) {
        localStorage.setItem('plans', JSON.stringify(data.plans));
        clearInterval(hintInterval);
        loadingScreen.style.display = 'none';
        resultsPage.style.display = 'block';
        resultsGrid.innerHTML = data.plans.map((plan, i) => renderCard(plan, i)).join('');
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) handleEvent(buffer.trim());
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop(); // keep incomplete last event

      for (const event of events) {
        handleEvent(event.trim());
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      showError('Det tog for lang tid. Prøv igen.');
    } else {
      showError('Netværksfejl. Prøv igen.');
    }
  }
}

fetchPlans();
