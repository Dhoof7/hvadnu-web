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
  const who = { couple: 'a date', friends: 'friends', family: 'family' };
  const budget = { low: 'low budget', medium: 'medium budget', high: 'generous budget' };
  const time = { '1h': '1 hour', '2-3h': '2–3 hours', 'fullday': 'a full day' };
  const parts = [];
  if (p.who) parts.push(who[p.who] || p.who);
  if (p.mood) parts.push(p.mood + ' vibe');
  if (p.time) parts.push(time[p.time] || p.time);
  if (p.city) parts.push('in ' + p.city);
  return parts.join(' · ');
}

function renderCard(plan, index) {
  const highlights = (plan.highlights || []).map(h => `<li>${h}</li>`).join('');
  const pills = (plan.goodFor || []).map(g => `<span class="pill">${g}</span>`).join('');

  return `
    <div class="result-card" data-plan-index="${index}">
      <div class="result-card-top">
        <h3>${plan.title}</h3>
        <p class="result-card-tagline">${plan.tagline}</p>

        <div class="why-box">
          <p>${plan.why}</p>
        </div>

        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-label">Price</span>
            <span class="stat-value">${(plan.priceLevel || 'kr').replace(/krkrkr/gi,'kr').replace(/krkr/gi,'kr').replace(/kr kr kr/gi,'kr').replace(/kr kr/gi,'kr')}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Time</span>
            <span class="stat-value">${plan.totalTime || '–'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Cost</span>
            <span class="stat-value">${plan.totalCost || '–'}</span>
          </div>
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
  window.location.href = 'plan.html';
}

window.selectPlan = selectPlan;

async function fetchPlans() {
  const raw = localStorage.getItem('preferences');
  if (!raw) {
    window.location.href = 'quiz.html';
    return;
  }

  const preferences = JSON.parse(raw);

  const sub = document.getElementById('resultsSub');
  if (sub) sub.textContent = buildPreferencesSummary(preferences);

  try {
    const endpoint = preferences.freetext ? '/api/recommend-free' : '/api/recommend';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleEvent = (raw) => {
      if (!raw.startsWith('data: ')) return;
      let data;
      try { data = JSON.parse(raw.slice(6)); } catch { return; }

      if (data.error) { showError(data.error); return; }

      if (data.status === 'enriching') {
        clearInterval(hintInterval);
        if (loadingHint) loadingHint.textContent = 'Finding real places near you...';
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
    showError('Network error. Make sure the server is running and your API key is set.');
  }
}

fetchPlans();
