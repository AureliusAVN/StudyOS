'use strict';

import { state } from './storage.js';

// ── 設定取得 ──────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey() { return state.settings.groqApiKey || ''; }
function getModel()  { return state.settings.groqModel  || 'llama-3.3-70b-versatile'; }

// ── 実行中フラグ（多重リクエスト防止）────────────────
let _nextRunning   = false;
let _reviewRunning = false;

// ── Groq疎通確認 ──────────────────────────────────────
export async function checkOllamaStatus() {
  const key = getApiKey();
  if (!key) return false;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch (err) {
    console.error('Groq status check failed:', err);
    return false;
  }
}

// ── 共通リクエスト ────────────────────────────────────
async function ollamaGenerate(prompt, maxTokens = 500) {
  const key = getApiKey();
  if (!key) throw new Error('Groq APIキーが設定されていません。Settingsで入力してください。');

  const res = await fetch(GROQ_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model:      getModel(),
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq HTTP ${res.status}: ${err?.error?.message || 'unknown error'}`);
  }

  const data = await res.json();
  console.log('GROQ RAW', data);

  return (data.choices?.[0]?.message?.content || '').trim();
}

// ── オフライン表示 ─────────────────────────────────────
function showOffline(containerEl) {
  containerEl.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'ai-offline';

  const title = document.createElement('strong');
  title.textContent = 'Groq API エラー';
  const br1  = document.createElement('br');
  const desc = document.createTextNode('以下を確認してください：');
  const br2  = document.createElement('br');
  const s1   = document.createTextNode('① Settings で Groq API キーを入力・保存');
  const br3  = document.createElement('br');
  const s2   = document.createTextNode('② https://console.groq.com でキーを取得');
  const br4  = document.createElement('br');
  const s3   = document.createTextNode('③ モデル名が正しいこと（例: llama-3.3-70b-versatile）');
  const br5  = document.createElement('br');

  const retryBtn = document.createElement('button');
  retryBtn.textContent = '🔄 再試行';
  retryBtn.className   = 'icon-btn';
  retryBtn.style.marginTop = '10px';
  retryBtn.onclick = () => runAINext(true);

  [title,br1,desc,br2,s1,br3,s2,br4,s3,br5,retryBtn].forEach(n => box.appendChild(n));
  containerEl.appendChild(box);
}

// ── AI Recommended Next Task ──────────────────────────
export async function runAINext(manualTrigger = false) {
  const loadEl = document.getElementById('aiNextLoading');
  const resEl  = document.getElementById('aiNextResult');
  if (!loadEl || !resEl) return;

  if (_nextRunning) return;

  if (!state.tasks.length && !state.logs.length) {
    loadEl.style.display = 'none';
    resEl.style.display  = 'block';
    resEl.textContent    = 'タスクかログを追加すると、AIが次にやることを提案します。';
    return;
  }

  const online = await checkOllamaStatus();
  if (!online) {
    loadEl.style.display = 'none';
    resEl.style.display  = 'block';
    showOffline(resEl);
    return;
  }

  _nextRunning         = true;
  loadEl.style.display = 'flex';
  resEl.style.display  = 'none';
  resEl.innerHTML      = '';

  const pending = state.tasks.filter(t => !t.done);
  const prompt  =
    `あなたは学習コーチです。以下のデータを分析して、今すぐやるべきタスクを1つ日本語で推薦してください。理由も1〜2文で。\n\n` +
    `未完了タスク:\n${
      pending.slice(0, 15).map(t =>
        `- [${t.priority.toUpperCase()}] ${t.text}` +
        (t.dueDate ? ` (期限:${t.dueDate})` : '') +
        (t.memo    ? ` メモ:${t.memo}`       : '')
      ).join('\n') || 'なし'
    }\n\n` +
    `直近の学習ログ:\n${
      state.logs.slice(0, 10).map(l =>
        `- ${l.subject} ${l.time}m (${l.date.slice(0, 10)})`
      ).join('\n') || 'なし'
    }\n\n` +
    `形式: 「タスク名」→ 理由。簡潔に2〜3文以内で。`;

  try {
    const text = await ollamaGenerate(prompt, 120);

    loadEl.style.display = 'none';
    resEl.style.display  = 'block';
    resEl.className      = 'ai-result';
    resEl.innerHTML      = '';

    const result = document.createElement('div');
    result.textContent = text || '推薦を取得できませんでした。';

    const btn = document.createElement('button');
    btn.className   = 'primary-btn';
    btn.textContent = '🔄 再分析';
    btn.style.marginTop = '12px';
    btn.onclick = () => runAINext(true);

    resEl.appendChild(result);
    resEl.appendChild(btn);
  } catch (err) {
    console.error(err);
    loadEl.style.display = 'none';
    resEl.style.display  = 'block';
    resEl.className      = 'ai-offline';
    resEl.textContent    = 'AI実行エラー: ' + err.message;
  } finally {
    _nextRunning = false;
  }
}

// ── AI Review Analysis ────────────────────────────────
export async function runAIReview() {
  if (_reviewRunning) return;
  const el2 = document.getElementById('aiReviewResult');
  if (!el2) return;

  if (!state.logs.length) {
    el2.innerHTML   = '';
    el2.textContent = '学習ログがありません。';
    return;
  }

  const online = await checkOllamaStatus();
  if (!online) { showOffline(el2); return; }

  _reviewRunning  = true;
  el2.innerHTML   = '';
  const loading   = document.createElement('div');
  loading.className   = 'ai-loading';
  loading.textContent = '学習ログを分析中...';
  el2.appendChild(loading);

  const summary = state.logs.slice(0, 20).map(l =>
    `${l.subject} ${l.time}m (${l.date.slice(0, 10)})` + (l.note ? ` - ${l.note}` : '')
  ).join('\n');

  const prompt =
    `以下の学習ログを分析し、日本語で学習アドバイスを提供してください。\n\n` +
    `学習ログ:\n${summary}\n\n` +
    `1. 学習パターンの特徴（科目バランス・時間傾向）\n2. 改善できる点\n3. 具体的なアドバイス2〜3点\n\n簡潔に300字以内で。`;

  try {
    const text      = await ollamaGenerate(prompt, 500);
    el2.innerHTML   = '';
    const div       = document.createElement('div');
    div.className   = 'ai-result';
    div.textContent = text || '分析できませんでした。';
    el2.appendChild(div);
  } catch {
    el2.innerHTML = '';
    showOffline(el2);
  } finally {
    _reviewRunning = false;
  }
}

// ── AI Weak Subject Detection ─────────────────────────
export async function runAIWeakDetect() {
  if (_reviewRunning) return;
  const el2 = document.getElementById('aiReviewResult');
  if (!el2) return;

  if (!state.logs.length) {
    el2.innerHTML   = '';
    el2.textContent = '学習ログがありません。';
    return;
  }

  const online = await checkOllamaStatus();
  if (!online) { showOffline(el2); return; }

  _reviewRunning  = true;
  el2.innerHTML   = '';
  const loading   = document.createElement('div');
  loading.className   = 'ai-loading';
  loading.textContent = '弱点科目を検出中...';
  el2.appendChild(loading);

  const smap = {};
  state.logs.forEach(l => { smap[l.subject] = (smap[l.subject] || 0) + l.time; });
  const sorted = Object.entries(smap).sort((a, b) => a[1] - b[1]);

  const prompt =
    `科目別学習時間（少ない順）:\n${sorted.map(([s, m]) => `${s}: 合計${m}分`).join('\n')}\n\n` +
    `弱点科目を分析し、具体的な学習提案を日本語200字以内で。\n` +
    `1. 最も手薄な科目と問題点\n2. バランス改善のための週次計画案\n3. モチベーション維持のヒント`;

  try {
    const text      = await ollamaGenerate(prompt, 400);
    el2.innerHTML   = '';
    const div       = document.createElement('div');
    div.className   = 'ai-result';
    div.textContent = text || '分析できませんでした。';
    el2.appendChild(div);
  } catch {
    el2.innerHTML = '';
    showOffline(el2);
  } finally {
    _reviewRunning = false;
  }
}

// ── サイドバー ステータスバッジ ───────────────────────
let _statusChecking = false;
export async function updateAIStatusBadge() {
  if (_statusChecking) return;
  _statusChecking   = true;
  const dot  = document.getElementById('aiStatusDot');
  const text = document.getElementById('aiStatusText');
  if (!dot || !text) { _statusChecking = false; return; }

  const online       = await checkOllamaStatus();
  dot.className      = 'ai-status-dot ' + (online ? 'online' : 'offline');
  text.textContent   = online ? `Groq: ${getModel()} 接続中` : 'Groq API オフライン';
  _statusChecking    = false;
}