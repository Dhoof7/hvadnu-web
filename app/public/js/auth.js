// ===== SUPABASE AUTH =====
const SUPABASE_URL = 'https://kqpxhefvnrlsuxmiqhhy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhoZWZ2bnJsc3V4bWlxaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzE4NjEsImV4cCI6MjA5MDgwNzg2MX0.-fw759yENbo2UZTdgzIU4TpjUqOON4ogtpEUYvE8fqA';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ---- inject modal ----
document.body.insertAdjacentHTML('beforeend', `
<div id="authOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;align-items:center;justify-content:center;padding:16px;">
  <div id="authModal" style="background:#fff;border-radius:24px;padding:40px 36px;width:100%;max-width:420px;position:relative;box-shadow:0 24px 80px rgba(0,0,0,.3);">
    <button onclick="closeAuthModal()" style="position:absolute;top:18px;right:22px;background:none;border:none;font-size:24px;cursor:pointer;color:#aaa;line-height:1;">&times;</button>

    <!-- SUCCESS STATE -->
    <div id="authSuccess" style="display:none;text-align:center;padding:20px 0;">
      <div style="font-size:48px;margin-bottom:16px;">📬</div>
      <h2 style="font-family:'Playfair Display',serif;font-size:22px;color:#1a1a28;margin-bottom:10px;">Tjek din indbakke</h2>
      <p style="color:#6b6b6b;font-size:14px;line-height:1.6;" id="authSuccessMsg"></p>
      <button onclick="closeAuthModal()" style="margin-top:24px;padding:12px 32px;background:#1a1a28;color:#fff;border:none;border-radius:50px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">OK</button>
    </div>

    <!-- FORM STATE -->
    <div id="authForm">
      <h2 id="authTitle" style="font-family:'Playfair Display',serif;font-size:26px;margin-bottom:6px;color:#1a1a28;">Log ind</h2>
      <p id="authSub" style="color:#6b6b6b;font-size:14px;margin-bottom:24px;">Gem og genfind dine planer</p>

      <!-- Google button -->
      <button onclick="signInWithGoogle()" id="googleBtn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 16px;border:1.5px solid #e5e0da;border-radius:50px;font-size:14px;font-weight:600;cursor:pointer;background:#fff;color:#1a1a28;font-family:inherit;margin-bottom:20px;transition:background .2s;">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
        Fortsæt med Google
      </button>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="flex:1;height:1px;background:#e5e0da;"></div>
        <span style="color:#aaa;font-size:12px;white-space:nowrap;">eller med email</span>
        <div style="flex:1;height:1px;background:#e5e0da;"></div>
      </div>

      <div id="authError" style="display:none;background:#fde8e8;color:#c0392b;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px;"></div>

      <!-- Name fields (signup only) -->
      <div id="nameFields" style="display:none;gap:10px;margin-bottom:12px;">
        <div style="display:flex;gap:10px;">
          <input id="authFirst" type="text" placeholder="Fornavn" style="flex:1;padding:12px 14px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
          <input id="authLast" type="text" placeholder="Efternavn" style="flex:1;padding:12px 14px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
        </div>
      </div>

      <input id="authEmail" type="email" placeholder="Email" style="width:100%;padding:12px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;margin-bottom:12px;outline:none;font-family:inherit;display:block;">

      <div style="position:relative;margin-bottom:8px;">
        <input id="authPassword" type="password" placeholder="Adgangskode" style="width:100%;padding:12px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;" oninput="checkPasswordStrength(this.value)">
      </div>

      <!-- Password strength (signup only) -->
      <div id="pwStrengthWrap" style="display:none;margin-bottom:16px;">
        <div style="display:flex;gap:4px;margin-bottom:6px;">
          <div id="ps1" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
          <div id="ps2" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
          <div id="ps3" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
          <div id="ps4" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
        </div>
        <p id="pwStrengthLabel" style="font-size:11px;color:#aaa;margin:0;"></p>
      </div>

      <div id="pwHints" style="display:none;margin-bottom:16px;">
        <p id="ph1" style="font-size:12px;color:#aaa;margin:2px 0;">✗ Mindst 8 tegn</p>
        <p id="ph2" style="font-size:12px;color:#aaa;margin:2px 0;">✗ Stort bogstav</p>
        <p id="ph3" style="font-size:12px;color:#aaa;margin:2px 0;">✗ Et tal</p>
        <p id="ph4" style="font-size:12px;color:#aaa;margin:2px 0;">✗ Specialtegn (!@#$...)</p>
      </div>

      <button onclick="submitAuth()" id="authSubmitBtn" style="width:100%;padding:14px;background:#1a1a28;color:#fff;border:none;border-radius:50px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:4px;">Log ind</button>

      <p style="text-align:center;margin-top:14px;font-size:13px;color:#6b6b6b;">
        <span id="authToggleText">Har du ikke en konto?</span>
        <a onclick="toggleAuthMode()" style="color:#d94f3a;cursor:pointer;font-weight:600;margin-left:4px;" id="authToggleLink">Opret konto</a>
      </p>
    </div>
  </div>
</div>
`);

let authMode = 'login';

function openAuthModal(mode) {
  if (mode) { authMode = mode; _applyMode(); }
  document.getElementById('authOverlay').style.display = 'flex';
  document.getElementById('authSuccess').style.display = 'none';
  document.getElementById('authForm').style.display = 'block';
  document.getElementById('authEmail').focus();
}
function closeAuthModal() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('authError').style.display = 'none';
}

