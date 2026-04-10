// ===== DateRangePicker =====
class DateRangePicker {
  constructor(el, bookedRanges, onChange) {
    this.el = el;
    this.booked = bookedRanges.map(r => ({
      start: new Date(r.check_in + 'T00:00:00'),
      end:   new Date(r.check_out + 'T00:00:00'),
    }));
    this.onChange = onChange;
    this.checkIn  = null;
    this.checkOut = null;
    const now = new Date();
    this.viewYear  = now.getFullYear();
    this.viewMonth = now.getMonth();
    this.render();
  }

  isBooked(d) { return this.booked.some(r => d >= r.start && d < r.end); }
  inRange(d)  { return this.checkIn && this.checkOut && d > this.checkIn && d < this.checkOut; }

  ds(d) { return d.toISOString().split('T')[0]; }

  renderMonth(year, month) {
    const MN = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];
    const today = new Date(); today.setHours(0,0,0,0);
    const firstDay    = new Date(year, month, 1).getDay();
    const offset      = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `<div class="cal-month"><div class="cal-month-name">${MN[month]} ${year}</div><div class="cal-grid">`;
    ['Ma','Ti','On','To','Fr','Lø','Sø'].forEach(d => { html += `<div class="cal-dn">${d}</div>`; });
    for (let i = 0; i < offset; i++) html += '<div></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const ds   = this.ds(date);
      const past   = date < today;
      const booked = this.isBooked(date);
      const isCI   = this.checkIn  && ds === this.ds(this.checkIn);
      const isCO   = this.checkOut && ds === this.ds(this.checkOut);
      const range  = this.inRange(date);

      let cls = 'cal-d';
      if      (past)   cls += ' cal-past';
      else if (booked) cls += ' cal-booked';
      else             cls += ' cal-avail';
      if (isCI || isCO) cls += ' cal-sel';
      if (range)        cls += ' cal-range';

      const clickable = !past && !booked;
      html += `<div class="${cls}"${clickable ? ` data-d="${ds}"` : ''}>${d}</div>`;
    }
    html += '</div></div>';
    return html;
  }

  render() {
    const y2 = this.viewMonth === 11 ? this.viewYear + 1 : this.viewYear;
    const m2 = (this.viewMonth + 1) % 12;

    this.el.innerHTML = `
      <div class="cal-wrap">
        <div class="cal-nav-row">
          <button class="cal-btn" id="calPrev">‹</button>
          <div class="cal-months">${this.renderMonth(this.viewYear, this.viewMonth)}${this.renderMonth(y2, m2)}</div>
          <button class="cal-btn" id="calNext">›</button>
        </div>
        <p class="cal-hint">
          ${!this.checkIn  ? 'Vælg check-in dato' :
            !this.checkOut ? 'Vælg check-out dato' :
            `${fmtDate(this.checkIn)} → ${fmtDate(this.checkOut)}`}
        </p>
      </div>`;

    this.el.querySelector('#calPrev').onclick = () => {
      if (this.viewMonth === 0) { this.viewMonth = 11; this.viewYear--; }
      else this.viewMonth--;
      this.render();
    };
    this.el.querySelector('#calNext').onclick = () => {
      if (this.viewMonth === 11) { this.viewMonth = 0; this.viewYear++; }
      else this.viewMonth++;
      this.render();
    };
    this.el.querySelectorAll('[data-d]').forEach(cell => {
      cell.onclick = () => this.handleClick(cell.dataset.d);
    });
  }

  handleClick(ds) {
    const date = new Date(ds + 'T00:00:00');
    if (!this.checkIn || (this.checkIn && this.checkOut)) {
      this.checkIn = date; this.checkOut = null;
    } else if (date <= this.checkIn) {
      this.checkIn = date; this.checkOut = null;
    } else {
      // Reject if any booked night falls inside the range
      const conflict = this.booked.some(r => r.start < date && r.end > this.checkIn);
      if (conflict) { this.checkIn = date; this.checkOut = null; }
      else {
        this.checkOut = date;
        this.onChange(this.ds(this.checkIn), this.ds(this.checkOut));
      }
    }
    this.render();
  }

  getSelection() {
    if (!this.checkIn || !this.checkOut) return null;
    return { checkIn: this.ds(this.checkIn), checkOut: this.ds(this.checkOut) };
  }
}

// ===== Helpers =====
function fmtDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d + 'T00:00:00');
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function nightsBetween(ci, co) {
  return Math.round((new Date(co + 'T00:00:00') - new Date(ci + 'T00:00:00')) / 86400000);
}

// ===== State =====
let listing   = null;
let picker    = null;
let selection = null;

const params = new URLSearchParams(location.search);
const listingId = params.get('id');

if (!listingId) {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('errorScreen').style.display = 'flex';
}

// ===== Load listing =====
async function loadListing() {
  try {
    const [lRes, uRes] = await Promise.all([
      fetch(`/api/listings/${listingId}`),
      fetch(`/api/listings/${listingId}/unavailable`),
    ]);
    if (!lRes.ok) throw new Error('not found');
    listing = await lRes.json();
    const unavailable = await uRes.json();

    document.title = `${listing.title} · UdNu`;
    renderListing(listing, unavailable);
  } catch {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'flex';
  }
}

