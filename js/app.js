'use strict';

import { state, loadData, saveData, exportJSON, importJSON, genId } from './storage.js';
import { openModal, closeModal, showToast, initModal }               from './modal.js';
import { renderTasks, addTask, quickAddTask, setTaskFilter }          from './tasks.js';
import { renderLogs, addLog, onSubjectInput, closeAutocomplete }      from './logs.js';
import { renderReviews, saveReview }                                   from './review.js';
import { renderDashboard, setDailyGoal }                              from './dashboard.js';
import { renderAnalytics }                                             from './analytics.js';
import { runAINext, runAIReview, runAIWeakDetect, updateAIStatusBadge } from './ai.js';
import { setAuthCallbacks }                                            from './auth.js';

// ── グローバル公開（HTML onclick 用）─────────────────
window.showPage           = showPage;
window.addTask            = addTask;
window.quickAddTask       = quickAddTask;
window.setTaskFilter      = setTaskFilter;
window.addLog             = addLog;
window.onSubjectInput     = onSubjectInput;
window.closeAutocomplete  = closeAutocomplete;
window.saveReview         = saveReview;
window.runAINext          = () => runAINext(true);
window.runAIReview        = runAIReview;
window.runAIWeakDetect    = runAIWeakDetect;
window.setDailyGoal       = setDailyGoal;
window.closeModal         = closeModal;
window.exportData         = exportData;
window.importData         = importData;
window.clearAllData       = clearAllData;
window.saveOllamaSettings = saveGroqSettings;
window.renderTasks        = renderTasks;
window.renderLogs         = renderLogs;
window.renderReviews      = renderReviews;

// ── Clock ─────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const n = new Date();
  el.textContent = String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}
updateClock();
setInterval(updateClock, 60000);

// ── ページ切り替え ────────────────────────────────────
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  btn.classList.add('active');
}

// ── Export / Import / Clear ───────────────────────────
function exportData() {
  exportJSON();
  showToast('バックアップを保存しました ⬇');
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const d = await importJSON(file);
    openModal(
      `${d.tasks?.length||0}件のタスク、${d.logs?.length||0}件のログをインポートします。現在のデータは上書きされます。`,
      async () => {
        state.tasks   = (d.tasks   ||[]).map(t => ({ priority:'med', dueDate:'', memo:'', ...t, id: t.id||genId() }));
        state.logs    = (d.logs    ||[]).map(l => ({ ...l, id: l.id||genId() }));
        state.reviews = (d.reviews ||[]).map(r => ({ ...r, id: r.id||genId() }));
        state.settings= { ...state.settings, ...(d.settings||{}) };
        restoreSettingsUI();
        await saveData();
        renderAll();
        showToast('インポート完了 ⬆');
      }
    );
  } catch {
    showToast('JSONの読み込みに失敗しました');
  }
  e.target.value = '';
}

function clearAllData() {
  openModal('全データを削除します。この操作は取り消せません。', async () => {
    state.tasks    = [];
    state.logs     = [];
    state.reviews  = [];
    state.settings = { dailyGoal:0, ollamaUrl:'http://localhost:11434', ollamaModel:'qwen3:8b' };
    restoreSettingsUI();
    await saveData();
    renderAll();
    showToast('データを削除しました');
  });
}

// ── Groq 設定 ─────────────────────────────────────────
async function saveGroqSettings() {
  const keyEl   = document.getElementById('ollamaUrl');   // 既存のollamaUrl入力欄をAPIキー入力に流用
  const modelEl = document.getElementById('ollamaModel');
  if (!keyEl || !modelEl) return;

  const key   = keyEl.value.trim();
  const model = modelEl.value.trim();
  if (!key || !model) { showToast(process.env.GROQ_API_KEY); return; }

  state.settings.groqApiKey  = key;
  state.settings.groqModel   = model;

  const badge = document.getElementById('modelBadge');
  if (badge) badge.textContent = model;

  await saveData();
  showToast('Groq設定を保存しました');
  updateAIStatusBadge();
}

function restoreSettingsUI() {
  const keyEl   = document.getElementById('ollamaUrl');   // APIキー入力欄
  const modelEl = document.getElementById('ollamaModel');
  const goalEl  = document.getElementById('goalInput');
  const badge   = document.getElementById('modelBadge');
  if (keyEl)   keyEl.value   = state.settings.groqApiKey  || '';
  if (modelEl) modelEl.value = state.settings.groqModel   || 'llama-3.3-70b-versatile';
  if (goalEl && state.settings.dailyGoal) goalEl.value = state.settings.dailyGoal;
  if (badge)   badge.textContent = state.settings.groqModel || 'llama-3.3-70b-versatile';
}

// ── 全描画 ────────────────────────────────────────────
function renderAll() {
  renderTasks();
  renderDashboard();
  renderLogs();
  renderReviews();
  renderAnalytics();
}

// ── キーボードショートカット ──────────────────────────
function bindKeyboard() {
  [
    ['quickTask',    'Enter', () => quickAddTask()],
    ['taskInput',    'Enter', () => addTask()],
    ['subjectInput', 'Enter', () => document.getElementById('timeInput')?.focus()],
    ['timeInput',    'Enter', () => addLog()],
    ['goalInput',    'Enter', () => setDailyGoal()],
  ].forEach(([id, key, fn]) => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === key) fn(); });
  });
}

// ── AI カード初期化 ───────────────────────────────────
function setupAINextButton() {
  const loadEl = document.getElementById('aiNextLoading');
  const resEl  = document.getElementById('aiNextResult');
  if (!loadEl || !resEl) return;

  loadEl.style.display = 'none';
  resEl.style.display  = 'block';

  const hint = document.createElement('div');
  hint.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;';

  const msg = document.createElement('span');
  msg.className   = 'small';
  msg.style.marginTop = '0';
  msg.textContent = 'Ollamaが起動していれば、タスクの優先順位をAIが提案します。';

  const btn = document.createElement('button');
  btn.className   = 'primary-btn';
  btn.textContent = '⚡ 分析する';
  btn.style.flexShrink = '0';
  btn.onclick = () => runAINext(true);

  hint.appendChild(msg);
  hint.appendChild(btn);
  resEl.appendChild(hint);
}

// ── ログイン後に呼ばれる初期化（auth.js 経由）────────
let _initialized = false;

async function onLogin(user) {
  if (_initialized) {
    // 再ログイン時はリロードせず描画のみ更新
    renderAll();
    return;
  }
  _initialized = true;

  // Modal のイベントリスナーを登録（DOM確定後）
  initModal();

  await loadData();
  restoreSettingsUI();
  renderAll();
  bindKeyboard();
  setupAINextButton();
  updateAIStatusBadge();
}

function onLogout() {
  _initialized = false;
  // state をリセット（別アカウントでログインしたとき用）
  state.tasks    = [];
  state.logs     = [];
  state.reviews  = [];
}

// ── auth.js にコールバックを渡す ─────────────────────
setAuthCallbacks(onLogin, onLogout);