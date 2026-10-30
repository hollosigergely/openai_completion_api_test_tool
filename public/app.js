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
  lastReply: null,
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

async function initTool() {
  try {
    const res = await fetch('/api/config');
    const cfg = res.ok ? await res.json() : {};
    if (cfg.defaultEndpoint) state.urls.chat = cfg.defaultEndpoint;
    if (cfg.defaultModel) el('chat-model').value = cfg.defaultModel;
  } catch {
    // fall back to the built-in defaults
  }
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
  el('chat-reasoning').addEventListener('change', syncChatBody);
  el('chat-tools').addEventListener('input', syncChatBody);
  el('insert-example-tool').addEventListener('click', () => {
    el('chat-tools').value = JSON.stringify(EXAMPLE_TOOLS, null, 2);
    syncChatBody();
  });
  el('chat-format').addEventListener('change', () => {
    el('chat-schema-fields').hidden = el('chat-format').value !== 'json_schema';
    syncChatBody();
  });
  el('chat-schema').addEventListener('input', syncChatBody);
  el('chat-schema-name').addEventListener('input', syncChatBody);
  el('chat-schema-strict').addEventListener('change', syncChatBody);
  el('insert-example-schema').addEventListener('click', () => {
    el('chat-schema-name').value = 'contact';
    el('chat-schema').value = JSON.stringify(EXAMPLE_SCHEMA, null, 2);
    syncChatBody();
  });
  el('append-reply').addEventListener('click', appendReplyToMessages);
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

  const dialog = el('json-dialog');
  document.querySelectorAll('.expand-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      el('json-dialog-title').textContent = btn.dataset.title;
      el('json-dialog-content').textContent = el(btn.dataset.target).textContent;
      dialog.showModal();
    });
  });
  el('json-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
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
  el('append-reply').hidden = !(tab === 'chat' && state.lastReply);
  updateRawRequestPreview();
}

// ---------- Chat tab ----------

function renderChatMessages(messages) {
  el('chat-messages').innerHTML = '';
  messages.forEach((m) => addMessageRow(m.role, m.content));
}

function addMessageRow(role, content, extra = {}) {
  const row = document.createElement('div');
  row.className = 'message-row';
  if (extra.toolCalls) row.dataset.toolCalls = JSON.stringify(extra.toolCalls);
  if (extra.toolCallId) row.dataset.toolCallId = extra.toolCallId;

  const select = document.createElement('select');
  ['system', 'user', 'assistant', 'tool'].forEach((r) => {
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
  if (extra.toolCalls) {
    textarea.placeholder = 'tool calls: ' + extra.toolCalls.map((c) => c.function.name).join(', ');
  } else if (extra.toolCallId) {
    textarea.placeholder = `result for ${extra.toolCallId} (type what the function returned)`;
  }
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

const EXAMPLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: 'City name, e.g. Budapest' } },
        required: ['city'],
      },
    },
  },
];

function parseTools() {
  const text = el('chat-tools').value.trim();
  const error = el('chat-tools-error');
  error.textContent = '';
  if (!text) return null;
  try {
    const tools = JSON.parse(text);
    if (!Array.isArray(tools)) throw new Error('must be a JSON array');
    return tools.length ? tools : null;
  } catch (err) {
    error.textContent = `Invalid tools JSON (${err.message}) — tools not sent`;
    return null;
  }
}

const EXAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    topics: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'email', 'sentiment', 'topics'],
  additionalProperties: false,
};

function parseSchema() {
  const text = el('chat-schema').value.trim();
  const error = el('chat-schema-error');
  error.textContent = '';
  if (!text) return null;
  try {
    const schema = JSON.parse(text);
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new Error('must be a JSON object');
    }
    return schema;
  } catch (err) {
    error.textContent = `Invalid schema JSON (${err.message}) — response_format not sent`;
    return null;
  }
}

