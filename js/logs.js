'use strict';

import { state, saveData, genId } from './storage.js';
import { openModal, showToast }   from './modal.js';
import { renderDashboard }        from './dashboard.js';
import { renderAnalytics }        from './analytics.js';

// ── DOM helper ───────────────────────────────────────
function el(tag, opts = {}) {
  const n = document.createElement(tag);
  if (opts.cls)              n.className   = opts.cls;
  if (opts.text !== undefined) n.textContent = opts.text;
  if (opts.style)            Object.assign(n.style, opts.style);
  if (opts.attr)             Object.entries(opts.attr).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}
function emptyState(icon, msg) {
  const w = el('div', { cls: 'empty' });
  w.appendChild(el('div', { cls: 'empty-icon', text: icon }));
  w.appendChild(el('div', { text: msg }));
  return w;
}

// ── オートコンプリート ────────────────────────────────
function getSubjects() {
  return [...new Set(state.logs.map(l => l.subject))].sort();
}

export function onSubjectInput() {
  const val  = document.getElementById('subjectInput').value.toLowerCase();
  const list = document.getElementById('autocompleteList');
  list.innerHTML = '';

  if (!val) { list.classList.remove('open'); return; }

  const matches = getSubjects().filter(s => s.toLowerCase().includes(val));
  if (!matches.length) { list.classList.remove('open'); return; }

  matches.forEach(s => {
    const item = el('div', { cls: 'autocomplete-item', text: s });
    item.onmousedown = e => {
      e.preventDefault();   // blur より先にfireさせる
      document.getElementById('subjectInput').value = s;
      list.classList.remove('open');
      document.getElementById('timeInput').focus();
    };
    list.appendChild(item);
  });
  list.classList.add('open');
}

export function closeAutocomplete() {
  setTimeout(() => document.getElementById('autocompleteList').classList.remove('open'), 150);
}

// ── CRUD ─────────────────────────────────────────────
export async function addLog() {
  const sub = document.getElementById('subjectInput');
  const tim = document.getElementById('timeInput');
  const not = document.getElementById('noteInput');
  const min = parseInt(tim.value);

  if (!sub.value.trim() || isNaN(min) || min <= 0) {
    showToast('科目と分数を入力してください');
    return;
  }

  state.logs.unshift({
    id:      genId(),
    subject: sub.value.trim(),
    time:    min,
    note:    not.value.trim(),
    date:    new Date().toISOString(),
  });

  sub.value = ''; tim.value = ''; not.value = '';
  await saveData();
  renderLogs();
  renderDashboard();
  renderAnalytics();
  showToast(`${min}分の学習を記録しました ◷`);
}

export function deleteLog(id) {
  openModal('このログを削除しますか？', async () => {
    state.logs = state.logs.filter(l => l.id !== id);
    await saveData();
    renderLogs();
    renderDashboard();
    renderAnalytics();
  });
}

// ── ログの分数インライン編集 ──────────────────────────
async function saveLogTime(id, newMin) {
  const log = state.logs.find(l => l.id === id);
  if (!log) return;
  if (isNaN(newMin) || newMin <= 0) { showToast('正しい分数を入力してください'); return; }
  log.time = newMin;
  await saveData();
  renderLogs();
  renderDashboard();
  renderAnalytics();
  showToast('ログを更新しました ✓');
}

// ── 描画 ─────────────────────────────────────────────
export function renderLogs() {
  const list = document.getElementById('logList');
  if (!list) return;
  list.innerHTML = '';

  const q        = (document.getElementById('logSearch')?.value || '').toLowerCase();
  const filtered = state.logs.filter(l =>
    !q || l.subject.toLowerCase().includes(q) || (l.note && l.note.toLowerCase().includes(q))
  );

  if (!filtered.length) { list.appendChild(emptyState('◷', '学習ログなし')); return; }

  filtered.forEach(log => {
    const item = el('div', { cls: 'log-item' });
    const left = el('div', { style: { flex: '1', minWidth: '0' } });

    left.appendChild(el('span', { cls: 'tag', text: log.subject }));

    // 分数 + インライン編集
    const timeRow   = el('div', { cls: 'log-edit-wrap' });
    const timeVal   = el('strong', { text: log.time + 'm', style: { fontFamily: "'DM Mono',monospace", fontSize: '15px' } });
    const editInp   = el('input',  { cls: 'log-edit-input', attr: { type: 'number', min: '1', placeholder: '分数' } });
    const editToggle= el('span',   { cls: 'icon-btn', text: '✎', style: { fontSize: '11px', padding: '2px 7px' } });
    const saveBtn   = el('button', { cls: 'log-edit-save', text: '保存' });

    editInp.style.display  = 'none';
    saveBtn.style.display  = 'none';
    editInp.value          = log.time;
    editToggle.title       = '分数を編集';

    editToggle.onclick = () => {
      const editing = editInp.style.display === 'block';
      timeVal.style.display  = editing ? ''      : 'none';
      editInp.style.display  = editing ? 'none'  : 'block';
      saveBtn.style.display  = editing ? 'none'  : 'inline-block';
      editToggle.textContent = editing ? '✎' : '✕';
      if (!editing) { editInp.focus(); editInp.select(); }
    };
    saveBtn.onclick = () => saveLogTime(log.id, parseInt(editInp.value));
    editInp.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

    timeRow.appendChild(timeVal);
    timeRow.appendChild(editInp);
    timeRow.appendChild(editToggle);
    timeRow.appendChild(saveBtn);
    left.appendChild(timeRow);

    if (log.note) left.appendChild(el('div', { cls: 'small', text: log.note, style: { marginTop: '3px' } }));
    left.appendChild(el('div', { cls: 'small', text: new Date(log.date).toLocaleDateString('ja-JP') }));

    const del     = el('button', { cls: 'delete-btn', text: '削除' });
    del.onclick   = () => deleteLog(log.id);
    item.appendChild(left);
    item.appendChild(del);
    list.appendChild(item);
  });
}
