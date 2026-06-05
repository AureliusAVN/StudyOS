'use strict';

// ── ストレージ抽象レイヤー ──────────────────────────────
// window.storage API（Claude Artifacts環境）があれば使い、
// なければ localStorage にフォールバックする。

const USE_WIN = typeof window.storage !== 'undefined';

// ── 内部状態 ──
export const state = {
  tasks:    [],
  logs:     [],
  reviews:  [],
  settings: { dailyGoal: 0, ollamaUrl: 'http://localhost:11434', ollamaModel: 'qwen3:8b' },
};

// ── 保存 ──────────────────────────────────────────────
export async function saveData() {
  const entries = {
    tasks:    JSON.stringify(state.tasks),
    logs:     JSON.stringify(state.logs),
    reviews:  JSON.stringify(state.reviews),
    settings: JSON.stringify(state.settings),
  };

  if (USE_WIN) {
    await Promise.all(
      Object.entries(entries).map(([k, v]) => window.storage.set(k, v))
    );
  } else {
    Object.entries(entries).forEach(([k, v]) => localStorage.setItem(k, v));
  }
}

// ── 読み込み ──────────────────────────────────────────
export async function loadData() {
  try {
    if (USE_WIN) {
      const [t, l, r, s] = await Promise.all([
        window.storage.get('tasks'),
        window.storage.get('logs'),
        window.storage.get('reviews'),
        window.storage.get('settings'),
      ]);
      state.tasks    = t ? JSON.parse(t.value) : [];
      state.logs     = l ? JSON.parse(l.value) : [];
      state.reviews  = r ? JSON.parse(r.value) : [];
      state.settings = s ? { ...state.settings, ...JSON.parse(s.value) } : state.settings;
    } else {
      state.tasks    = JSON.parse(localStorage.getItem('tasks')    || '[]');
      state.logs     = JSON.parse(localStorage.getItem('logs')     || '[]');
      state.reviews  = JSON.parse(localStorage.getItem('reviews')  || '[]');
      state.settings = {
        ...state.settings,
        ...JSON.parse(localStorage.getItem('settings') || '{}'),
      };
    }
  } catch (e) {
    console.error('[storage] loadData failed:', e);
    state.tasks    = [];
    state.logs     = [];
    state.reviews  = [];
  }

  // マイグレーション: 旧データに不足フィールドを補完
  state.tasks   = state.tasks.map(t   => ({ priority: 'med', dueDate: '', memo: '', ...t, id: t.id   || genId() }));
  state.logs    = state.logs.map(l    => ({ ...l,   id: l.id   || genId() }));
  state.reviews = state.reviews.map(r => ({ ...r,   id: r.id   || genId() }));
}

// ── ID生成 ────────────────────────────────────────────
export function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Export JSON ───────────────────────────────────────
export function exportJSON() {
  const payload = {
    version:    '5.5',
    exportedAt: new Date().toISOString(),
    tasks:      state.tasks,
    logs:       state.logs,
    reviews:    state.reviews,
    settings:   state.settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'studyos-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import JSON ───────────────────────────────────────
export async function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        resolve(d);
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsText(file);
  });
}