function _applyMode() {
  const isLogin = authMode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? 'Log ind' : 'Opret konto';
  document.getElementById('authSub').textContent = isLogin ? 'Velkommen tilbage' : 'Gem og genfind dine planer';
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'Log ind' : 'Opret konto';
  document.getElementById('authToggleText').textContent = isLogin ? 'Har du ikke en konto?' : 'Har du allerede en konto?';
  document.getElementById('authToggleLink').textContent = isLogin ? 'Opret konto' : 'Log ind';
  document.getElementById('nameFields').style.display = isLogin ? 'none' : 'block';
  document.getElementById('pwStrengthWrap').style.display = isLogin ? 'none' : 'block';
  document.getElementById('pwHints').style.display = isLogin ? 'none' : 'block';
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authPassword').value = '';
  checkPasswordStrength('');
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  _applyMode();
}

// Password strength
function checkPasswordStrength(pw) {
  const has8 = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score = [has8, hasUpper, hasNum, hasSpecial].filter(Boolean).length;

  const colors = ['#e5e0da', '#e74c3c', '#e67e22', '#f1c40f', '#27ae60'];
  const labels = ['', 'For svag', 'Svag', 'Okay', 'Stærk'];
  for (let i = 1; i <= 4; i++) {
    document.getElementById('ps' + i).style.background = i <= score ? colors[score] : '#e5e0da';
  }
  document.getElementById('pwStrengthLabel').textContent = pw.length ? labels[score] : '';

  _hint('ph1', has8, 'Mindst 8 tegn');
  _hint('ph2', hasUpper, 'Stort bogstav');
  _hint('ph3', hasNum, 'Et tal');
  _hint('ph4', hasSpecial, 'Specialtegn (!@#$...)');
}
function _hint(id, ok, text) {
  const el = document.getElementById(id);
  el.textContent = (ok ? '✓ ' : '✗ ') + text;
  el.style.color = ok ? '#27ae60' : '#aaa';
}

function isPasswordStrong(pw) {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

async function signInWithGoogle() {
  await _sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmitBtn');
  errEl.style.display = 'none';

  if (authMode === 'signup') {
    const first = document.getElementById('authFirst').value.trim();
    const last = document.getElementById('authLast').value.trim();
    if (!first || !last) { _showErr('Indtast dit for- og efternavn.'); return; }
    if (!isPasswordStrong(password)) { _showErr('Adgangskoden er ikke stærk nok.'); return; }

    btn.textContent = '...'; btn.disabled = true;
    try {
      const { error } = await _sb.auth.signUp({
        email, password,
        options: { data: { full_name: `${first} ${last}`, first_name: first, last_name: last } }
      });
      if (error) throw error;
      document.getElementById('authForm').style.display = 'none';
      document.getElementById('authSuccess').style.display = 'block';
      document.getElementById('authSuccessMsg').textContent = `Vi har sendt en bekræftelsesmail til ${email}. Klik på linket i mailen for at aktivere din konto.`;
    } catch (e) {
      _showErr(translateAuthError(e.message));
    } finally {
      btn.textContent = 'Opret konto'; btn.disabled = false;
    }
  } else {
    btn.textContent = '...'; btn.disabled = true;
    try {
      const { error } = await _sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuthModal();
      updateNavAuth();
      if (window._afterLogin) { window._afterLogin(); window._afterLogin = null; }
    } catch (e) {
      _showErr(translateAuthError(e.message));
    } finally {
      btn.textContent = 'Log ind'; btn.disabled = false;
    }
  }
}

function _showErr(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = 'block';
}

function translateAuthError(msg) {
  if (msg.includes('Invalid login')) return 'Forkert email eller adgangskode.';
  if (msg.includes('Email not confirmed')) return 'Bekræft din email først — tjek din indbakke.';
  if (msg.includes('already registered')) return 'Denne email er allerede registreret. Prøv at logge ind.';
  if (msg.includes('Password should be')) return 'Adgangskode skal være mindst 6 tegn.';
  if (msg.includes('rate limit')) return 'For mange forsøg. Vent lidt og prøv igen.';
  return msg;
}

document.getElementById('authOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeAuthModal();
});

// ---- nav auth button ----
function injectNavAuthBtn() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const btn = document.createElement('button');
  btn.id = 'navAuthBtn';
  btn.style.cssText = 'background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;';
  btn.textContent = 'Log ind';
  btn.addEventListener('click', handleNavAuthClick);
  const langToggle = document.getElementById('langToggle');
  if (langToggle) navbar.insertBefore(btn, langToggle);
  else navbar.appendChild(btn);
}

async function handleNavAuthClick() {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    if (confirm('Vil du logge ud?')) {
      await _sb.auth.signOut();
      updateNavAuth();
    }
  } else {
    openAuthModal('login');
  }
}

async function updateNavAuth() {
  const btn = document.getElementById('navAuthBtn');
  if (!btn) return;
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    const meta = session.user.user_metadata || {};
    const name = meta.first_name || meta.full_name || session.user.email.split('@')[0];
    btn.textContent = `${name} · Mine planer`;
    btn.onclick = () => { window.location.href = '/saved.html'; };
  } else {
    btn.textContent = 'Log ind';
    btn.onclick = handleNavAuthClick;
  }
}

// ---- save plan ----
async function savePlan(plan) {
  if (!plan) return;
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    window._afterLogin = () => savePlan(plan);
    openAuthModal('login');
    return;
  }
  const { error } = await _sb.from('saved_plans').insert({
    user_id: session.user.id,
    title: plan.title,
    emoji: plan.emoji || '✨',
    tagline: plan.tagline || '',
    content: JSON.stringify(plan)
  });
  if (error) { alert('Fejl ved gemning: ' + error.message); return; }
  const btn = document.getElementById('savePlanBtn');
  if (btn) { btn.textContent = 'Gemt!'; btn.disabled = true; btn.style.background = '#27ae60'; }
}

// ---- init ----
injectNavAuthBtn();
updateNavAuth();
