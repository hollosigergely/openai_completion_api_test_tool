const DEFAULT_URLS = {
  chat: 'https://api.openai.com/v1/chat/completions',
  embeddings: 'https://api.openai.com/v1/embeddings',
};

const el = (id) => document.getElementById(id);

const state = {
  activeTab: 'chat',
  urls: { ...DEFAULT_URLS },
  chatBodyDirty: false,
  embBodyDirty: false,
  lastResponseBody: null,
};

// ---------- Login ----------

el('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = el('login-password').value;
  el('login-error').textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      el('login-error').textContent = data.error || 'Login failed.';
      return;
    }
    el('login-screen').hidden = true;
    el('tool-screen').hidden = false;
    initTool();
  } catch (err) {
    el('login-error').textContent = 'Could not reach the server: ' + err.message;
  }
});

// ---------- Tool init ----------

function initTool() {
  el('endpoint-url').value = state.urls[state.activeTab];
  renderChatMessages([
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ]);
  syncChatBody();
  syncEmbeddingsBody();
  updateRawRequestPreview();

  el('endpoint-url').addEventListener('input', () => {
    state.urls[state.activeTab] = el('endpoint-url').value;
    updateRawRequestPreview();
  });
  el('api-key').addEventListener('input', updateRawRequestPreview);
  el('mask-key-preview').addEventListener('change', updateRawRequestPreview);

  el('toggle-key-visibility').addEventListener('click', () => {
    const keyInput = el('api-key');
    const show = keyInput.type === 'password';
    keyInput.type = show ? 'text' : 'password';
    el('toggle-key-visibility').textContent = show ? 'hide' : 'show';
  });

  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  el('endpoint-toggle').addEventListener('click', () => {
    const toggle = el('endpoint-toggle');
    const content = el('endpoint-content');
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    content.hidden = expanded;
  });

  el('add-message').addEventListener('click', () => {
    addMessageRow('user', '');
    syncChatBody();
  });

  el('chat-model').addEventListener('input', syncChatBody);
  el('chat-max-tokens').addEventListener('input', syncChatBody);
  el('chat-temperature').addEventListener('input', () => {
    el('chat-temperature-value').textContent = el('chat-temperature').value;
    syncChatBody();
  });

  el('chat-body').addEventListener('input', () => {
    state.chatBodyDirty = true;
    updateRawRequestPreview();
  });
  el('chat-resync').addEventListener('click', () => {
    state.chatBodyDirty = false;
    syncChatBody();
  });

  el('emb-model').addEventListener('input', syncEmbeddingsBody);
  el('emb-text-a').addEventListener('input', syncEmbeddingsBody);
  el('emb-text-b').addEventListener('input', syncEmbeddingsBody);
  el('emb-body').addEventListener('input', () => {
    state.embBodyDirty = true;
    updateRawRequestPreview();
  });
  el('emb-resync').addEventListener('click', () => {
    state.embBodyDirty = false;
    syncEmbeddingsBody();
  });

  el('send-button').addEventListener('click', sendRequest);
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
  el('endpoint-url').value = state.urls[tab];
  updateRawRequestPreview();
}

// ---------- Chat tab ----------

function renderChatMessages(messages) {
  el('chat-messages').innerHTML = '';
  messages.forEach((m) => addMessageRow(m.role, m.content));
}

function addMessageRow(role, content) {
  const row = document.createElement('div');
  row.className = 'message-row';

  const select = document.createElement('select');
  ['system', 'user', 'assistant'].forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    if (r === role) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', syncChatBody);

  const textarea = document.createElement('textarea');
  textarea.rows = 2;
  textarea.value = content;
  textarea.addEventListener('input', syncChatBody);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    row.remove();
    syncChatBody();
  });

  row.append(select, textarea, removeBtn);
  el('chat-messages').appendChild(row);
}

