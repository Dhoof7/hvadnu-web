const preferences = {};
const steps = document.querySelectorAll('.quiz-step');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const TOTAL_STEPS = steps.length;

let currentStep = 1;

function updateProgress() {
  const pct = ((currentStep - 1) / TOTAL_STEPS) * 100;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = `Trin ${currentStep} af ${TOTAL_STEPS}`;
}

function showStep(n) {
  steps.forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`.quiz-step[data-step="${n}"]`);
  if (target) target.classList.add('active');
  currentStep = n;
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function submitQuiz() {
  preferences.lang = 'da';
  localStorage.removeItem('plans');
  localStorage.setItem('preferences', JSON.stringify(preferences));
  window.location.href = 'results.html';
}

function nextStep() {
  if (currentStep < TOTAL_STEPS) {
    showStep(currentStep + 1);
  } else {
    submitQuiz();
  }
}

// Option card click handler — auto-advance on selection
document.querySelectorAll('.option-card').forEach(card => {
  card.addEventListener('click', () => {
    const step = card.closest('.quiz-step');
    const key = step.dataset.key;
    const value = card.dataset.value;
    step.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    preferences[key] = value;
    setTimeout(nextStep, 380);
  });
});

// Map IP geolocation city names to our city keys
const CITY_MAP = {
  aalborg: 'aalborg',
  aarhus: 'aarhus',
  århus: 'aarhus',
  copenhagen: 'copenhagen',
  københavn: 'copenhagen',
  kobenhavn: 'copenhagen',
};

function normalizeCity(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'aa');
  const direct = name.toLowerCase().trim();
  return CITY_MAP[direct] || CITY_MAP[n] || null;
}

async function detectCity() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return normalizeCity(data.city);
  } catch {
    return null;
  }
}

// Load cities from API and render as cards
async function loadCities() {
  const grid = document.getElementById('cityGrid');
  try {
    const [citiesRes, detectedCity] = await Promise.all([
      fetch('/api/cities').then(r => r.json()),
      detectCity(),
    ]);

    if (!citiesRes.length) {
      grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">Ingen byer tilgængelige endnu.</p>';
      return;
    }

    grid.innerHTML = citiesRes.map(c => `
      <button class="option-card city-card" data-value="${c.value}">
        <span class="option-label">${c.label}</span>
      </button>
    `).join('');

    grid.querySelectorAll('.city-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.city-card').forEach(c => c.classList.remove('selected'));
        card.classList.remove('auto-detected');
        card.classList.add('selected');
        preferences.city = card.dataset.value;
        setTimeout(nextStep, 380);
      });
    });

    // Auto-select detected city if it exists in our list
    if (detectedCity) {
      const match = grid.querySelector(`.city-card[data-value="${detectedCity}"]`);
      if (match) {
        match.classList.add('selected', 'auto-detected');
        preferences.city = detectedCity;
        setTimeout(nextStep, 1800);
      }
    }
  } catch {
    grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">Kunne ikke hente byer.</p>';
  }
}

loadCities();
updateProgress();