function renderListing(l, unavailable) {
  // Hero
  const hero = document.getElementById('lstHero');
  if (l.image_url) {
    hero.style.backgroundImage = `url('${l.image_url}')`;
    hero.style.backgroundSize = 'cover';
    hero.style.backgroundPosition = 'center';
  } else {
    const colors = ['#0d2247,#1a3a6e','#1a237e,#283593','#37474f,#546e7a'];
    let hash = 0; for (const c of l.id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    const [a, b] = colors[Math.abs(hash) % colors.length].split(',');
    hero.style.background = `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
  }

  // Info
  document.getElementById('lstCity').textContent = l.city.charAt(0).toUpperCase() + l.city.slice(1);
  document.getElementById('lstTitle').textContent = l.title;
  document.getElementById('lstMeta').innerHTML = `
    <span>Op til ${l.max_guests} gæster</span>
    <span style="margin:0 8px;color:var(--border);">|</span>
    <span>${l.city.charAt(0).toUpperCase() + l.city.slice(1)}</span>
    ${l.address ? `<span style="margin:0 8px;color:var(--border);">|</span><span>${l.address}</span>` : ''}
  `;

  if (l.description) document.getElementById('lstDesc').textContent = l.description;

  if (l.amenities && l.amenities.length) {
    document.getElementById('lstAmenities').innerHTML = `
      <div style="margin-top:24px;">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">Faciliteter</h3>
        <div class="lst-amenities-grid">
          ${l.amenities.map(a => `<div class="lst-amenity-item">${a}</div>`).join('')}
        </div>
      </div>`;
  }

  // Price header
  document.getElementById('lstPriceHeader').innerHTML = `
    <span class="lst-price-big">${Number(l.price_per_night).toLocaleString('da-DK')} kr</span>
    <span style="color:var(--muted);font-size:14px;"> / nat</span>
  `;

  // Calendar
  picker = new DateRangePicker(
    document.getElementById('calContainer'),
    Array.isArray(unavailable) ? unavailable : [],
    (ci, co) => { selection = { ci, co }; updateBookingUI(ci, co); }
  );

  // Show/hide login prompt
  checkAuthForBooking();

  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('listingContent').style.display = 'block';
}

function updateBookingUI(ci, co) {
  const nights = nightsBetween(ci, co);
  const total  = nights * listing.price_per_night;
  document.getElementById('bookingSummary').style.display = 'block';
  document.getElementById('bookingSummary').innerHTML = `
    <div class="bk-sum-row"><span>${fmtDate(ci)} → ${fmtDate(co)}</span><span>${nights} nætter</span></div>
    <div class="bk-sum-row"><span>${Number(listing.price_per_night).toLocaleString('da-DK')} kr × ${nights}</span><span>${Number(total).toLocaleString('da-DK')} kr</span></div>
    <div class="bk-sum-total"><span>Total</span><span>${Number(total).toLocaleString('da-DK')} kr</span></div>
  `;
  const gf = document.getElementById('guestFields');
  gf.style.display = 'flex';
  document.getElementById('bookBtn').style.display = 'block';
}

async function checkAuthForBooking() {
  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (session) {
      document.getElementById('loginPrompt').style.display = 'none';
    } else {
      document.getElementById('bookBtn').style.display = 'none';
      document.getElementById('loginPrompt').style.display = 'block';
      // Show book button after login
      _sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          document.getElementById('loginPrompt').style.display = 'none';
          if (selection) document.getElementById('bookBtn').style.display = 'block';
        }
      });
    }
  } catch {}
}

async function submitBooking() {
  const btn = document.getElementById('bookBtn');
  const msg = document.getElementById('bookMsg');
  const sel = picker.getSelection();
  if (!sel) { msg.textContent = 'Vælg datoer først.'; msg.className = 'lst-book-msg error'; return; }

  const guests         = parseInt(document.getElementById('guestsInput').value) || 1;
  const guest_first_name = document.getElementById('guestFirstName').value.trim();
  const guest_last_name  = document.getElementById('guestLastName').value.trim();
  const guest_email      = document.getElementById('guestEmail').value.trim();
  const guest_phone      = document.getElementById('guestPhone').value.trim();
  const guest_address    = document.getElementById('guestAddress').value.trim();
  const message          = document.getElementById('msgInput').value.trim();

  if (!guest_first_name || !guest_last_name) { msg.textContent = 'Indtast dit navn.'; msg.className = 'lst-book-msg error'; return; }
  if (!guest_email) { msg.textContent = 'Indtast din e-mail.'; msg.className = 'lst-book-msg error'; return; }
  if (!guest_phone) { msg.textContent = 'Indtast dit telefonnummer.'; msg.className = 'lst-book-msg error'; return; }

  btn.disabled = true;
  btn.textContent = 'Sender...';
  msg.textContent = '';

  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { openAuthModal('login'); btn.disabled = false; btn.textContent = 'Send bookingforespørgsel'; return; }

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        listing_id: listingId,
        check_in:   sel.checkIn,
        check_out:  sel.checkOut,
        guests,
        message,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        guest_address,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || 'Noget gik galt. Prøv igen.';
      msg.className = 'lst-book-msg error';
      btn.disabled = false;
      btn.textContent = 'Send bookingforespørgsel';
      return;
    }

    msg.textContent = 'Forespørgsel sendt! Udlejeren skal godkende inden bookingen er bekræftet.';
    msg.className = 'lst-book-msg success';
    btn.style.display = 'none';
    document.getElementById('guestFields').style.display = 'none';
    picker.checkIn = null; picker.checkOut = null;
    picker.render();
    document.getElementById('bookingSummary').style.display = 'none';
    selection = null;
  } catch {
    msg.textContent = 'Netværksfejl. Prøv igen.';
    msg.className = 'lst-book-msg error';
    btn.disabled = false;
    btn.textContent = 'Send bookingforespørgsel';
  }
}

window.submitBooking = submitBooking;

if (listingId) loadListing();
