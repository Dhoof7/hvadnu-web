let allListings = [];
let activeCity = '';

const CITY_LABELS = {
  copenhagen: 'København', københavn: 'København',
  aarhus: 'Aarhus', aalborg: 'Aalborg',
  odense: 'Odense', lystrup: 'Lystrup',
};

function cityLabel(c) {
  return CITY_LABELS[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : c);
}

function listingPlaceholderGradient(id) {
  const colors = [
    ['#0d2247','#1a3a6e'], ['#e8621a','#f08040'],
    ['#1a237e','#283593'], ['#1b5e20','#2e7d32'],
    ['#880e4f','#ad1457'], ['#37474f','#546e7a'],
  ];
  let hash = 0;
  for (const c of (id || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  const [a, b] = colors[Math.abs(hash) % colors.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function renderCard(l) {
  const bg = l.image_url
    ? `background:url('${l.image_url}') center/cover no-repeat`
    : `background:${listingPlaceholderGradient(l.id)}`;

  const amenityIcons = { WiFi: '📶', Parkering: '🅿️', Køkken: '🍳', Vaskemaskine: '🫧', TV: '📺', Aircondition: '❄️' };
  const topAmenities = (l.amenities || []).slice(0, 3).map(a => `<span class="bk-amenity">${amenityIcons[a] || '✓'} ${a}</span>`).join('');

  return `
    <a href="/listing?id=${l.id}" class="bk-card">
      <div class="bk-card-img" style="${bg}">
        <span class="bk-city-tag">${cityLabel(l.city)}</span>
      </div>
      <div class="bk-card-body">
        <h3 class="bk-card-title">${l.title}</h3>
        ${l.address ? `<p class="bk-card-addr">${l.address}</p>` : ''}
        ${topAmenities ? `<div class="bk-amenities">${topAmenities}</div>` : ''}
        <div class="bk-card-footer">
          <span class="bk-price"><strong>${Number(l.price_per_night).toLocaleString('da-DK')} kr</strong> / nat</span>
          <span class="bk-guests">op til ${l.max_guests} gæster</span>
        </div>
      </div>
    </a>
  `;
}

function renderGrid(listings) {
  const grid = document.getElementById('listingsGrid');
  if (!listings.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--muted);">Ingen opslag fundet for denne by.</div>';
    return;
  }
  grid.innerHTML = listings.map(renderCard).join('');
}

function buildCityFilters(listings) {
  const cities = [...new Set(listings.map(l => l.city).filter(Boolean))].sort();
  const wrap = document.getElementById('cityFilters');
  const btns = cities.map(c =>
    `<button class="bk-filter-btn" data-city="${c}">${cityLabel(c)}</button>`
  ).join('');
  wrap.innerHTML = `<button class="bk-filter-btn active" data-city="">Alle byer</button>${btns}`;

  wrap.querySelectorAll('.bk-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.bk-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCity = btn.dataset.city;
      const filtered = activeCity ? allListings.filter(l => l.city === activeCity) : allListings;
      renderGrid(filtered);
    });
  });
}

async function loadListings() {
  const grid = document.getElementById('listingsGrid');
  try {
    const res = await fetch('/api/listings');
    if (!res.ok) throw new Error('Serverfejl');
    allListings = await res.json();
    if (!Array.isArray(allListings)) throw new Error('Ugyldig data');
    buildCityFilters(allListings);
    renderGrid(allListings);
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--muted);">Kunne ikke hente opslag. Prøv igen.</div>`;
  }
}

loadListings();
