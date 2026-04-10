function fmtDate(ds) {
  if (!ds) return '–';
  return new Date(ds + 'T00:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nightsBetween(ci, co) {
  return Math.round((new Date(co + 'T00:00:00') - new Date(ci + 'T00:00:00')) / 86400000);
}

function statusBadge(status) {
  if (status === 'confirmed') return '<span class="dash-status confirmed">Bekræftet</span>';
  if (status === 'pending')   return '<span class="dash-status pending">Afventer</span>';
  return '<span class="dash-status cancelled">Annulleret</span>';
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
    el.innerHTML = '<div class="dash-empty">Du har ingen bookinger endnu. <a href="/booking">Find et opslag</a></div>';
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
            ${listing.city ? listing.city.charAt(0).toUpperCase()+listing.city.slice(1) : ''}
            ${listing.address ? ' · ' + listing.address : ''}
          </p>
          <p style="font-size:14px;margin:8px 0 4px;">
            ${fmtDate(b.check_in)} &rarr; ${fmtDate(b.check_out)}
            <span style="color:var(--muted);"> (${nights} nætter)</span>
          </p>
          <p style="font-size:14px;font-weight:600;">${Number(b.total_price).toLocaleString('da-DK')} kr i alt</p>
          ${b.status === 'pending' ? '<p style="font-size:12px;color:var(--muted);margin-top:4px;">Afventer godkendelse fra udlejer</p>' : ''}
        </div>
        <div class="dash-item-actions">
          <a href="/listing?id=${b.listing_id}" class="dash-action-btn">Se opslag</a>
          ${b.status !== 'cancelled' ? `<button class="dash-action-btn danger" onclick="cancelBooking('${b.id}')">Annuller</button>` : ''}
        </div>
      </div>`;
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
    return `
      <div class="dash-item" id="hbk-${b.id}">
        <div class="dash-item-img" style="${listing.image_url ? `background:url('${listing.image_url}') center/cover` : 'background:linear-gradient(135deg,#0d2247,#1a3a6e)'}"></div>
        <div class="dash-item-body">
          <div class="dash-item-top">
            <h3>${listing.title || 'Opslag'}</h3>
            ${statusBadge(b.status)}
          </div>
          <p style="color:var(--muted);font-size:13px;margin:4px 0;">
            ${listing.city ? listing.city.charAt(0).toUpperCase()+listing.city.slice(1) : ''}
            ${listing.address ? ' · ' + listing.address : ''}
          </p>
          <p style="font-size:14px;margin:8px 0 4px;">
            ${fmtDate(b.check_in)} &rarr; ${fmtDate(b.check_out)}
            <span style="color:var(--muted);"> (${nights} nætter)</span>
          </p>
          <p style="font-size:14px;font-weight:600;">${Number(b.total_price).toLocaleString('da-DK')} kr i alt</p>
          ${b.guest_first_name ? `<p style="font-size:13px;margin-top:6px;">Gæst: <strong>${b.guest_first_name} ${b.guest_last_name}</strong></p>` : ''}
          ${b.guest_email ? `<p style="font-size:13px;color:var(--muted);">${b.guest_email} &middot; ${b.guest_phone || ''}</p>` : ''}
          ${b.guest_address ? `<p style="font-size:13px;color:var(--muted);">${b.guest_address}</p>` : ''}
          ${b.message ? `<p style="font-size:13px;color:var(--muted);font-style:italic;margin-top:4px;">"${b.message}"</p>` : ''}
        </div>
        <div class="dash-item-actions">
          ${b.status === 'pending' ? `
            <button class="dash-action-btn approve" onclick="approveBooking('${b.id}')">Godkend</button>
            <button class="dash-action-btn danger" onclick="rejectBooking('${b.id}')">Afvis</button>
          ` : ''}
          <a href="/listing?id=${b.listing_id}" class="dash-action-btn">Se opslag</a>
        </div>
      </div>`;
  }).join('');
}

// ===== Approve booking =====
async function approveBooking(id) {
  if (!confirm('Godkend denne booking?')) return;
  const btn = document.querySelector(`#hbk-${id} .approve`);
  if (btn) { btn.disabled = true; btn.textContent = 'Godkender...'; }
  try {
    const { data: { session } } = await _sb.auth.getSession();
    const res = await fetch(`/api/bookings/${id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const d = await res.json();
    if (res.ok) {
      const item = document.getElementById(`hbk-${id}`);
      if (item) {
        item.querySelector('.dash-status').outerHTML = '<span class="dash-status confirmed">Bekræftet</span>';
        item.querySelectorAll('.approve, .danger').forEach(b => b.remove());
      }
    } else {
      alert(d.error || 'Kunne ikke godkende.');
      if (btn) { btn.disabled = false; btn.textContent = 'Godkend'; }
    }
  } catch {
    alert('Netværksfejl. Prøv igen.');
    if (btn) { btn.disabled = false; btn.textContent = 'Godkend'; }
  }
}
window.approveBooking = approveBooking;

// ===== Reject booking =====
async function rejectBooking(id) {
  if (!confirm('Afvis denne booking?')) return;
  const btn = document.querySelector(`#hbk-${id} .danger`);
  if (btn) { btn.disabled = true; btn.textContent = 'Afviser...'; }
  try {
    const { data: { session } } = await _sb.auth.getSession();
    const res = await fetch(`/api/bookings/${id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const item = document.getElementById(`hbk-${id}`);
      if (item) {
        item.querySelector('.dash-status').outerHTML = '<span class="dash-status cancelled">Afvist</span>';
        item.querySelectorAll('.approve, .danger').forEach(b => b.remove());
      }
    } else {
      const d = await res.json();
      alert(d.error || 'Kunne ikke afvise.');
      if (btn) { btn.disabled = false; btn.textContent = 'Afvis'; }
    }
  } catch {
    alert('Netværksfejl. Prøv igen.');
    if (btn) { btn.disabled = false; btn.textContent = 'Afvis'; }
  }
}
window.rejectBooking = rejectBooking;

// ===== Render my listings (host) =====
function renderListings(listings) {
  const el = document.getElementById('listingsList');
  if (!listings.length) {
    el.innerHTML = '<div class="dash-empty">Du har ingen opslag endnu. <button class="dash-action-btn" onclick="switchTab(\'create\')">Opret dit første</button></div>';
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
        <p style="color:var(--muted);font-size:13px;margin:4px 0;">${l.city.charAt(0).toUpperCase()+l.city.slice(1)}${l.address ? ' · '+l.address : ''}</p>
        <p style="font-size:14px;font-weight:600;margin:8px 0 0;">${Number(l.price_per_night).toLocaleString('da-DK')} kr / nat · op til ${l.max_guests} gæster</p>
      </div>
      <div class="dash-item-actions">
        <a href="/listing?id=${l.id}" class="dash-action-btn">Se opslag</a>
        <button class="dash-action-btn" onclick="openEditModal(${JSON.stringify(l).replace(/"/g,'&quot;')})">Rediger</button>
        <button class="dash-action-btn danger" onclick="deleteListing('${l.id}')">Slet</button>
      </div>
    </div>`).join('');
}

// ===== Deactivate listing =====
async function deactivateListing(id) {
  if (!confirm('Deaktiver dette opslag? Det vil ikke længere være synligt.')) return;
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
  } catch { alert('Netværksfejl. Prøv igen.'); }
}
window.deactivateListing = deactivateListing;

// ===== Delete listing =====
async function deleteListing(id) {
  if (!confirm('Slet dette opslag permanent? Dette kan ikke fortrydes.')) return;
  try {
    const { data: { session } } = await _sb.auth.getSession();
    const res = await fetch(`/api/listings/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      document.getElementById(`lst-${id}`)?.remove();
    } else {
      const d = await res.json();
      alert(d.error || 'Kunne ikke slette opslag.');
    }
  } catch { alert('Netværksfejl. Prøv igen.'); }
}
window.deleteListing = deleteListing;

// ===== Edit listing modal =====
let editingListingId = null;

function openEditModal(l) {
  editingListingId = l.id;
  document.getElementById('eTitleInput').value     = l.title || '';
  document.getElementById('eCityInput').value      = l.city || '';
  document.getElementById('eAddressInput').value   = l.address || '';
  document.getElementById('eDescInput').value      = l.description || '';
  document.getElementById('ePriceInput').value     = l.price_per_night || '';
  document.getElementById('eMaxGuestsInput').value = l.max_guests || 2;
  document.getElementById('eImageInput').value     = '';
  document.getElementById('eImageFile').value      = '';
  document.getElementById('editMsg').textContent   = '';

  // Show existing images as thumbnails
  const existing = document.getElementById('eExistingImages');
  const imgs = l.images && l.images.length ? l.images : (l.image_url ? [l.image_url] : []);
  existing.dataset.images = JSON.stringify(imgs);
  existing.innerHTML = imgs.length
    ? `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Nuværende billeder (${imgs.length})</div>
       <div style="display:flex;gap:8px;flex-wrap:wrap;">${imgs.map(url => `<img src="${url}" style="width:72px;height:56px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border);">`).join('')}</div>
       <p style="font-size:12px;color:var(--muted);margin-top:6px;">Upload nye billeder for at erstatte dem.</p>`
    : '';

  // Set amenity checkboxes
  document.querySelectorAll('#eAmenities input').forEach(cb => {
    cb.checked = Array.isArray(l.amenities) && l.amenities.includes(cb.value);
  });
  document.getElementById('editModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}
window.openEditModal = openEditModal;

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  document.body.style.overflow = '';
}
window.closeEditModal = closeEditModal;

async function uploadImageFile(file, session) {
  if (!session || !file) return null;
  const ext  = file.name.split('.').pop();
  const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await _sb.storage.from('listings').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return _sb.storage.from('listings').getPublicUrl(data.path).data.publicUrl;
}

// Multi-image manager: returns array of URLs (upload files + keep existing URLs)
async function collectImages(fileInputId, urlInputId, session) {
  const urls = [];
  const urlVal = document.getElementById(urlInputId)?.value.trim();
  if (urlVal) urls.push(urlVal);
  const fileInput = document.getElementById(fileInputId);
  if (fileInput?.files) {
    for (const file of fileInput.files) {
      const url = await uploadImageFile(file, session);
      if (url) urls.push(url);
    }
  }
  return urls;
}

async function saveEdit() {
  const btn = document.getElementById('editSaveBtn');
  const msg = document.getElementById('editMsg');
  msg.textContent = '';

  const title      = document.getElementById('eTitleInput').value.trim();
  const city       = document.getElementById('eCityInput').value.trim();
  const price      = parseFloat(document.getElementById('ePriceInput').value);
  if (!title) { msg.textContent = 'Titel er påkrævet.'; msg.className = 'lst-book-msg error'; return; }
  if (!city)  { msg.textContent = 'By er påkrævet.'; msg.className = 'lst-book-msg error'; return; }
  if (!price || price <= 0) { msg.textContent = 'Angiv en gyldig pris.'; msg.className = 'lst-book-msg error'; return; }

  btn.disabled = true; btn.textContent = 'Gemmer...';

  try {
    const { data: { session } } = await _sb.auth.getSession();

    let images;
    try { images = await collectImages('eImageFile', 'eImageInput', session); }
    catch (e) { msg.textContent = 'Billede upload fejlede: ' + e.message; msg.className = 'lst-book-msg error'; btn.disabled = false; btn.textContent = 'Gem ændringer'; return; }

    // Preserve existing images if no new ones provided
    if (!images.length) {
      const existing = document.getElementById('eExistingImages');
      if (existing) images = JSON.parse(existing.dataset.images || '[]');
    }

    const amenities = [...document.querySelectorAll('#eAmenities input:checked')].map(i => i.value);

    const res = await fetch(`/api/listings/${editingListingId}/edit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        title, city, price_per_night: price,
        address:     document.getElementById('eAddressInput').value.trim(),
        description: document.getElementById('eDescInput').value.trim(),
        max_guests:  parseInt(document.getElementById('eMaxGuestsInput').value) || 2,
        amenities, images,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || 'Fejl ved opdatering.';
      msg.className = 'lst-book-msg error';
      btn.disabled = false; btn.textContent = 'Gem ændringer';
      return;
    }

    // Refresh listings
    const lRes = await fetch('/api/my-listings', { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (lRes.ok) renderListings(await lRes.json());
    closeEditModal();
  } catch (e) {
    msg.textContent = 'Netværksfejl. Prøv igen.';
    msg.className = 'lst-book-msg error';
    btn.disabled = false; btn.textContent = 'Gem ændringer';
  }
}
window.saveEdit = saveEdit;

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

  btn.disabled = true; btn.textContent = 'Opretter...';

  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { openAuthModal('login'); btn.disabled = false; btn.textContent = 'Opret opslag'; return; }

    let images;
    try { images = await collectImages('cfImageFile', 'cfImage', session); }
    catch (e) { msg.textContent = 'Billede upload fejlede: ' + e.message; msg.className = 'lst-book-msg error'; btn.disabled = false; btn.textContent = 'Opret opslag'; return; }

    const amenities = [...document.querySelectorAll('.cf-amenities input:checked')].map(i => i.value);

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        title, city: city.toLowerCase(),
        address:         document.getElementById('cfAddress').value.trim(),
        description:     document.getElementById('cfDesc').value.trim(),
        price_per_night: price,
        max_guests:      parseInt(document.getElementById('cfMaxGuests').value) || 2,
        images, amenities,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || 'Fejl ved oprettelse.';
      msg.className = 'lst-book-msg error';
      btn.disabled = false; btn.textContent = 'Opret opslag';
      return;
    }

    msg.textContent = 'Opslag oprettet! Det er nu synligt for andre.';
    msg.className = 'lst-book-msg success';
    btn.disabled = false; btn.textContent = 'Opret opslag';

    ['cfTitle','cfCity','cfAddress','cfDesc','cfPrice','cfImage'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('cfMaxGuests').value = '2';
    document.getElementById('cfImageFile').value = '';
    document.querySelectorAll('.cf-amenities input').forEach(i => { i.checked = false; });

    const lRes = await fetch('/api/my-listings', { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (lRes.ok) renderListings(await lRes.json());
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

  const [bRes, hRes, lRes] = await Promise.all([
    fetch('/api/my-bookings',   { headers: { Authorization: `Bearer ${session.access_token}` } }),
    fetch('/api/host-bookings', { headers: { Authorization: `Bearer ${session.access_token}` } }),
    fetch('/api/my-listings',   { headers: { Authorization: `Bearer ${session.access_token}` } }),
  ]);

  if (bRes.ok) renderBookings(await bRes.json());
  if (hRes.ok) renderHostBookings(await hRes.json());
  if (lRes.ok) renderListings(await lRes.json());
}

initDashboard();
