'use strict';

import { state, saveData, genId } from './storage.js';
import { openModal, showToast }   from './modal.js';

// ── DOM helper ───────────────────────────────────────
function el(tag, opts = {}) {
  const n = document.createElement(tag);
  if (opts.cls)              n.className   = opts.cls;
  if (opts.text !== undefined) n.textContent = opts.text;
  if (opts.style)            Object.assign(n.style, opts.style);
  return n;
}
function emptyState(icon, msg) {
  const w = el('div', { cls: 'empty' });
  w.appendChild(el('div', { cls: 'empty-icon', text: icon }));
  w.appendChild(el('div', { text: msg }));
  return w;
}

// ── CRUD ─────────────────────────────────────────────
export async function saveReview() {
  const w = document.getElementById('winInput');
  const p = document.getElementById('problemInput');
  const f = document.getElementById('fixInput');
  const t = document.getElementById('tomorrowInput');

  if (!w.value.trim() && !p.value.trim() && !f.value.trim() && !t.value.trim()) {
    showToast('内容を入力してください');
    return;
  }

  state.reviews.unshift({
    id:       genId(),
    date:     new Date().toLocaleDateString('ja-JP'),
    win:      w.value.trim(),
    problem:  p.value.trim(),
    fix:      f.value.trim(),
    tomorrow: t.value.trim(),
  });

  w.value = ''; p.value = ''; f.value = ''; t.value = '';
  await saveData();
  renderReviews();
  showToast('レビューを保存しました ◈');
}

export function deleteReview(id) {
  openModal('このレビューを削除しますか？', async () => {
    state.reviews = state.reviews.filter(r => r.id !== id);
    await saveData();
    renderReviews();
  });
}

// ── 描画 ─────────────────────────────────────────────
export function renderReviews() {
  const list = document.getElementById('reviewList');
  if (!list) return;
  list.innerHTML = '';

  const q        = (document.getElementById('reviewSearch')?.value || '').toLowerCase();
  const filtered = state.reviews.filter(r =>
    !q || [r.win, r.problem, r.fix, r.tomorrow].some(v => v && v.toLowerCase().includes(q))
  );

  if (!filtered.length) { list.appendChild(emptyState('◈', 'レビューなし')); return; }

  filtered.forEach(r => {
    const item = el('div', { cls: 'review-item' });
    Object.assign(item.style, { flexDirection: 'column', alignItems: 'stretch', gap: '9px' });

    // ヘッダー行: 日付 + 削除ボタン
    const top = el('div');
    Object.assign(top.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
    top.appendChild(el('strong', { text: r.date, style: { fontFamily: "'DM Mono',monospace", fontSize: '13px' } }));
    const del     = el('button', { cls: 'delete-btn', text: '削除' });
    del.onclick   = () => deleteReview(r.id);
    top.appendChild(del);
    item.appendChild(top);

    // フィールド表示
    [['✦ Win', r.win], ['✦ Problem', r.problem], ['✦ Fix', r.fix], ['✦ Tomorrow', r.tomorrow]].forEach(([label, val]) => {
      if (!val) return;
      const div = el('div', { cls: 'small' });
      div.appendChild(el('span', { cls: 'review-field-accent', text: label + ': ' }));
      div.appendChild(el('span', { text: val }));
      item.appendChild(div);
    });

    list.appendChild(item);
  });
}
