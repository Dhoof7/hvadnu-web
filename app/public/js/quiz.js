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
  const backBtn = document.getElementById('quizBackBtn');
  if (backBtn) backBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';
}

function prevStep() {
  if (currentStep > 1) {
    let prev = currentStep - 1;
    if (prev === 5 && preferences.days > 1) prev = 4;
    showStep(prev);
  }
}

function showStep(n) {
  steps.forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`.quiz-step[data-step="${n}"]`);
  if (target) target.classList.add('active');
  currentStep = n;
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitQuiz() {
  preferences.lang = 'da';
  localStorage.removeItem('plans');
  localStorage.setItem('preferences', JSON.stringify(preferences));

  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    window._afterLogin = () => { window.location.href = '/results'; };
    openAuthModal('login');
    return;
  }
  window.location.href = '/results';
}

function nextStep() {
  if (currentStep < TOTAL_STEPS) {
    let next = currentStep + 1;
    if (next === 5 && preferences.days > 1) next = 6;
    showStep(next);
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
    preferences[key] = key === 'days' ? parseInt(value) : value;
    setTimeout(nextStep, 380);
  });
});

// Load cities from API and render as cards
async function loadCities() {
  const grid = document.getElementById('cityGrid');
  try {
    const res = await fetch('/api/cities');
    const cities = await res.json();
    if (!cities.length) {
      grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">Ingen byer tilgængelige endnu.</p>';
      return;
    }
    grid.innerHTML = cities.map(c => `
      <button class="option-card city-card" data-value="${c.value}">
        <span class="option-label">${c.label}</span>
      </button>
    `).join('');
    grid.querySelectorAll('.city-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.city-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        preferences.city = card.dataset.value;
        setTimeout(nextStep, 380);
      });
    });
  } catch {
    grid.innerHTML = '<p style="color:var(--muted);font-size:14px;">Kunne ikke hente byer.</p>';
  }
}

loadCities();
updateProgress();
