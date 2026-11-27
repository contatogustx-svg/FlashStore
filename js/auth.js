/* Flash Store – contas de clientes (Firebase Authentication + Realtime Database)
   Usado por: login.html, register.html (formulários) e index.html (sessão / bloqueio do Pix).
   A configuração do Firebase fica em js/config.js (window.GUSTX.firebase). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, set, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const FB = (window.GUSTX && window.GUSTX.firebase) || {};
const configured = !!(FB.apiKey && FB.databaseURL && FB.projectId && JSON.stringify(FB).indexOf('COLE_AQUI') < 0);
const page = document.body.dataset.page || 'site';
const $ = (id) => document.getElementById(id);

let app = null, auth = null, db = null;
if (configured) {
  try {
    app = initializeApp(FB);
    auth = getAuth(app);
    db = getDatabase(app);
  } catch (e) { console.error('Firebase:', e); }
}
const ok = !!(auth && db);

/* ---------------- utilidades ---------------- */
let toastTimer;
function say(msg) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

const ERR = {
  'auth/email-already-in-use': 'Este e-mail já está cadastrado. Tente entrar.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'Senha fraca. Use pelo menos 8 caracteres.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet e tente de novo.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/user-disabled': 'Esta conta foi desativada. Fale com o suporte.',
  'auth/operation-not-allowed': 'O login por e-mail e senha não está ativado no Firebase.',
  'auth/invalid-api-key': 'Chave do Firebase inválida. Confira o js/config.js.',
  'auth/requires-recent-login': 'Entre novamente para continuar.'
};
const errMsg = (e) => ERR[e && e.code] || 'Algo deu errado. Tente novamente em instantes.';

function showMsg(id, txt) { const el = $(id); if (!el) return; el.textContent = txt || ''; el.hidden = !txt; }
const showErr = (t) => showMsg('formErr', t);

function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + label; }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
}

/* destino depois do login: só caminhos do próprio site */
function safeNext() {
  const n = new URLSearchParams(location.search).get('next') || '';
  if (!n || /^[a-z][a-z0-9+.-]*:/i.test(n) || n.indexOf('//') === 0 || n.indexOf('\\') >= 0) return 'index.html';
  return n;
}
function go(url) { location.replace(url); }
const nextQS = () => { const n = new URLSearchParams(location.search).get('next'); return n ? '?next=' + encodeURIComponent(safeNext()) : ''; };

/* telefone */
function maskPhone(v) {
  const d = String(v).replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  const cut = d.length > 10 ? 7 : 6;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, cut) + '-' + d.slice(cut);
}
function phoneDigits(v) {            // devolve com 55 na frente (ex.: 5568992423531) ou '' se inválido
  let d = String(v).replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return '';
  if (Number(d.slice(0, 2)) < 11) return '';
  if (d.length === 11 && d[2] !== '9') return '';
  return '55' + d;
}
function showPhone(p) { return maskPhone(String(p || '').replace(/^55/, '')); }

/* ---------------- perfil no Realtime Database ---------------- */
// users/{uid} = { name, phone, email, createdAt }
async function ensureProfile(user) {
  try {
    const r = ref(db, 'users/' + user.uid);
    const snap = await get(r);
    if (snap.exists()) return snap.val();
    let p = null;
    try { p = JSON.parse(localStorage.getItem('flash-pending-profile') || 'null'); } catch (e) { p = null; }
    if (p && p.uid === user.uid) {                       // cadastro que não conseguiu gravar o perfil: tenta de novo
      const data = { name: p.name, phone: p.phone, email: user.email, createdAt: serverTimestamp() };
      await set(r, data);
      try { localStorage.removeItem('flash-pending-profile'); } catch (e) {}
      return { name: p.name, phone: p.phone, email: user.email };
    }
  } catch (e) { console.error('Perfil (confira as Regras do Realtime Database):', e); }
  return null;
}

/* e-mail de confirmação (tenta voltar para o login.html; se o domínio não estiver autorizado, envia o padrão) */
async function sendVerification(user) {
  const cont = location.origin + '/login.html?verified=1' + (new URLSearchParams(location.search).get('next') ? '&next=' + encodeURIComponent(safeNext()) : '');
  try {
    await sendEmailVerification(user, /^https?:/.test(location.origin) ? { url: cont } : undefined);
  } catch (e) {
    if (e && /continue-uri|unauthorized-domain|invalid-dynamic-link/.test(e.code || '')) await sendEmailVerification(user);
    else throw e;
  }
}