function syncChatBody() {
  if (state.chatBodyDirty) return;
  const messages = Array.from(el('chat-messages').children).map((row) => ({
    role: row.querySelector('select').value,
    content: row.querySelector('textarea').value,
  }));
  const body = {
    model: el('chat-model').value,
    messages,
    temperature: Number(el('chat-temperature').value),
    max_tokens: Number(el('chat-max-tokens').value),
  };
  el('chat-body').value = JSON.stringify(body, null, 2);
  updateRawRequestPreview();
}

// ---------- Embeddings tab ----------

function syncEmbeddingsBody() {
  if (state.embBodyDirty) return;
  const textA = el('emb-text-a').value;
  const textB = el('emb-text-b').value.trim();
  const input = textB ? [textA, textB] : [textA];
  const body = {
    model: el('emb-model').value,
    input,
  };
  el('emb-body').value = JSON.stringify(body, null, 2);
  updateRawRequestPreview();
}

// ---------- Raw request preview ----------

function maskToken(token) {
  if (token.length <= 8) return '*'.repeat(token.length);
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function currentBodyTextareaId() {
  return state.activeTab === 'chat' ? 'chat-body' : 'emb-body';
}

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = el('api-key').value.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function updateRawRequestPreview() {
  const url = el('endpoint-url').value;
  const headers = buildHeaders();
  const displayHeaders = { ...headers };
  const apiKey = el('api-key').value.trim();
  if (apiKey && el('mask-key-preview').checked) {
    displayHeaders.Authorization = `Bearer ${maskToken(apiKey)}`;
  }

  let bodyPreview = el(currentBodyTextareaId()).value;
  try {
    bodyPreview = JSON.parse(bodyPreview);
  } catch {
    // leave as raw string if it's not valid JSON yet (mid-edit)
  }

  const preview = {
    method: 'POST',
    url,
    headers: displayHeaders,
    body: bodyPreview,
  };
  el('raw-request').textContent = JSON.stringify(preview, null, 2);
  el('endpoint-summary').textContent = `${url} — ${apiKey ? 'key set' : 'no key'}`;
}

// ---------- Send ----------

function truncateForDisplay(value, maxLen = 8) {
  if (Array.isArray(value)) {
    if (value.length > maxLen && value.every((v) => typeof v === 'number')) {
      const rounded = value.slice(0, maxLen).map((n) => Math.round(n * 1e6) / 1e6);
      return [...rounded, `… ${value.length - maxLen} more values`];
    }
    return value.map((v) => truncateForDisplay(v, maxLen));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = truncateForDisplay(v, maxLen);
    return out;
  }
  return value;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function sendRequest() {
  const url = el('endpoint-url').value;
  const headers = buildHeaders();
  const bodyText = el(currentBodyTextareaId()).value;

  el('similarity-result').hidden = true;
  el('raw-response').textContent = 'Sending…';

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (err) {
    el('raw-response').textContent = 'Request body is not valid JSON:\n' + err.message;
    return;
  }

  try {
    const res = await fetch('/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: { url, method: 'POST', headers, body } }),
    });
    const relayResult = await res.json();

    if (!res.ok) {
      el('raw-response').textContent = JSON.stringify(relayResult, null, 2);
      return;
    }

    state.lastResponseBody = relayResult.body;
    el('raw-response').textContent = JSON.stringify(
      { status: relayResult.status, body: truncateForDisplay(relayResult.body) },
      null,
      2
    );

    if (state.activeTab === 'embeddings') {
      maybeShowSimilarity(relayResult.body);
    }
  } catch (err) {
    el('raw-response').textContent = 'Network error: ' + err.message;
  }
}

function maybeShowSimilarity(responseBody) {
  const data = responseBody && responseBody.data;
  if (!Array.isArray(data) || data.length < 2) return;
  const sim = cosineSimilarity(data[0].embedding, data[1].embedding);
  const box = el('similarity-result');
  box.hidden = false;
  box.textContent = `Cosine similarity between Text A and Text B: ${sim.toFixed(4)} (1.0 = identical meaning, 0 = unrelated)`;
}
