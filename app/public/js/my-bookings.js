function fmtDate(ds) {
  if (!ds) return '–';
  return new Date(ds + 'T00:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nightsBetween(ci, co) {
  return Math.round((new Date(co + 'T00:00:00') - new Date(ci + 'T00:00:00')) / 86400000);
}

function statusBadge(status) {
  return status === 'confirmed'
    ? '<span class="dash-status confirmed">Bekræftet</span>'
    : '<span class="dash-status cancelled">Annulleret</span>';
}

// ===== Tab switching =====
function switchTab(tab) {
  ['bookings', 'host', 'listings', 'create'].forEach(t => {
    document.getElementById(`tab${t.charAt(0).toUpperCase()+t.slice(1)}`).style.display = t === tab ? 'block' : 'none';
    document.querySelector(`[data-tab="${t}"]`).classList.toggle('active', t === tab);
  });
}
window.switchTab = switchTab;

// ===== Render my bookings (guest) =====
function renderBookings(bookings) {
  const el = document.getElementById('bookingsList');
  if (!bookings.length) {
    el.innerHTML = '<div class="dash-empty">Du har ingen bookinger endnu. <a href="/booking">Find et opslag →</a></div>';
    return;
  }

  el.innerHTML = bookings.map(b => {
    const listing = b.listings || {};
    const nights = nightsBetween(b.check_in, b.check_out);
    return `
      <div class="dash-item" id="bk-${b.id}">
        <div class="dash-item-img" style="${listing.image_url ? `background:url('${listing.image_url}') center/cover` : 'background:linear-gradient(135deg,#0d2247,#1a3a6e)'}"></div>
        <div class="dash-item-body">
          <div class="dash-item-top">
            <h3>${listing.title || 'Opslag'}</h3>
            ${statusBadge(b.status)}
          </div>
          <p style="color:var(--muted);font-size:13px;margin:4px 0;">
            📍 ${listing.city ? listing.city.charAt(0).toUpperCase()+listing.city.slice(1) : ''}
            ${listing.address ? ' · ' + listing.address : ''}
          </p>
          <p style="font-size:14px;margin:8px 0 4px;">
            📅 ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}
            <span style="color:var(--muted);"> (${nights} nætter)</span>
          </p>
          <p style="font-size:14px;font-weight:600;">
            ${Number(b.total_price).toLocaleString('da-DK')} kr i alt
          </p>
        </div>
        <div class="dash-item-actions">
          <a href="/listing?id=${b.listing_id}" class="dash-action-btn">Se opslag</a>
          ${b.status === 'confirmed' ? `<button class="dash-action-btn danger" onclick="cancelBooking('${b.id}')">Annuller</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===== Cancel booking =====
async function cancelBooking(id) {
  if (!confirm('Er du sikker på, at du vil annullere denne booking?')) return;
  const btn = document.querySelector(`#bk-${id} .danger`);
  if (btn) { btn.disabled = true; btn.textContent = 'Annullerer...'; }

  try {
    const { data: { session } } = await _sb.auth.getSession();
    const res = await fetch(`/api/bookings/${id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const item = document.getElementById(`bk-${id}`);
      if (item) {
        item.querySelector('.dash-status').outerHTML = '<span class="dash-status cancelled">Annulleret</span>';
        if (btn) btn.remove();
      }
    } else {
      const d = await res.json();
      alert(d.error || 'Kunne ikke annullere.');
      if (btn) { btn.disabled = false; btn.textContent = 'Annuller'; }
    }
  } catch {
    alert('Netværksfejl. Prøv igen.');
    if (btn) { btn.disabled = false; btn.textContent = 'Annuller'; }
  }
}
window.cancelBooking = cancelBooking;

// ===== Render incoming bookings (host view) =====
function renderHostBookings(bookings) {
  const el = document.getElementById('hostBookingsList');
  if (!bookings.length) {
    el.innerHTML = '<div class="dash-empty">Ingen har booket dine opslag endnu.</div>';
    return;
  }

  el.innerHTML = bookings.map(b => {
    const listing = b.listings || {};
    const nights = nightsBetween(b.check_in, b.check_out);
    const statusCls = b.status === 'confirmed' ? 'confirmed' : 'cancelled';
    const statusLabel = b.status === 'confirmed' ? 'Bekræftet' : 'Annulleret';
    return `
      <div class="dash-item">
        <div class="dash-item-img" style="${listing.image_url ? `background:url('${listing.image_url}') center/cover` : 'background:linear-gradient(135deg,#0d2247,#1a3a6e)'}"></div>
        <div class="dash-item-body">
          <div class="dash-item-top">
            <h3>${listing.title || 'Opslag'}</h3>
            <span class="dash-status ${statusCls}">${statusLabel}</span>
          </div>
          <p style="color:var(--muted);font-size:13px;margin:4px 0;">
            📍 ${listing.city ? listing.city.charAt(0).toUpperCase()+listing.city.slice(1) : ''}
            ${listing.address ? ' · ' + listing.address : ''}
          </p>
          <p style="font-size:14px;margin:8px 0 4px;">
            📅 ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}
            <span style="color:var(--muted);"> (${nights} nætter)</span>
          </p>
          <p style="font-size:14px;font-weight:600;">
            ${Number(b.total_price).toLocaleString('da-DK')} kr i alt
          </p>
          ${b.message ? `<p style="font-size:13px;color:var(--muted);margin-top:6px;font-style:italic;">"${b.message}"</p>` : ''}
        </div>
        <div class="dash-item-actions">
          <a href="/listing?id=${b.listing_id}" class="dash-action-btn">Se opslag</a>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Render my listings (host) =====
function renderListings(listings) {
  const el = document.getElementById('listingsList');
  if (!listings.length) {
    el.innerHTML = '<div class="dash-empty">Du har ingen opslag endnu. <button class="dash-action-btn" onclick="switchTab(\'create\')">Opret dit første →</button></div>';
    return;
  }

  el.innerHTML = listings.map(l => `
    <div class="dash-item" id="lst-${l.id}">
      <div class="dash-item-img" style="${l.image_url ? `background:url('${l.image_url}') center/cover` : 'background:linear-gradient(135deg,#0d2247,#1a3a6e)'}"></div>
      <div class="dash-item-body">
        <div class="dash-item-top">
          <h3>${l.title}</h3>
          <span class="dash-status ${l.active ? 'confirmed' : 'cancelled'}">${l.active ? 'Aktivt' : 'Inaktivt'}</span>
        </div>
        <p style="color:var(--muted);font-size:13px;margin:4px 0;">📍 ${l.city.charAt(0).toUpperCase()+l.city.slice(1)}${l.address ? ' · '+l.address : ''}</p>
        <p style="font-size:14px;font-weight:600;margin:8px 0 0;">${Number(l.price_per_night).toLocaleString('da-DK')} kr / nat · op til ${l.max_guests} gæster</p>
      </div>
      <div class="dash-item-actions">
        <a href="/listing?id=${l.id}" class="dash-action-btn">Vis opslag</a>
        ${l.active ? `<button class="dash-action-btn danger" onclick="deactivateListing('${l.id}')">Deaktiver</button>` : ''}
      </div>
    </div>
  `).join('');
}

// ===== Deactivate listing =====
async function deactivateListing(id) {
  if (!confirm('Er du sikker på, at du vil deaktivere dette opslag? Det vil ikke længere være synligt.')) return;
  try {
    const { data: { session } } = await _sb.auth.getSession();
    const res = await fetch(`/api/listings/${id}/deactivate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const item = document.getElementById(`lst-${id}`);
      if (item) {
        item.querySelector('.dash-status').outerHTML = '<span class="dash-status cancelled">Inaktivt</span>';
        const btn = item.querySelector('.danger');
        if (btn) btn.remove();
      }
    } else {
      alert('Kunne ikke deaktivere opslag.');
    }
  } catch {
    alert('Netværksfejl. Prøv igen.');
  }
}
window.deactivateListing = deactivateListing;

// ===== Create listing =====
async function createListing() {
  const btn   = document.getElementById('createBtn');
  const msg   = document.getElementById('createMsg');
  const title = document.getElementById('cfTitle').value.trim();
  const city  = document.getElementById('cfCity').value.trim();
  const price = parseFloat(document.getElementById('cfPrice').value);

  msg.textContent = '';
  if (!title) { msg.textContent = 'Titel er påkrævet.'; msg.className = 'lst-book-msg error'; return; }
  if (!city)  { msg.textContent = 'By er påkrævet.'; msg.className = 'lst-book-msg error'; return; }
  if (!price || price <= 0) { msg.textContent = 'Angiv en gyldig pris.'; msg.className = 'lst-book-msg error'; return; }

  const amenities = [...document.querySelectorAll('.cf-amenities input:checked')].map(i => i.value);

  btn.disabled = true; btn.textContent = 'Opretter...';

  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { openAuthModal('login'); btn.disabled = false; btn.textContent = 'Opret opslag'; return; }

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        title,
        city:            city.toLowerCase(),
        address:         document.getElementById('cfAddress').value.trim(),
        description:     document.getElementById('cfDesc').value.trim(),
        price_per_night: price,
        max_guests:      parseInt(document.getElementById('cfMaxGuests').value) || 2,
        image_url:       document.getElementById('cfImage').value.trim() || null,
        amenities,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || 'Fejl ved oprettelse.';
      msg.className = 'lst-book-msg error';
      btn.disabled = false; btn.textContent = 'Opret opslag';
      return;
    }

    msg.textContent = '✓ Opslag oprettet! Det er nu synligt for andre.';
    msg.className = 'lst-book-msg success';
    btn.disabled = false; btn.textContent = 'Opret opslag';

    // Reset form
    ['cfTitle','cfCity','cfAddress','cfDesc','cfPrice','cfImage'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('cfMaxGuests').value = '2';
    document.querySelectorAll('.cf-amenities input').forEach(i => { i.checked = false; });

    // Refresh listings tab and switch to it
    const listingsRes = await fetch('/api/my-listings', { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (listingsRes.ok) renderListings(await listingsRes.json());
    setTimeout(() => switchTab('listings'), 1500);
  } catch {
    msg.textContent = 'Netværksfejl. Prøv igen.';
    msg.className = 'lst-book-msg error';
    btn.disabled = false; btn.textContent = 'Opret opslag';
  }
}
window.createListing = createListing;

// ===== Init =====
async function initDashboard() {
  const { data: { session } } = await _sb.auth.getSession();

  if (!session) {
    document.getElementById('notLoggedIn').style.display = 'block';
    _sb.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN') { document.getElementById('notLoggedIn').style.display = 'none'; loadData(s); }
    });
    return;
  }

  loadData(session);
}

async function loadData(session) {
  document.getElementById('dashboardContent').style.display = 'block';

  const name = session.user.user_metadata?.full_name || session.user.email || '';
  document.getElementById('dashUserName').textContent = name;

  const [bRes, lRes] = await Promise.all([
    fetch('/api/my-bookings',  { headers: { Authorization: `Bearer ${session.access_token}` } }),
    fetch('/api/my-listings',  { headers: { Authorization: `Bearer ${session.access_token}` } }),
  ]);

  if (bRes.ok) renderBookings(await bRes.json());
  if (lRes.ok) renderListings(await lRes.json());
}

initDashboard();