/* ---------------- estado global (usado pelo script.js do site) ---------------- */
const state = { ready: false, configured: ok, user: null, verified: false, profile: null };
const emit = () => window.dispatchEvent(new CustomEvent('flashauth:change'));
window.FlashAuth = {
  get ready() { return state.ready; },
  get configured() { return state.configured; },
  get user() { return state.user; },
  get verified() { return state.verified; },
  get profile() { return state.profile; },
  getToken: () => (ok && auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)),
  resend: async () => { if (ok && auth.currentUser) await sendVerification(auth.currentUser); },
  refresh: async () => {
    if (!ok || !auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    state.user = auth.currentUser; state.verified = !!auth.currentUser.emailVerified;
    if (state.verified && !state.profile) state.profile = await ensureProfile(auth.currentUser);
    emit();
  },
  logout: async () => { if (ok) await signOut(auth); }
};

/* ---------------- bloco "confirme seu e-mail" (login e cadastro) ---------------- */
let cooldown = 0, cdTimer = null;
function tickResend() {
  const b = $('vResend'); if (!b) return;
  if (cooldown > 0) { b.disabled = true; b.textContent = 'Reenviar e-mail (' + cooldown + 's)'; }
  else { b.disabled = false; b.textContent = 'Reenviar e-mail'; clearInterval(cdTimer); cdTimer = null; }
}
function startCooldown(s) {
  cooldown = s; tickResend(); clearInterval(cdTimer);
  cdTimer = setInterval(() => { cooldown--; tickResend(); }, 1000);
}
function showVerify(user, note, err) {
  const form = $('regForm') || $('loginForm');
  if (form) form.hidden = true;
  $('verifyBox').hidden = false;
  $('vMail').textContent = user.email || '';
  showMsg('vErr', err || ''); showMsg('vOk', note || '');
  window.scrollTo(0, 0);
}
function hideVerify() {
  const form = $('regForm') || $('loginForm');
  $('verifyBox').hidden = true;
  if (form) form.hidden = false;
}
function wireVerify() {
  const box = $('verifyBox'); if (!box) return;
  $('vResend').addEventListener('click', async () => {
    const u = auth.currentUser; if (!u) return;
    showMsg('vErr', ''); showMsg('vOk', '');
    try { await sendVerification(u); showMsg('vOk', 'E-mail reenviado! Confira sua caixa de entrada.'); startCooldown(60); }
    catch (e) { showMsg('vErr', errMsg(e)); }
  });
  $('vCheck').addEventListener('click', async (ev) => {
    const u = auth.currentUser; if (!u) return;
    const btn = ev.currentTarget;
    showMsg('vErr', ''); showMsg('vOk', '');
    setBusy(btn, true, 'Verificando…');
    try {
      await u.reload();
      if (u.emailVerified) {
        await u.getIdToken(true);
        await ensureProfile(u);
        go(safeNext());
        return;
      }
      showMsg('vErr', 'Ainda não identificamos a confirmação. Clique no link do e-mail e tente de novo.');
    } catch (e) { showMsg('vErr', errMsg(e)); }
    setBusy(btn, false);
  });
  $('vOut').addEventListener('click', async () => {
    try { await signOut(auth); } catch (e) {}
    hideVerify();
  });
}

