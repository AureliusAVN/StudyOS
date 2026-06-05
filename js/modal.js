'use strict';

// ── Modal ──────────────────────────────────────────────
// モジュール読み込み時にDOMを触らず、関数呼び出し時に取得する

export function openModal(msg, cb) {
  const overlay  = document.getElementById('modalOverlay');
  const msgEl    = document.getElementById('modalMsg');
  const confirmEl= document.getElementById('modalConfirm');
  if (!overlay || !msgEl || !confirmEl) return;

  msgEl.textContent = msg;
  overlay.classList.add('open');

  confirmEl.onclick = async () => {
    overlay.classList.remove('open');
    if (cb) await cb();
  };
}

export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
}

// オーバーレイ外クリックで閉じる — DOMContentLoaded後に登録
export function initModal() {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay) return;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });
}

// ── Toast ──────────────────────────────────────────────
let _toastTimer = null;

export function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
