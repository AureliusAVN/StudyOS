'use strict';

import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';

// ── app.js からコールバックを受け取る ────────────────
let _onLogin = null;
let _onLogout = null;

export function setAuthCallbacks(onLogin, onLogout) {
  _onLogin = onLogin;
  _onLogout = onLogout;
}

// ── 画面切り替え ──────────────────────────────────────
function showAuthScreen() {
  const authEl = document.getElementById('authScreen');
  const appEl = document.getElementById('appScreen');
  if (authEl) authEl.style.display = 'flex';
  if (appEl) appEl.style.display = 'none';
}

function showAppScreen(user) {
  const authEl = document.getElementById('authScreen');
  const appEl = document.getElementById('appScreen');
  const emailEl = document.getElementById('accountEmail');
  if (authEl) authEl.style.display = 'none';
  // flex にすることで sidebar + main が横並びになる
  if (appEl) appEl.style.display = 'flex';
  if (emailEl && user) emailEl.textContent = user.email;
}

// ── タブ切り替え（グローバル公開）────────────────────
window.switchAuthTab = function (tab) {
  // タブボタン
  document.querySelectorAll('.auth-tab').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0) === (tab === 'login'));
  });
  // パネル
  const loginPanel = document.getElementById('authPanelLogin');
  const registerPanel = document.getElementById('authPanelRegister');
  if (loginPanel) loginPanel.classList.toggle('active', tab === 'login');
  if (registerPanel) registerPanel.classList.toggle('active', tab === 'register');
  // メッセージリセット
  const msg = document.getElementById('authMsg');
  if (msg) msg.textContent = '';
};

// ── エラーメッセージ日本語化 ──────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'メールアドレスが見つかりません',
    'auth/wrong-password': 'パスワードが違います',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/email-already-in-use': 'このメールアドレスはすでに登録されています',
    'auth/weak-password': 'パスワードは6文字以上にしてください',
    'auth/too-many-requests': 'しばらく時間をおいてから試してください',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが違います',
    'auth/configuration-not-found': 'Firebase の Email/Password 認証が有効になっていません。Firebaseコンソールで有効化してください。',
  };
  return map[code] || 'エラーが発生しました';
}

function setMsg(text, isError = true) {
  const msg = document.getElementById('authMsg');
  if (!msg) return;
  msg.textContent = text;
  msg.style.color = isError ? 'var(--danger)' : 'var(--accent2)';
}

// ── ログイン ──────────────────────────────────────────
async function loginUser() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const pass = document.getElementById('loginPassword')?.value;
  if (!email || !pass) { setMsg('Email と Password を入力してください'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    setMsg('');
  } catch (e) {
    setMsg(friendlyError(e.code));
    console.error('[auth] login:', e);
  }
}

// ── 新規登録 ──────────────────────────────────────────
async function registerUser() {
  const email = document.getElementById('registerEmail')?.value.trim();
  const pass = document.getElementById('registerPassword')?.value;
  const pass2 = document.getElementById('registerPassword2')?.value;
  if (!email || !pass) { setMsg('Email と Password を入力してください'); return; }
  if (pass !== pass2) { setMsg('パスワードが一致しません'); return; }
  if (pass.length < 6) { setMsg('パスワードは6文字以上にしてください'); return; }
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    setMsg('アカウントを作成しました', false);
  } catch (e) {
    setMsg(friendlyError(e.code));
    console.error('[auth] register:', e);
  }
}

// ── パスワードリセット ────────────────────────────────
async function resetPassword() {
  const email = document.getElementById('loginEmail')?.value.trim();
  if (!email) { setMsg('メールアドレスを入力してください'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    setMsg('リセットメールを送信しました。メールをご確認ください。', false);
  } catch (e) {
    setMsg(friendlyError(e.code));
    console.error('[auth] reset:', e);
  }
}

// ── ログアウト ────────────────────────────────────────
async function logoutUser() {
  await signOut(auth);
}

// ── Auth State 監視（1回だけ登録）────────────────────
onAuthStateChanged(auth, async user => {
  if (user) {
    showAppScreen(user);
    if (_onLogin) await _onLogin(user);
  } else {
    showAuthScreen();
    if (_onLogout) _onLogout();
  }
});

// ── HTML onclick 用グローバル公開 ─────────────────────
window.loginUser = loginUser;
window.registerUser = registerUser;
window.logoutUser = logoutUser;
window.resetPassword = resetPassword;