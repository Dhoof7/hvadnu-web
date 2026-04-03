// ===== SUPABASE AUTH =====
const SUPABASE_URL = 'https://kqpxhefvnrlsuxmiqhhy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhoZWZ2bnJsc3V4bWlxaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzE4NjEsImV4cCI6MjA5MDgwNzg2MX0.-fw759yENbo2UZTdgzIU4TpjUqOON4ogtpEUYvE8fqA';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ---- inject modal HTML ----
document.body.insertAdjacentHTML('beforeend', `
<div id="authOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:none;align-items:center;justify-content:center;">
  <div id="authModal" style="background:#fff;border-radius:20px;padding:40px 36px;width:100%;max-width:400px;margin:16px;position:relative;">
    <button onclick="closeAuthModal()" style="position:absolute;top:16px;right:20px;background:none;border:none;font-size:22px;cursor:pointer;color:#999;">&times;</button>
    <h2 id="authTitle" style="font-family:'Playfair Display',serif;font-size:24px;margin-bottom:8px;color:#1a1a28;">Log ind</h2>
    <p id="authSub" style="color:#6b6b6b;font-size:14px;margin-bottom:24px;">Gem og genfind dine planer</p>
    <div id="authError" style="display:none;background:#fde8e8;color:#c0392b;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:16px;"></div>
    <input id="authEmail" type="email" placeholder="Email" style="width:100%;padding:12px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;margin-bottom:12px;outline:none;font-family:inherit;">
    <input id="authPassword" type="password" placeholder="Adgangskode" style="width:100%;padding:12px 16px;border:1.5px solid #e5e0da;border-radius:10px;font-size:14px;margin-bottom:20px;outline:none;font-family:inherit;">
    <button onclick="submitAuth()" id="authSubmitBtn" style="width:100%;padding:14px;background:#1a1a28;color:#fff;border:none;border-radius:50px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">Log ind</button>
    <p style="text-align:center;margin-top:16px;font-size:13px;color:#6b6b6b;">
      <span id="authToggleText">Har du ikke en konto?</span>
      <a onclick="toggleAuthMode()" style="color:#d94f3a;cursor:pointer;font-weight:600;margin-left:4px;" id="authToggleLink">Opret konto</a>
    </p>
  </div>
</div>
`);

let authMode = 'login'; // 'login' | 'signup'

function openAuthModal() {
  document.getElementById('authOverlay').style.display = 'flex';
  document.getElementById('authEmail').focus();
}
function closeAuthModal() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('authError').style.display = 'none';
}
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  const isLogin = authMode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? 'Log ind' : 'Opret konto';
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'Log ind' : 'Opret konto';
  document.getElementById('authToggleText').textContent = isLogin ? 'Har du ikke en konto?' : 'Har du allerede en konto?';
  document.getElementById('authToggleLink').textContent = isLogin ? 'Opret konto' : 'Log ind';
  document.getElementById('authError').style.display = 'none';
}

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmitBtn');
  btn.textContent = '...';
  btn.disabled = true;
  errEl.style.display = 'none';

  try {
    let result;
    if (authMode === 'login') {
      result = await _sb.auth.signInWithPassword({ email, password });
    } else {
      result = await _sb.auth.signUp({ email, password });
    }
    if (result.error) throw result.error;
    closeAuthModal();
    updateNavAuth();
    if (window._afterLogin) window._afterLogin();
  } catch (e) {
    errEl.textContent = translateAuthError(e.message);
    errEl.style.display = 'block';
  } finally {
    btn.textContent = authMode === 'login' ? 'Log ind' : 'Opret konto';
    btn.disabled = false;
  }
}

function translateAuthError(msg) {
  if (msg.includes('Invalid login')) return 'Forkert email eller adgangskode.';
  if (msg.includes('Email not confirmed')) return 'Bekræft din email først.';
  if (msg.includes('already registered')) return 'Denne email er allerede registreret.';
  if (msg.includes('Password should be')) return 'Adgangskode skal være mindst 6 tegn.';
  return msg;
}

// Close on overlay click
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
  // Insert before lang-toggle if it exists
  const langToggle = document.getElementById('langToggle');
  if (langToggle) navbar.insertBefore(btn, langToggle);
  else navbar.appendChild(btn);
}

async function handleNavAuthClick() {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    // Show dropdown-style options
    if (confirm('Vil du logge ud?')) {
      await _sb.auth.signOut();
      updateNavAuth();
    }
  } else {
    openAuthModal();
  }
}

async function updateNavAuth() {
  const btn = document.getElementById('navAuthBtn');
  if (!btn) return;
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    const email = session.user.email;
    const short = email.split('@')[0];
    btn.textContent = `${short} ·  Mine planer`;
    btn.onclick = () => { window.location.href = '/saved.html'; };
  } else {
    btn.textContent = 'Log ind';
    btn.onclick = handleNavAuthClick;
  }
}

// ---- save plan ----
async function savePlan(plan) {
  const { data: { session } } = await _sb.auth.getSession();
  if (!session) {
    window._afterLogin = () => savePlan(plan);
    openAuthModal();
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