function syncChatBody() {
  if (state.chatBodyDirty) return;
  const messages = Array.from(el('chat-messages').children).map((row) => {
    const message = {
      role: row.querySelector('select').value,
      content: row.querySelector('textarea').value,
    };
    if (row.dataset.toolCalls) {
      message.tool_calls = JSON.parse(row.dataset.toolCalls);
      if (!message.content) message.content = null;
    }
    if (row.dataset.toolCallId) message.tool_call_id = row.dataset.toolCallId;
    return message;
  });
  const body = {
    model: el('chat-model').value,
    messages,
    temperature: Number(el('chat-temperature').value),
    max_tokens: Number(el('chat-max-tokens').value),
  };
  const reasoning = el('chat-reasoning').value;
  if (reasoning) body.reasoning_effort = reasoning;
  const tools = parseTools();
  if (tools) body.tools = tools;
  const format = el('chat-format').value;
  if (format === 'json_object') {
    body.response_format = { type: 'json_object' };
  } else if (format === 'json_schema') {
    const schema = parseSchema();
    if (schema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: el('chat-schema-name').value || 'result',
          strict: el('chat-schema-strict').checked,
          schema,
        },
      };
    }
  }
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
  el('parsed-result').hidden = true;
  el('append-reply').hidden = true;
  state.lastReply = null;
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
    } else {
      maybeOfferAppend(relayResult.body);
      maybeShowParsed(body, relayResult.body);
    }
  } catch (err) {
    el('raw-response').textContent = 'Network error: ' + err.message;
  }
}

function maybeOfferAppend(responseBody) {
  const message = responseBody && responseBody.choices && responseBody.choices[0] && responseBody.choices[0].message;
  if (!message) return;
  const toolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length ? message.tool_calls : null;
  if (!toolCalls && typeof message.content !== 'string') return;
  state.lastReply = {
    role: message.role || 'assistant',
    content: typeof message.content === 'string' ? message.content : '',
    toolCalls,
  };
  el('append-reply').hidden = false;
}

function maybeShowParsed(requestBody, responseBody) {
  const format = requestBody && requestBody.response_format;
  if (!format) return;
  const choice = responseBody && responseBody.choices && responseBody.choices[0];
  if (!choice || !choice.message) return;
  const message = choice.message;
  const status = el('parsed-status');
  const content = el('parsed-content');
  const show = (text, level, pretty = '') => {
    status.textContent = text;
    status.className = `parsed-status ${level}`;
    content.textContent = pretty;
    el('parsed-result').hidden = false;
  };

  if (message.refusal) return show(`Model refused: ${message.refusal}`, 'bad');
  if (typeof message.content !== 'string') return show('The reply has no text content.', 'bad');

  const cutOff = choice.finish_reason === 'length';
  let parsed;
  try {
    parsed = JSON.parse(message.content);
  } catch (err) {
    const hint = cutOff ? ' The answer was cut off by max_tokens.' : '';
    return show(`Not valid JSON: ${err.message}.${hint}`, 'bad', message.content);
  }

  const notes = [];
  if (cutOff) notes.push('finish_reason is "length" (cut off by max_tokens)');
  const required = format.type === 'json_schema' && format.json_schema?.schema?.required;
  if (Array.isArray(required) && parsed && typeof parsed === 'object') {
    const missing = required.filter((key) => !(key in parsed));
    if (missing.length) notes.push(`missing required keys: ${missing.join(', ')}`);
  }
  show(
    notes.length ? `Valid JSON, but ${notes.join('; ')}` : 'Valid JSON, parsed from message.content',
    notes.length ? 'warn' : 'good',
    JSON.stringify(parsed, null, 2)
  );
}

function appendReplyToMessages() {
  if (!state.lastReply) return;
  const { role, content, toolCalls } = state.lastReply;
  addMessageRow(role, content, { toolCalls });
  if (toolCalls) {
    toolCalls.forEach((call) => addMessageRow('tool', '', { toolCallId: call.id }));
  } else {
    addMessageRow('user', '');
  }
  state.chatBodyDirty = false;
  syncChatBody();
  state.lastReply = null;
  el('append-reply').hidden = true;
  const rows = el('chat-messages').children;
  rows[rows.length - 1].querySelector('textarea').focus();
}

function maybeShowSimilarity(responseBody) {
  const data = responseBody && responseBody.data;
  if (!Array.isArray(data) || data.length < 2) return;
  const sim = cosineSimilarity(data[0].embedding, data[1].embedding);
  const box = el('similarity-result');
  box.hidden = false;
  box.textContent = `Cosine similarity between Text A and Text B: ${sim.toFixed(4)} (1.0 = identical meaning, 0 = unrelated)`;
}
