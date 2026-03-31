// Carousel
const track = document.getElementById('cardsTrack');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let currentIndex = 0;

function getVisibleCount() {
  const w = window.innerWidth;
  if (w <= 768) return 1;
  if (w <= 1024) return 2;
  return 3;
}

function getCardWidth() {
  const card = track.querySelector('.card');
  if (!card) return 0;
  const gap = 24;
  return card.offsetWidth + gap;
}

function totalCards() {
  return track.querySelectorAll('.card').length;
}

function maxIndex() {
  return Math.max(0, totalCards() - getVisibleCount());
}

function updateCarousel() {
  const offset = currentIndex * getCardWidth();
  track.style.transform = `translateX(-${offset}px)`;
  prevBtn.style.opacity = currentIndex === 0 ? '0.35' : '1';
  nextBtn.style.opacity = currentIndex >= maxIndex() ? '0.35' : '1';
}

prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    updateCarousel();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < maxIndex()) {
    currentIndex++;
    updateCarousel();
  }
});

window.addEventListener('resize', () => {
  currentIndex = Math.min(currentIndex, maxIndex());
  updateCarousel();
});

updateCarousel();

// Newsletter form
function handleSubmit(e) {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const btn = e.target.querySelector('button');
  btn.textContent = 'Tilmeldt! ✓';
  btn.style.background = '#4caf50';
  btn.style.color = '#fff';
  input.value = '';
  setTimeout(() => {
    btn.textContent = 'Tilmeld nu';
    btn.style.background = '';
    btn.style.color = '';
  }, 3000);
}

// Smooth active nav link
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', function(e) {
    document.querySelectorAll('.nav-links a').forEach(l => l.style.color = '');
    this.style.color = '#fff';
  });
});
