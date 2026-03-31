const plan = JSON.parse(localStorage.getItem('selectedPlan') || 'null');
const preferences = JSON.parse(localStorage.getItem('preferences') || '{}');

if (!plan) {
  window.location.href = 'results.html';
}

// Set page title
document.title = `${plan.title} · What Should We Do Today?`;

// Populate hero
document.getElementById('planEmoji').textContent = plan.emoji || '✨';
document.getElementById('planTitle').textContent = plan.title;
document.getElementById('planTagline').textContent = plan.tagline;

// Stats
const statsEl = document.getElementById('planStats');
statsEl.innerHTML = `
  <div class="plan-stat"><span class="plan-stat-icon">💰</span> ${plan.priceLevel} · ${plan.totalCost}</div>
  <span class="plan-stat-sep">|</span>
  <div class="plan-stat"><span class="plan-stat-icon">⏱</span> ${plan.totalTime}</div>
  <span class="plan-stat-sep">|</span>
  <div class="plan-stat"><span class="plan-stat-icon">📍</span> ${plan.steps ? plan.steps.length : 0} stops</div>
`;

// Why section
document.getElementById('planWhy').textContent = plan.why;

// Good for tags
const goodForEl = document.getElementById('goodForTags');
if (plan.goodFor && plan.goodFor.length) {
  goodForEl.innerHTML = plan.goodFor.map(g => `<span class="good-for-tag">${g}</span>`).join('');
}

function renderYelpCard(y) {
  if (!y) return '';
  const stars = '★'.repeat(Math.round(y.rating)) + '☆'.repeat(5 - Math.round(y.rating));
  return `
    <div class="yelp-card">
      ${y.image ? `<img class="yelp-image" src="${y.image}" alt="${y.name}" loading="lazy">` : ''}
      <div class="yelp-info">
        <div class="yelp-top">
          <span class="yelp-name">${y.name}</span>
          <span class="yelp-badge">Yelp</span>
        </div>
        <div class="yelp-meta">
          <span class="yelp-stars">${stars}</span>
          <span class="yelp-rating-num">${y.rating}</span>
          <span class="yelp-dot">·</span>
          <span>${y.reviewCount} reviews</span>
          ${y.price ? `<span class="yelp-dot">·</span><span>${y.price}</span>` : ''}
        </div>
        ${y.address ? `<div class="yelp-address">📍 ${y.address}</div>` : ''}
        <a href="${y.url}" target="_blank" rel="noopener" class="yelp-link">View on Yelp ↗</a>
      </div>
    </div>
  `;
}

// Timeline
const timelineEl = document.getElementById('planTimeline');
if (plan.steps && plan.steps.length) {
  timelineEl.innerHTML = plan.steps.map(step => {
    const mapsUrl = buildMapsUrl(step.mapSearch, preferences.city);
    return `
      <div class="timeline-step">
        <div class="step-num-circle">${step.order}</div>
        <div class="step-content">
          <div class="step-header">
            <span class="step-name">${step.name}</span>
            <span class="step-type-badge">${step.type}</span>
          </div>
          <p class="step-activity">${step.activity}</p>
          <div class="step-meta">
            <span>⏱ ${step.duration}</span>
            <span>💰 ${step.estimatedCost}</span>
          </div>
          ${step.tip ? `<div class="step-tip">${step.tip}</div>` : ''}
          <a href="${mapsUrl}" target="_blank" rel="noopener" class="step-map-link">
            🗺 Find on Google Maps
          </a>
          ${step.bookable ? `<a href="https://www.thefork.com/search#query=${encodeURIComponent(step.name + ' ' + (preferences.city || ''))}" target="_blank" rel="noopener" class="step-book-link">🍽 Book a table →</a>` : ''}
          ${renderYelpCard(step.yelpPlace)}
        </div>
      </div>
    `;
  }).join('');
}

// Map links section
const mapLinksEl = document.getElementById('mapLinks');
if (plan.steps && plan.steps.length) {
  mapLinksEl.innerHTML = plan.steps.map(step => {
    const mapsUrl = buildMapsUrl(step.mapSearch, preferences.city);
    return `
      <a href="${mapsUrl}" target="_blank" rel="noopener" class="map-link-btn">
        <div>
          <strong>${step.name}</strong>
          <span style="display:block; font-size:12px; color:var(--muted); margin-top:2px;">${step.type} · ${step.duration}</span>
        </div>
        <span class="map-link-icon">↗</span>
      </a>
    `;
  }).join('');
}

// Initialize Leaflet map with a default center
// (We use OSM geocoding to find city center; fallback to world view)
function initMap() {
  const map = L.map('map').setView([51.505, -0.09], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const city = preferences.city || '';

  if (city) {
    // Geocode the city using Nominatim
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`)
      .then(r => r.json())
      .then(results => {
        if (results && results[0]) {
          const { lat, lon, display_name } = results[0];
          map.setView([parseFloat(lat), parseFloat(lon)], 13);

          // Add a marker for each step (geocoding step names would require more API calls)
          // Instead, add a single city marker with plan info
          const marker = L.marker([parseFloat(lat), parseFloat(lon)])
            .addTo(map)
            .bindPopup(`<strong>${plan.title}</strong><br>${plan.steps.length} stops planned in ${city}`)
            .openPopup();
        }
      })
      .catch(() => {
        // Geocoding failed, map stays at default
      });
  }

  return map;
}

// Wait for Leaflet to load
if (typeof L !== 'undefined') {
  initMap();
} else {
  window.addEventListener('load', initMap);
}

function buildMapsUrl(searchQuery, city) {
  const query = city ? `${searchQuery} ${city}` : searchQuery;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
