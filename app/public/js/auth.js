// ===== SUPABASE AUTH =====
const SUPABASE_URL = 'https://kqpxhefvnrlsuxmiqhhy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhoZWZ2bnJsc3V4bWlxaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzE4NjEsImV4cCI6MjA5MDgwNzg2MX0.-fw759yENbo2UZTdgzIU4TpjUqOON4ogtpEUYvE8fqA';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ---- inject auth modal ----
document.body.insertAdjacentHTML('beforeend', `
<div id="authOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;align-items:center;justify-content:center;padding:16px;">
  <div id="authModal" style="background:#fff;border-radius:24px;padding:40px 36px;width:100%;max-width:420px;position:relative;box-shadow:0 24px 80px rgba(0,0,0,.3);">
    <button onclick="closeAuthModal()" style="position:absolute;top:18px;right:22px;background:none;border:none;font-size:24px;cursor:pointer;color:#aaa;line-height:1;">&times;</button>

    <div id="authSuccess" style="display:none;text-align:center;padding:20px 0;">
      <div style="font-size:48px;margin-bottom:16px;line-height:1;">✉</div>
      <h2 style="font-family:'Playfair Display',serif;font-size:22px;color:#1a1a28;margin-bottom:10px;">Tjek din indbakke</h2>
      <p style="color:#6b6b6b;font-size:14px;line-height:1.6;" id="authSuccessMsg"></p>
      <button onclick="closeAuthModal()" style="margin-top:24px;padding:12px 32px;background:#1a1a28;color:#fff;border:none;border-radius:50px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">OK</button>
    </div>

    <div id="authForm">
      <h2 id="authTitle" style="font-family:'Playfair Display',serif;font-size:26px;margin-bottom:6px;color:#1a1a28;">Log ind</h2>
      <p id="authSub" style="color:#6b6b6b;font-size:14px;margin-bottom:24px;">Gem og genfind dine planer</p>

      <button onclick="signInWithGoogle()" id="googleBtn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 16px;border:1.5px solid #e5e0da;border-radius:50px;font-size:14px;font-weight:600;cursor:pointer;background:#fff;color:#1a1a28;font-family:inherit;margin-bottom:20px;">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
        Fortsæt med Google
      </button>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="flex:1;height:1px;background:#e5e0da;"></div>
        <span style="color:#aaa;font-size:12px;white-space:nowrap;">eller med email</span>
        <div style="flex:1;height:1px;background:#e5e0da;"></div>
      </div>

      <div id="authError" style="display:none;background:#fde8e8;color:#c0392b;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px;"></div>

      <div id="nameFields" style="display:none;margin-bottom:12px;">
        <div style="display:flex;gap:10px;">
          <input id="authFirst" type="text" placeholder="Fornavn" style="flex:1;min-width:0;box-sizing:border-box;padding:12px 14px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
          <input id="authLast" type="text" placeholder="Efternavn" style="flex:1;min-width:0;box-sizing:border-box;padding:12px 14px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
        </div>
      </div>

      <input id="authEmail" type="email" placeholder="Email" style="width:100%;box-sizing:border-box;padding:12px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;margin-bottom:12px;outline:none;font-family:inherit;display:block;">

      <div style="position:relative;margin-bottom:8px;">
        <input id="authPassword" type="password" placeholder="Adgangskode" style="width:100%;box-sizing:border-box;padding:12px 48px 12px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;" oninput="checkPasswordStrength(this.value)">
        <button type="button" onclick="togglePw('authPassword',this)" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#aaa;padding:0;line-height:1;display:flex;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
      </div>

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

      <p id="forgotWrap" style="text-align:center;margin-top:10px;font-size:13px;">
        <a onclick="showForgotMode()" style="color:#aaa;cursor:pointer;">Glemt adgangskode?</a>
      </p>
      <p style="text-align:center;margin-top:10px;font-size:13px;color:#6b6b6b;">
        <span id="authToggleText">Har du ikke en konto?</span>
        <a onclick="toggleAuthMode()" style="color:#d94f3a;cursor:pointer;font-weight:600;margin-left:4px;" id="authToggleLink">Opret konto</a>
      </p>
    </div>
  </div>
</div>

<!-- New password modal (for reset flow) -->
<div id="newPwOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10001;align-items:center;justify-content:center;padding:16px;">
  <div style="background:#fff;border-radius:24px;padding:40px 36px;width:100%;max-width:420px;box-shadow:0 24px 80px rgba(0,0,0,.3);">
    <h2 style="font-family:'Playfair Display',serif;font-size:24px;color:#1a1a28;margin-bottom:8px;">Nyt kodeord</h2>
    <p style="color:#6b6b6b;font-size:14px;margin-bottom:24px;">Vælg et stærkt kodeord til din konto.</p>
    <div id="newPwError" style="display:none;background:#fde8e8;color:#c0392b;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px;"></div>
    <div style="position:relative;margin-bottom:8px;">
      <input id="newPwInput" type="password" placeholder="Nyt kodeord" oninput="checkNewPw(this.value)" style="width:100%;box-sizing:border-box;padding:13px 48px 13px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      <button type="button" onclick="togglePw('newPwInput',this)" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#aaa;padding:0;line-height:1;display:flex;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
    </div>
    <div style="position:relative;margin-bottom:10px;">
      <input id="newPwConfirm" type="password" placeholder="Gentag kodeord" style="width:100%;box-sizing:border-box;padding:13px 48px 13px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      <button type="button" onclick="togglePw('newPwConfirm',this)" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#aaa;padding:0;line-height:1;display:flex;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:6px;">
      <div id="np1" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
      <div id="np2" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
      <div id="np3" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
      <div id="np4" style="flex:1;height:4px;border-radius:4px;background:#e5e0da;transition:background .3s;"></div>
    </div>
    <p id="npLabel" style="font-size:11px;color:#aaa;margin:0 0 16px;"></p>
    <button onclick="submitNewPassword()" id="newPwBtn" style="width:100%;padding:14px;background:#1a1a28;color:#fff;border:none;border-radius:50px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">Gem nyt kodeord</button>
  </div>
</div>

<!-- Google profile completion modal -->
<div id="profileOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;align-items:center;justify-content:center;padding:16px;">
  <div style="background:#fff;border-radius:24px;padding:40px 36px;width:100%;max-width:420px;box-shadow:0 24px 80px rgba(0,0,0,.3);">
    <h2 style="font-family:'Playfair Display',serif;font-size:24px;color:#1a1a28;margin-bottom:8px;">Velkommen!</h2>
    <p style="color:#6b6b6b;font-size:14px;margin-bottom:24px;">Fortæl os dit navn for at fuldføre din konto.</p>
    <div id="profileError" style="display:none;background:#fde8e8;color:#c0392b;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px;"></div>
    <div style="display:flex;gap:10px;margin-bottom:20px;">
      <input id="profileFirst" type="text" placeholder="Fornavn" style="flex:1;min-width:0;box-sizing:border-box;padding:13px 14px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      <input id="profileLast" type="text" placeholder="Efternavn" style="flex:1;min-width:0;box-sizing:border-box;padding:13px 14px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <button onclick="saveProfile()" id="profileBtn" style="width:100%;padding:14px;background:#1a1a28;color:#fff;border:none;border-radius:50px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">Gem navn</button>
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
  const isForgot = authMode === 'forgot';
  document.getElementById('authTitle').textContent = isForgot ? 'Nulstil kodeord' : isLogin ? 'Log ind' : 'Opret konto';
  document.getElementById('authSub').textContent = isForgot ? 'Vi sender dig et link på email' : isLogin ? 'Velkommen tilbage' : 'Gem og genfind dine planer';
  document.getElementById('authSubmitBtn').textContent = isForgot ? 'Send nulstillingslink' : isLogin ? 'Log ind' : 'Opret konto';
  document.getElementById('authToggleText').textContent = isLogin ? 'Har du ikke en konto?' : isForgot ? '' : 'Har du allerede en konto?';
  document.getElementById('authToggleLink').textContent = isLogin ? 'Opret konto' : isForgot ? '' : 'Log ind';
  document.getElementById('nameFields').style.display = (!isLogin && !isForgot) ? 'block' : 'none';
  document.getElementById('pwStrengthWrap').style.display = (!isLogin && !isForgot) ? 'block' : 'none';
  document.getElementById('pwHints').style.display = (!isLogin && !isForgot) ? 'block' : 'none';
  document.getElementById('authPassword').style.display = isForgot ? 'none' : 'block';
  document.getElementById('googleBtn').style.display = isForgot ? 'none' : 'flex';
  document.getElementById('forgotWrap').style.display = isLogin ? 'block' : 'none';
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authPassword').value = '';
  checkPasswordStrength('');
}

function showForgotMode() { authMode = 'forgot'; _applyMode(); }
function toggleAuthMode() { authMode = authMode === 'login' ? 'signup' : 'login'; _applyMode(); }

const _eyeOpen = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const _eyeOff  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.innerHTML = isText ? _eyeOpen : _eyeOff;
}

// Password strength
function checkPasswordStrength(pw) {
  const has8 = pw.length >= 8, hasU = /[A-Z]/.test(pw), hasN = /[0-9]/.test(pw), hasS = /[^A-Za-z0-9]/.test(pw);
  const score = [has8, hasU, hasN, hasS].filter(Boolean).length;
  const colors = ['#e5e0da','#e74c3c','#e67e22','#f1c40f','#27ae60'];
  const labels = ['','For svag','Svag','Okay','Stærk'];
  for (let i = 1; i <= 4; i++) document.getElementById('ps'+i).style.background = i <= score ? colors[score] : '#e5e0da';
  document.getElementById('pwStrengthLabel').textContent = pw.length ? labels[score] : '';
  _hint('ph1', has8, 'Mindst 8 tegn'); _hint('ph2', hasU, 'Stort bogstav');
  _hint('ph3', hasN, 'Et tal'); _hint('ph4', hasS, 'Specialtegn (!@#$...)');
}
function _hint(id, ok, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = ok ? '#27ae60' : '#aaa';
}
function isPasswordStrong(pw) {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

function showInAppBrowserOverlay() {
  if (document.getElementById('inAppOverlay')) return;
  const url = window.location.href;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const hint = isIOS
    ? 'Tryk på <strong>···</strong> eller <strong>del-ikonet</strong> og vælg <strong>"Åbn i Safari"</strong>'
    : 'Tryk på <strong>···</strong> øverst og vælg <strong>"Åbn i Chrome"</strong>';

  const el = document.createElement('div');
  el.id = 'inAppOverlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:0 0 32px;';
  el.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:32px 28px;width:100%;max-width:420px;margin:0 16px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.4);">
      <div style="font-size:36px;margin-bottom:12px;line-height:1;color:#0d2247;">&#9679;</div>
      <h3 style="font-size:18px;font-weight:700;color:#1a1a28;margin-bottom:8px;">Åbn i din rigtige browser</h3>
      <p style="font-size:14px;color:#6b6b6b;margin-bottom:20px;line-height:1.5;">Google tillader ikke login i denne in-app browser.<br>${hint}</p>
      <div style="background:#f5f5f5;border-radius:12px;padding:12px 16px;font-size:13px;color:#555;word-break:break-all;margin-bottom:16px;">${url}</div>
      <button onclick="navigator.clipboard.writeText('${url.replace(/'/g,"\\'")}').then(()=>{ this.textContent='Kopieret!'; this.style.background='#27ae60'; setTimeout(()=>{ this.textContent='Kopiér link'; this.style.background='#1a1a28'; },2000); })" style="width:100%;padding:14px;background:#1a1a28;color:#fff;border:none;border-radius:50px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:10px;">Kopiér link</button>
      <button onclick="document.getElementById('inAppOverlay').remove()" style="width:100%;padding:12px;background:transparent;color:#aaa;border:none;font-size:14px;cursor:pointer;font-family:inherit;">Luk</button>
    </div>
  `;
  document.body.appendChild(el);
}