/* mostrar/ocultar senha */
function wireEyes() {
  document.querySelectorAll('.pw .eye').forEach((b) => {
    b.addEventListener('click', () => {
      const inp = b.parentNode.querySelector('input');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
      b.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      b.querySelector('use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
    });
  });
}

function notConfigured() {
  const w = $('cfgWarn'); if (w) w.hidden = false;
  document.querySelectorAll('form.auth-card button[type="submit"]').forEach((b) => { b.disabled = true; });
}

/* ================= CADASTRO ================= */
function initRegister() {
  const f = $('regForm');
  const lt = $('toLogin'); if (lt) lt.href = 'login.html' + nextQS();
  wireEyes();
  const inp = { name: $('rName'), phone: $('rPhone'), mail: $('rMail'), pass: $('rPass'), pass2: $('rPass2') };
  const hint = (id, txt, kind) => {
    const h = document.querySelector('.hint[data-for="' + id + '"]'); if (!h) return;
    if (h.dataset.base === undefined) h.dataset.base = h.textContent;
    h.textContent = txt === null ? h.dataset.base : txt; h.className = 'hint' + (kind ? ' ' + kind : '');
    const i = $(id); if (i) i.classList.toggle('bad', kind === 'bad');
  };
  inp.phone.addEventListener('input', () => { inp.phone.value = maskPhone(inp.phone.value); });

  const cleanName = () => inp.name.value.replace(/\s+/g, ' ').trim();
  const checks = {
    name() {
      const n = cleanName(), parts = n.split(' ');
      if (n.length < 5 || parts.length < 2 || parts.some((p) => p.length < 2) || !/^[\p{L}][\p{L}'’. -]*$/u.test(n)) { hint('rName', 'Digite seu nome completo (nome e sobrenome).', 'bad'); return false; }
      hint('rName', null); return true;
    },
    phone() {
      if (!phoneDigits(inp.phone.value)) { hint('rPhone', 'Informe um WhatsApp válido com DDD.', 'bad'); return false; }
      hint('rPhone', null); return true;
    },
    mail() {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.mail.value.trim())) { hint('rMail', 'Informe um e-mail válido.', 'bad'); return false; }
      hint('rMail', null); return true;
    },
    pass() {
      const p = inp.pass.value;
      if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) { hint('rPass', 'Use 8 ou mais caracteres, com letras e números.', 'bad'); return false; }
      hint('rPass', null); return true;
    },
    pass2() {
      if (inp.pass2.value !== inp.pass.value || !inp.pass2.value) { hint('rPass2', 'As senhas não são iguais.', 'bad'); return false; }
      hint('rPass2', 'Senhas iguais.', 'ok'); return true;
    }
  };
  inp.name.addEventListener('blur', checks.name);
  inp.phone.addEventListener('blur', checks.phone);
  inp.mail.addEventListener('blur', checks.mail);
  inp.pass.addEventListener('blur', checks.pass);
  inp.pass2.addEventListener('input', () => { if (inp.pass2.value) checks.pass2(); });
  inp.pass.addEventListener('input', () => { if (inp.pass2.value) checks.pass2(); });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr('');
    if (!ok) { showErr('O cadastro ainda não está configurado.'); return; }
    const valid = [checks.name(), checks.phone(), checks.mail(), checks.pass(), checks.pass2()].every(Boolean);
    if (!valid) { const bad = f.querySelector('input.bad'); if (bad) bad.focus(); return; }

    const name = cleanName(), phone = phoneDigits(inp.phone.value), email = inp.mail.value.trim();
    const btn = $('regBtn');
    setBusy(btn, true, 'Criando conta…');
    flow = true;
    let user;
    try {
      user = (await createUserWithEmailAndPassword(auth, email, inp.pass.value)).user;
    } catch (err) {
      flow = false; setBusy(btn, false); showErr(errMsg(err));
      if (err.code === 'auth/email-already-in-use') hint('rMail', 'Este e-mail já tem conta.', 'bad');
      return;
    }
    try { localStorage.setItem('flash-pending-profile', JSON.stringify({ uid: user.uid, name, phone })); } catch (x) {}
    try { await updateProfile(user, { displayName: name }); } catch (x) {}
    try {
      await set(ref(db, 'users/' + user.uid), { name, phone, email, createdAt: serverTimestamp() });
      try { localStorage.removeItem('flash-pending-profile'); } catch (x) {}
    } catch (x) { console.error('Não gravou o perfil (confira as Regras do Realtime Database):', x); }
    let sendErr = '';
    try { await sendVerification(user); startCooldown(60); }
    catch (x) { sendErr = 'Conta criada, mas não conseguimos enviar o e-mail agora. Toque em "Reenviar e-mail".'; }
    flow = false;
    setBusy(btn, false);
    showVerify(user, '', sendErr);
  });
}

