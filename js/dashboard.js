'use strict';

import { state, saveData } from './storage.js';
import { showToast }       from './modal.js';
import { renderAnalytics } from './analytics.js';

// ── DOM helper ───────────────────────────────────────
function el(tag, opts = {}) {
  const n = document.createElement(tag);
  if (opts.cls)              n.className   = opts.cls;
  if (opts.text !== undefined) n.textContent = opts.text;
  if (opts.style)            Object.assign(n.style, opts.style);
  return n;
}

function toDateKey(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function todayKey()   { return toDateKey(new Date()); }
function weekAgoKey() { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d.getTime(); }

function dateLabel(iso) {
  if (!iso) return null;
  const diff = Math.round((toDateKey(iso + 'T00:00:00') - todayKey()) / 86400000);
  if (diff < 0)  return { cls: 'due-overdue', text: `${Math.abs(diff)}日超過` };
  if (diff === 0) return { cls: 'due-today',   text: '今日' };
  if (diff <= 3)  return { cls: 'due-soon',    text: `${diff}日後` };
  return { cls: 'due-normal', text: iso.slice(5).replace('-', '/') };
}

// ── Daily Goal ────────────────────────────────────────
export async function setDailyGoal() {
  const v = parseInt(document.getElementById('goalInput').value);
  if (isNaN(v) || v <= 0) { showToast('正しい分数を入力してください'); return; }
  state.settings.dailyGoal = v;
  await saveData();
  renderDashboard();
  showToast(`目標を ${v}分 に設定しました`);
}

function renderGoal(todayMin) {
  const goal   = state.settings.dailyGoal || 0;
  const fill   = document.getElementById('goalFill');
  const remain = document.getElementById('goalRemain');

  document.getElementById('goalCurrent').textContent = todayMin;
  document.getElementById('goalTarget').textContent  = goal || '—';

  if (!goal) {
    fill.style.width   = '0%';
    remain.textContent = '目標を設定してください';
    remain.className   = 'goal-remain';
    return;
  }

  const pct = Math.min((todayMin / goal) * 100, 100);
  fill.style.width = pct + '%';

  if (pct >= 100) {
    remain.textContent = '🎉 目標達成！';
    remain.className   = 'goal-remain done';
  } else {
    remain.textContent = `あと ${goal - todayMin}分`;
    remain.className   = 'goal-remain remaining';
  }
}

// ── Streak ───────────────────────────────────────────
function renderStreak() {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    if (state.logs.some(l => toDateKey(l.date) === d.getTime())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  document.getElementById('streakCount').textContent = streak;
  document.getElementById('streakMsg').textContent   =
    streak === 0  ? '今日ログを記録しよう' :
    streak >= 7   ? '1週間以上継続中🎉'   : '継続中！';
}

// ── Due groups ───────────────────────────────────────
function renderDueGroups(td) {
  const overdue  = state.tasks.filter(t => !t.done && t.dueDate && toDateKey(t.dueDate + 'T00:00:00') < td);
  const dueToday = state.tasks.filter(t => !t.done && t.dueDate && toDateKey(t.dueDate + 'T00:00:00') === td);
  const upcoming = state.tasks.filter(t => !t.done && t.dueDate && toDateKey(t.dueDate + 'T00:00:00') > td && toDateKey(t.dueDate + 'T00:00:00') <= td + 3 * 86400000);

  function fillGroup(elId, arr) {
    const c = document.getElementById(elId);
    if (!c) return;
    c.innerHTML = '';
    if (!arr.length) {
      c.appendChild(el('div', { cls: 'small', style: { padding: '4px 0' }, text: 'なし' }));
      return;
    }
    arr.forEach(t => {
      const row = el('div', { style: { marginBottom: '6px' } });
      row.appendChild(el('div', { cls: 'small', text: t.text, style: { marginTop: '0', marginBottom: '3px', color: 'var(--text)' } }));
      const dl = dateLabel(t.dueDate);
      row.appendChild(el('span', { cls: 'due-badge ' + (dl ? dl.cls : 'due-normal'), text: dl ? dl.text : t.dueDate }));
      c.appendChild(row);
    });
  }

  fillGroup('overdueList',  overdue);
  fillGroup('dueTodayList', dueToday);
  fillGroup('upcomingList', upcoming);
}

// ── メイン描画 ────────────────────────────────────────
export function renderDashboard() {
  const td = todayKey();

  // Today's Tasks
  const dash = document.getElementById('dashboardTasks');
  if (dash) {
    dash.innerHTML = '';
    const todayTasks = state.tasks.filter(t => toDateKey(t.date) === td);
    if (!todayTasks.length) {
      dash.appendChild(el('div', { cls: 'small', style: { padding: '4px 0' }, text: '今日のタスクなし' }));
    } else {
      todayTasks.slice(0, 5).forEach(t => {
        const row = el('div', { cls: 'dashboard-task' });
        row.appendChild(el('span', { cls: t.done ? 'dash-check' : 'dash-box', text: t.done ? '✓' : '□' }));
        const span = el('span', { text: t.text });
        if (t.done) span.style.textDecoration = 'line-through';
        row.appendChild(span);
        dash.appendChild(row);
      });
      if (todayTasks.length > 5) dash.appendChild(el('div', { cls: 'small', text: `…他 ${todayTasks.length - 5} 件` }));
    }
  }

  // Task Progress
  const completed = state.tasks.filter(t => t.done).length;
  const pct       = state.tasks.length ? Math.round((completed / state.tasks.length) * 100) : 0;
  const ptEl      = document.getElementById('progressText');
  const pfEl      = document.getElementById('progressFill');
  const pdEl      = document.getElementById('progressDetail');
  if (ptEl) ptEl.textContent   = pct + '%';
  if (pfEl) pfEl.style.width   = pct + '%';
  if (pdEl) pdEl.textContent   = state.tasks.length ? `${completed} / ${state.tasks.length} 件完了` : 'タスクなし';

  // Study Time
  const tot    = state.logs.reduce((s, l) => s + l.time, 0);
  const todMin = state.logs.filter(l => toDateKey(l.date) === td).reduce((s, l) => s + l.time, 0);
  const wkMin  = state.logs.filter(l => toDateKey(l.date) >= weekAgoKey()).reduce((s, l) => s + l.time, 0);
  const stEl   = document.getElementById('studyTime');
  const ttEl   = document.getElementById('todayTime');
  const wtEl   = document.getElementById('weekTime');
  if (stEl) stEl.textContent = tot;
  if (ttEl) ttEl.textContent = todMin + 'm';
  if (wtEl) wtEl.textContent = wkMin  + 'm';

  // Daily Goal
  renderGoal(todMin);

  // Streak
  renderStreak();

  // Due groups
  renderDueGroups(td);

  // Analytics（チャート・科目）
  renderAnalytics();
}
