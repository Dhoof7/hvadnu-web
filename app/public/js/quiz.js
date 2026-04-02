const preferences = {};
const steps = document.querySelectorAll('.quiz-step');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const TOTAL_STEPS = steps.length;

let currentStep = 1;

function updateProgress() {
  const pct = ((currentStep - 1) / TOTAL_STEPS) * 100;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;
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
  preferences.lang = getCurrentLang();
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

// City autocomplete
const cityInput = document.getElementById('cityInput');
const cityDropdown = document.getElementById('cityDropdown');
const submitBtn = document.getElementById('submitBtn');
const skipCity = document.getElementById('skipCity');

cityInput.addEventListener('input', () => {
  const q = cityInput.value.trim().toLowerCase();
  if (q.length < 1) { cityDropdown.innerHTML = ''; return; }
  const aliases = { 'københavn': 'copenhagen', 'kobenhavn': 'copenhagen', 'aarhus': 'aarhus', 'arhus': 'aarhus' };
  const qNorm = aliases[q] || q;
  const matches = CITIES.filter(c => c.toLowerCase().startsWith(q) || c.toLowerCase().startsWith(qNorm)).slice(0, 6);
  if (!matches.length) { cityDropdown.innerHTML = ''; return; }
  cityDropdown.innerHTML = matches.map(c => `<li class="city-dropdown-item">${c}</li>`).join('');
  cityDropdown.querySelectorAll('.city-dropdown-item').forEach(li => {
    li.addEventListener('click', () => {
      cityInput.value = li.textContent;
      cityDropdown.innerHTML = '';
    });
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('.city-input-wrap')) cityDropdown.innerHTML = '';
});

submitBtn.addEventListener('click', () => {
  preferences.city = cityInput.value.trim();
  nextStep();
});

cityInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    cityDropdown.innerHTML = '';
    preferences.city = cityInput.value.trim();
    nextStep();
  }
});

skipCity.addEventListener('click', e => {
  e.preventDefault();
  preferences.city = '';
  nextStep();
});

// Init
updateProgress();
