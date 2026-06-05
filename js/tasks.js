'use strict';

import { state, saveData, genId } from './storage.js';
import { openModal, showToast }   from './modal.js';
import { renderDashboard }        from './dashboard.js';

// ── フィルター状態 ────────────────────────────────────
let taskFilter    = 'all';
let editingTaskId = null;

export function setTaskFilter(f, btn) {
  taskFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

// ── ヘルパー ──────────────────────────────────────────
function priLabel(p) { return p === 'high' ? 'HIGH' : p === 'low' ? 'LOW' : 'MED'; }
function priCls(p)   { return p === 'high' ? 'pri-high' : p === 'low' ? 'pri-low' : 'pri-med'; }

function toDateKey(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function todayKey()   { return toDateKey(new Date()); }

function dateLabel(iso) {
  if (!iso) return null;
  const diff = Math.round((toDateKey(iso + 'T00:00:00') - todayKey()) / 86400000);
  if (diff < 0)  return { cls: 'due-overdue', text: `${Math.abs(diff)}日超過` };
  if (diff === 0) return { cls: 'due-today',   text: '今日' };
  if (diff <= 3)  return { cls: 'due-soon',    text: `${diff}日後` };
  return { cls: 'due-normal', text: iso.slice(5).replace('-', '/') };
}

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

// ── CRUD ─────────────────────────────────────────────
export async function addTask() {
  const inp  = document.getElementById('taskInput');
  const pri  = document.getElementById('taskPriority');
  const due  = document.getElementById('taskDue');
  const memo = document.getElementById('taskMemoInput');
  const text = inp.value.trim();
  if (!text) return;

  state.tasks.unshift({
    id: genId(), text, done: false,
    priority: pri.value, dueDate: due.value,
    memo: memo.value.trim(),
    date: new Date().toISOString(),
  });

  inp.value = ''; due.value = ''; memo.value = '';
  await saveData();
  renderTasks();
  renderDashboard();
  showToast('タスクを追加しました ✓');
}

export async function quickAddTask() {
  const inp  = document.getElementById('quickTask');
  const pri  = document.getElementById('quickPriority');
  const due  = document.getElementById('quickDue');
  const text = inp.value.trim();
  if (!text) return;

  state.tasks.unshift({
    id: genId(), text, done: false,
    priority: pri.value, dueDate: due.value,
    memo: '', date: new Date().toISOString(),
  });

  inp.value = ''; due.value = '';
  await saveData();
  renderTasks();
  renderDashboard();
  showToast('タスクを追加しました ✓');
}

export async function toggleTask(id) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  await saveData();
  renderTasks();
  renderDashboard();
}

export function deleteTask(id) {
  openModal('このタスクを削除しますか？', async () => {
    state.tasks = state.tasks.filter(t => t.id !== id);
    await saveData();
    renderTasks();
    renderDashboard();
  });
}

// ── インライン編集 ────────────────────────────────────
function startEditTask(id, bodyEl) {
  if (editingTaskId === id) return;
  editingTaskId = id;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  bodyEl.innerHTML = '';

  const wrap     = el('div', { cls: 'inline-edit-wrap' });
  const txtInp   = el('input',  { cls: 'inline-edit-input', attr: { type: 'text',   placeholder: 'タスク名' } });
  const memoInp  = el('input',  { cls: 'inline-edit-input', attr: { type: 'text',   placeholder: 'メモ（任意）' } });
  const row      = el('div',    { cls: 'inline-edit-row' });
  const saveBtn  = el('button', { cls: 'inline-edit-save',   text: '保存' });
  const cancelBtn= el('button', { cls: 'inline-edit-cancel', text: 'キャンセル' });

  txtInp.value  = task.text;
  memoInp.value = task.memo || '';

  saveBtn.onclick = async () => {
    const newText = txtInp.value.trim();
    if (!newText) { showToast('タスク名を入力してください'); return; }
    task.text     = newText;
    task.memo     = memoInp.value.trim();
    editingTaskId = null;
    await saveData();
    renderTasks();
    renderDashboard();
    showToast('タスクを更新しました ✓');
  };
  cancelBtn.onclick = () => { editingTaskId = null; renderTasks(); };
  txtInp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  row.appendChild(saveBtn);
  row.appendChild(cancelBtn);
  wrap.appendChild(txtInp);
  wrap.appendChild(memoInp);
  wrap.appendChild(row);
  bodyEl.appendChild(wrap);
  txtInp.focus();
  txtInp.select();
}

// ── 描画 ─────────────────────────────────────────────
export function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;
  list.innerHTML = '';

  const q  = (document.getElementById('taskSearch')?.value || '').toLowerCase();
  const td = todayKey();

  let filtered = state.tasks.filter(t => {
    const matchText = !q || t.text.toLowerCase().includes(q) || (t.memo && t.memo.toLowerCase().includes(q));
    if (!matchText) return false;
    if (taskFilter === 'active')  return !t.done;
    if (taskFilter === 'done')    return  t.done;
    if (taskFilter === 'overdue') return !t.done && t.dueDate && toDateKey(t.dueDate + 'T00:00:00') < td;
    if (taskFilter === 'high')    return t.priority === 'high';
    return true;
  });

  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = { high: 0, med: 1, low: 2 };
    if (pa[a.priority] !== pa[b.priority]) return pa[a.priority] - pa[b.priority];
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return  1;
    return 0;
  });

  if (!filtered.length) { list.appendChild(emptyState('✓', 'タスクなし')); return; }

  filtered.forEach(task => {
    const item = el('div', { cls: 'task-item' });
    const left = el('div', { cls: 'task-left' });
    const body = el('div', { cls: 'task-body' });

    const chk = document.createElement('input');
    chk.type    = 'checkbox';
    chk.checked = task.done;
    chk.onchange = () => toggleTask(task.id);

    // インライン編集モード
    if (editingTaskId === task.id) {
      left.appendChild(chk);
      left.appendChild(body);
      item.appendChild(left);
      list.appendChild(item);
      startEditTask(task.id, body);
      return;
    }

    // 通常表示
    const txt = el('span', { cls: 'task-text' + (task.done ? ' completed' : ''), text: task.text });
    txt.title   = 'クリックして編集';
    txt.onclick = () => startEditTask(task.id, body);
    body.appendChild(txt);

    if (task.memo) body.appendChild(el('div', { cls: 'task-memo', text: task.memo }));

    const meta    = el('div', { cls: 'task-meta' });
    const badge   = el('span', { cls: 'priority-badge ' + priCls(task.priority), text: priLabel(task.priority) });
    meta.appendChild(badge);

    if (task.dueDate) {
      const dl = dateLabel(task.dueDate);
      if (dl) meta.appendChild(el('span', { cls: 'due-badge ' + dl.cls, text: dl.text }));
    }

    const editBtn   = el('span', { cls: 'icon-btn', text: '✎', style: { fontSize: '11px', padding: '2px 7px' } });
    editBtn.title   = '編集';
    editBtn.onclick = () => startEditTask(task.id, body);
    meta.appendChild(editBtn);

    body.appendChild(meta);
    left.appendChild(chk);
    left.appendChild(body);

    const del     = el('button', { cls: 'delete-btn', text: '削除' });
    del.onclick   = () => deleteTask(task.id);

    item.appendChild(left);
    item.appendChild(del);
    list.appendChild(item);
  });
}