/* ================= LOGIN ================= */
function initLogin() {
  const f = $('loginForm');
  const tr = $('toReg'); if (tr) tr.href = 'register.html' + nextQS();
  wireEyes();
  if (new URLSearchParams(location.search).get('verified')) showMsg('infoOk', 'E-mail confirmado! Agora é só entrar.');

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr(''); showMsg('infoOk', '');
    if (!ok) { showErr('O login ainda não está configurado.'); return; }
    const email = $('lMail').value.trim(), pass = $('lPass').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showErr('Informe um e-mail válido.'); $('lMail').focus(); return; }
    if (!pass) { showErr('Informe sua senha.'); $('lPass').focus(); return; }
    const btn = $('loginBtn');
    setBusy(btn, true, 'Entrando…');
    flow = true;
    try {
      const user = (await signInWithEmailAndPassword(auth, email, pass)).user;
      await user.reload();
      if (!user.emailVerified) { flow = false; setBusy(btn, false); showVerify(user, 'Sua conta existe, mas o e-mail ainda não foi confirmado.'); return; }
      await user.getIdToken(true);
      await ensureProfile(user);
      go(safeNext());
    } catch (err) {
      flow = false; setBusy(btn, false); showErr(errMsg(err));
    }
  });

  $('forgot').addEventListener('click', async () => {
    showErr(''); showMsg('infoOk', '');
    if (!ok) return;
    const email = $('lMail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showErr('Digite seu e-mail acima e toque em "Esqueci minha senha".'); $('lMail').focus(); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      showMsg('infoOk', 'Se existir uma conta com esse e-mail, enviamos o link para criar uma nova senha.');
    } catch (err) { showErr(errMsg(err)); }
  });
}

/* ================= SITE (index.html) ================= */
function initSite() {
  function renderAccount() {
    const guest = $('accGuest'), box = $('accUser');
    if (!guest || !box) return;
    const u = state.user;
    guest.hidden = !!u; box.hidden = !u;
    if (!u) return;
    const p = state.profile || {};
    $('accName').textContent = p.name || u.displayName || 'Cliente';
    $('accMail').textContent = u.email || '';
    $('accPhone').textContent = p.phone ? showPhone(p.phone) : '—';
    const st = $('accStatus');
    st.textContent = state.verified ? 'E-mail confirmado' : 'Aguardando confirmação do e-mail';
    st.className = 'acc-badge ' + (state.verified ? 'ok' : 'wait');
    $('accVerifyRow').hidden = state.verified;
  }
  window.addEventListener('flashauth:change', renderAccount);

  if (!ok) { state.ready = true; emit(); return; }

  onAuthStateChanged(auth, async (u) => {
    if (u && !u.emailVerified) { try { await u.reload(); } catch (e) {} }
    state.user = u || null;
    state.verified = !!(u && u.emailVerified);
    if (!u) state.profile = null;
    state.ready = true;
    emit();
    if (u) {
      try {
        const s = await get(ref(db, 'users/' + u.uid));
        state.profile = s.exists() ? s.val() : (state.verified ? await ensureProfile(u) : null);
      } catch (e) { console.error('Perfil:', e); }
      emit();
    }
  });

  const out = $('accLogout');
  if (out) out.addEventListener('click', async () => { await signOut(auth); say('Você saiu da conta.'); });
  const rs = $('accResend');
  if (rs) rs.addEventListener('click', async () => {
    try { await sendVerification(auth.currentUser); say('E-mail de confirmação reenviado!'); } catch (e) { say(errMsg(e)); }
  });
  const rf = $('accRefresh');
  if (rf) rf.addEventListener('click', async () => {
    try { await window.FlashAuth.refresh(); say(state.verified ? 'E-mail confirmado!' : 'Ainda não confirmado.'); } catch (e) { say(errMsg(e)); }
  });
}

/* ---------------- início ---------------- */
let flow = false;   // true enquanto o formulário está trabalhando (evita redirecionar no meio do cadastro/login)

if (page === 'site') {
  initSite();
} else {
  if (!ok) notConfigured();
  if (page === 'register') initRegister();
  if (page === 'login') initLogin();
  if (ok) {
    wireVerify();
    onAuthStateChanged(auth, (u) => {
      if (flow || !u) return;
      if (u.emailVerified) { go(safeNext()); return; }       // já está logado e confirmado
      showVerify(u);                                         // logado, mas falta confirmar o e-mail
    });
  }
}