async function signInWithGoogle() {
  const ua = navigator.userAgent || '';
  // Known in-app browser identifiers
  const knownInApp = /FBAN|FBAV|Instagram|Twitter\/|Line\/|Pinterest|Snapchat|TikTok|Musical\.ly|GSA\/|MicroMessenger|WhatsApp|Telegram|Reddit|Discord|LinkedInApp|BytedanceWebview/.test(ua);
  // Android WebView (has 'wv' flag or Version/x before Chrome)
  const androidWebView = /Android/.test(ua) && (ua.includes('; wv)') || ua.includes(';wv)') || (/Version\/\d/.test(ua) && /Chrome\//.test(ua)));
  // iOS WKWebView: has AppleWebKit + iPhone/iPad but NOT Safari/, CriOS/, FxiOS/
  const iosWebView = /iPhone|iPad/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\//.test(ua) && !/CriOS\//.test(ua) && !/FxiOS\//.test(ua);

  if (knownInApp || androidWebView || iosWebView) {
    showInAppBrowserOverlay();
    return;
  }

  await _sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
}

function checkNewPw(pw) {
  const has8 = pw.length >= 8, hasU = /[A-Z]/.test(pw), hasN = /[0-9]/.test(pw), hasS = /[^A-Za-z0-9]/.test(pw);
  const score = [has8, hasU, hasN, hasS].filter(Boolean).length;
  const colors = ['#e5e0da','#e74c3c','#e67e22','#f1c40f','#27ae60'];
  const labels = ['','For svag','Svag','Okay','Stærk'];
  for (let i = 1; i <= 4; i++) document.getElementById('np'+i).style.background = i <= score ? colors[score] : '#e5e0da';
  document.getElementById('npLabel').textContent = pw.length ? labels[score] : '';
}

async function submitNewPassword() {
  const pw = document.getElementById('newPwInput').value;
  const confirm = document.getElementById('newPwConfirm').value;
  const errEl = document.getElementById('newPwError');
  const btn = document.getElementById('newPwBtn');
  errEl.style.display = 'none';
  if (!isPasswordStrong(pw)) { errEl.textContent = 'Kodeordet er ikke stærkt nok.'; errEl.style.display = 'block'; return; }
  if (pw !== confirm) { errEl.textContent = 'Kodeordene matcher ikke.'; errEl.style.display = 'block'; return; }
  btn.textContent = '...'; btn.disabled = true;
  const { error } = await _sb.auth.updateUser({ password: pw });
  if (error) {
    errEl.textContent = 'Fejl: ' + error.message; errEl.style.display = 'block';
    btn.textContent = 'Gem nyt kodeord'; btn.disabled = false;
  } else {
    document.getElementById('newPwOverlay').style.display = 'none';
    await _sb.auth.signOut();
    updateNavAuth();
    // Show confirmation via login modal
    openAuthModal('login');
    _showErr('Kodeord opdateret! Log ind med dit nye kodeord.');
    document.getElementById('authError').style.background = '#e8fde8';
    document.getElementById('authError').style.color = '#1e7e34';
  }
}

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');

  if (authMode === 'forgot') {
    if (!email) { _showErr('Indtast din email.'); return; }
    btn.textContent = '...'; btn.disabled = true;
    try {
      localStorage.setItem('sbResetPending', '1');
      const { error } = await _sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      document.getElementById('authForm').style.display = 'none';
      document.getElementById('authSuccess').style.display = 'block';
      document.getElementById('authSuccessMsg').textContent = `Vi har sendt et nulstillingslink til ${email}. Tjek din indbakke (og spam).`;
    } catch (e) { _showErr(translateAuthError(e.message)); }
    finally { btn.textContent = 'Send nulstillingslink'; btn.disabled = false; }
    return;
  }

  if (authMode === 'signup') {
    const first = document.getElementById('authFirst').value.trim();
    const last = document.getElementById('authLast').value.trim();
    if (!first || !last) { _showErr('Indtast dit for- og efternavn.'); return; }
    if (!isPasswordStrong(password)) { _showErr('Adgangskoden er ikke stærk nok.'); return; }
    btn.textContent = '...'; btn.disabled = true;
    try {
      const { data, error } = await _sb.auth.signUp({
        email, password,
        options: { data: { full_name: `${first} ${last}`, first_name: first, last_name: last }, emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      if (data?.user?.identities?.length === 0) throw { message: 'already registered' };
      document.getElementById('authForm').style.display = 'none';
      document.getElementById('authSuccess').style.display = 'block';
      document.getElementById('authSuccessMsg').textContent = `Vi har sendt en bekræftelsesmail til ${email}. Klik på linket i mailen for at aktivere din konto.`;
    } catch (e) { _showErr(translateAuthError(e.message)); }
    finally { btn.textContent = 'Opret konto'; btn.disabled = false; }
  } else {
    btn.textContent = '...'; btn.disabled = true;
    try {
      const { error } = await _sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuthModal();
      updateNavAuth();
      if (window._afterLogin) { window._afterLogin(); window._afterLogin = null; }
    } catch (e) { _showErr(translateAuthError(e.message)); }
    finally { btn.textContent = 'Log ind'; btn.disabled = false; }
  }
}

function _showErr(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg; el.style.display = 'block';
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

// ---- Google profile completion ----
function showProfileModal() {
  document.getElementById('profileOverlay').style.display = 'flex';
  document.getElementById('profileFirst').focus();
}

async function saveProfile() {
  const first = document.getElementById('profileFirst').value.trim();
  const last = document.getElementById('profileLast').value.trim();
  const errEl = document.getElementById('profileError');
  const btn = document.getElementById('profileBtn');
  if (!first || !last) { errEl.textContent = 'Indtast dit for- og efternavn.'; errEl.style.display = 'block'; return; }
  btn.textContent = '...'; btn.disabled = true;
  const { error } = await _sb.auth.updateUser({ data: { first_name: first, last_name: last, full_name: `${first} ${last}` } });
  if (error) { errEl.textContent = 'Fejl: ' + error.message; errEl.style.display = 'block'; btn.textContent = 'Gem navn'; btn.disabled = false; return; }
  document.getElementById('profileOverlay').style.display = 'none';
  updateNavAuth();
}

// ---- nav auth ----
const _navBtnStyle = '';

function injectNavAuthBtn() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const wrap = document.createElement('div');
  wrap.id = 'navAuthWrap';
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const langToggle = document.getElementById('langToggle');
  if (langToggle) navbar.insertBefore(wrap, langToggle);
  else navbar.appendChild(wrap);
}

async function handleNavAuthClick() {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) openAuthModal('login');
}

async function updateNavAuth() {
  const wrap = document.getElementById('navAuthWrap');
  if (!wrap) return;
  const { data: { session } } = await _sb.auth.getSession();
  wrap.innerHTML = '';

  // Mobile-only booking link
  const bookingLink = document.createElement('a');
  bookingLink.href = '/booking';
  bookingLink.textContent = 'Booking';
  bookingLink.className = 'nav-mobile-booking';
  wrap.appendChild(bookingLink);

  if (session) {
    const meta = session.user.user_metadata || {};
    const name = meta.first_name || (meta.full_name ? meta.full_name.split(' ')[0] : null) || session.user.email.split('@')[0];
    const initial = name.charAt(0).toUpperCase();

    // ---- Desktop ----
    const desktop = document.createElement('div');
    desktop.className = 'nav-desktop';

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'color:#1a1a1a;font-size:14px;font-weight:600;white-space:nowrap;';
    nameSpan.textContent = name;

    const mk = (label, href) => {
      const b = document.createElement('button');
      b.className = 'nav-auth-btn';
      b.textContent = label;
      b.onclick = () => { window.location.href = href; };
      return b;
    };
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-auth-logout';
    logoutBtn.textContent = 'Log ud';
    logoutBtn.onclick = async () => { await _sb.auth.signOut(); window.location.href = '/'; };

    desktop.appendChild(nameSpan);
    desktop.appendChild(mk('Min profil', '/profile'));
    desktop.appendChild(mk('Mine planer', '/saved'));
    desktop.appendChild(logoutBtn);

    // ---- Mobile: avatar button + dropdown ----
    const mobileWrap = document.createElement('div');
    mobileWrap.className = 'nav-mobile-btn';

    const avatar = document.createElement('button');
    avatar.style.cssText = 'width:38px;height:38px;border-radius:50%;background:#5e17eb;color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;';
    avatar.textContent = initial;

    const dropdown = document.createElement('div');
    dropdown.className = 'nav-dropdown';
    dropdown.id = 'navDropdown';
    dropdown.innerHTML = `
      <span style="display:block;padding:10px 16px 6px;color:rgba(255,255,255,.5);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">${name}</span>
      <div class="nav-dd-divider"></div>
      <a href="/profile.html" style="font-size:15px;padding:12px 18px;">Min profil</a>
      <a href="/saved.html" style="font-size:15px;padding:12px 18px;">Mine planer</a>
      <div class="nav-dd-divider"></div>
      <button style="font-size:15px;padding:12px 18px;color:rgba(255,255,255,.5);" onclick="(async()=>{await _sb.auth.signOut();window.location.href='/'})()">Log ud</button>
    `;

    avatar.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    };
    document.addEventListener('click', () => dropdown.classList.remove('open'), { once: false });

    mobileWrap.appendChild(avatar);
    mobileWrap.appendChild(dropdown);

    wrap.appendChild(desktop);
    wrap.appendChild(mobileWrap);
  } else {
    const btn = document.createElement('button');
    btn.className = 'nav-auth-btn';
    btn.textContent = 'Log ind';
    btn.onclick = handleNavAuthClick;
    wrap.appendChild(btn);
  }
}

// ---- auth state changes ----
_sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    // Implicit flow recovery
    document.getElementById('newPwOverlay').style.display = 'flex';
    return;
  }
  if (event === 'SIGNED_IN' && session) {
    // Check if this is a PKCE recovery (flag set before redirect)
    if (localStorage.getItem('sbResetPending') === '1') {
      localStorage.removeItem('sbResetPending');
      window.history.replaceState({}, '', window.location.pathname);
      document.getElementById('newPwOverlay').style.display = 'flex';
      return;
    }
    const meta = session.user.user_metadata || {};
    const provider = session.user.app_metadata?.provider;
    if (provider === 'google' && !meta.first_name) {
      showProfileModal();
    }
    updateNavAuth();
    if (window._afterLogin) { window._afterLogin(); window._afterLogin = null; }
  }
});

// ---- save city ----
async function saveUserCity(city) {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) return;
  await _sb.auth.updateUser({ data: { city } });
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
    user_id: session.user.id, title: plan.title,
    emoji: plan.emoji || '✨', tagline: plan.tagline || '',
    content: JSON.stringify(plan)
  });
  if (error) { alert('Fejl ved gemning: ' + error.message); return; }
  const btn = document.getElementById('savePlanBtn');
  if (btn) { btn.textContent = 'Gemt!'; btn.disabled = true; btn.style.background = '#27ae60'; }
}

// ---- init ----
injectNavAuthBtn();
updateNavAuth();
