'use strict';

import { state } from './storage.js';

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

function toDateKey(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

// ── 過去7日の棒グラフ ──────────────────────────────────
export function renderAnalytics() {
  _renderBarChart();
  _renderSubjectBreakdown();
}

function _renderBarChart() {
  const chart = document.getElementById('chart');
  if (!chart) return;
  chart.innerHTML = '';

  // 過去7日分のバケツを作成
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ date: d, minutes: 0 });
  }

  // ログを日付バケツに振り分け
  state.logs.forEach(l => {
    const lk = toDateKey(l.date);
    days.forEach(d => { if (lk === d.date.getTime()) d.minutes += l.time; });
  });

  const max = Math.max(...days.map(d => d.minutes), 1);

  days.forEach(day => {
    const wrap = el('div', { cls: 'bar-wrap' });
    const bar  = el('div', { cls: 'bar' });
    bar.style.height = (day.minutes === 0 ? 6 : Math.max((day.minutes / max) * 130, 6)) + 'px';
    bar.setAttribute('title', day.minutes + 'm');

    wrap.appendChild(bar);
    wrap.appendChild(el('div', { cls: 'bar-label', text: (day.date.getMonth() + 1) + '/' + day.date.getDate() }));
    wrap.appendChild(el('div', { cls: 'bar-val',   text: day.minutes + 'm' }));
    chart.appendChild(wrap);
  });
}

function _renderSubjectBreakdown() {
  const sb = document.getElementById('subjectBreakdown');
  if (!sb) return;
  sb.innerHTML = '';

  // 科目別合計
  const smap = {};
  state.logs.forEach(l => { smap[l.subject] = (smap[l.subject] || 0) + l.time; });
  const subjects = Object.entries(smap).sort((a, b) => b[1] - a[1]);

  if (!subjects.length) { sb.appendChild(emptyState('📊', 'データなし')); return; }

  const maxS = subjects[0][1];
  subjects.forEach(([name, mins]) => {
    const row  = el('div', { cls: 'subject-row' });
    const bw   = el('div', { cls: 'subject-bar-wrap' });
    const bg   = el('div', { cls: 'subject-bar-bg' });
    const fill = el('div', { cls: 'subject-bar-fill' });

    fill.style.width = ((mins / maxS) * 100) + '%';
    bg.appendChild(fill);
    bw.appendChild(bg);

    row.appendChild(el('span', { cls: 'subject-name', text: name }));
    row.appendChild(bw);
    row.appendChild(el('span', { cls: 'subject-time', text: mins + 'm' }));
    sb.appendChild(row);
  });
}
