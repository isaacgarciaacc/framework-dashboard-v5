/* assets/js/main.js — lógica común Index + Chats (con Basic Auth opcional y diagnósticos) */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const nowYear = () => new Date().getFullYear();
  const elYearAll = $$('#year'); elYearAll.forEach(e => e.textContent = nowYear());

  const sanitize = (str = '') =>
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#039;');

  // UUID v4 “sencillo” (no criptográfico)
  const uuidv4 = () => (URL.createObjectURL(new Blob()).split('/').pop() || '').replace(/-/g, '');

  // ---- LocalStorage helpers
  const storageKey = (agent, sessionId) => `app_chat_${agent}_${sessionId}`;
  const loadHistory = (agent, sessionId) => {
    try { return JSON.parse(localStorage.getItem(storageKey(agent, sessionId)) || '[]'); }
    catch { return []; }
  };
  const saveHistory = (agent, sessionId, arr) => {
    localStorage.setItem(storageKey(agent, sessionId), JSON.stringify(arr));
  };

  // ---- Headers (incluye Basic Auth opcional desde APP_CONFIG.auth)
  const buildHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const auth = window.APP_CONFIG?.auth;
    if (auth?.type === 'basic') {
      const u = String(auth.username || '');
      const p = String(auth.password || '');
      headers['Authorization'] = 'Basic ' + btoa(`${u}:${p}`);
    }
    return headers;
  };

  // ---- Render de burbujas
  const renderMessage = (wrap, role, content, ts = Date.now()) => {
    const item = document.createElement('div');
    item.className = `msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = sanitize(content);
    const time = document.createElement('span');
    const date = new Date(ts);
    time.className = 'timestamp';
    time.textContent = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    bubble.appendChild(time);
    item.appendChild(bubble);
    wrap.appendChild(item);
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
  };

  // ---- Fetch con timeout
  const fetchWithTimeout = async (url, opts = {}, ms = 45000) => {
    if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
      return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try { return await fetch(url, { ...opts, signal: controller.signal }); }
    finally { clearTimeout(id); }
  };

  // ---- Parseo de respuesta API
  const parseApiResponse = async (resp) => {
    const text = await resp.text();
    // Intentar JSON primero
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data?.messages)) {
        return data.messages.map(m => (m.content ?? '')).join('\n\n').trim();
      }
      if (typeof data?.assistant === 'string') {
        return data.assistant;
      }
      // JSON válido pero sin formato esperado → devolver legible
      return text || 'Respuesta vacía.';
    } catch {
      // No-JSON → devolver texto crudo (útil para diagnósticos)
      return text || 'Respuesta no-JSON.';
    }
  };

  // ---- Página Index (ping CORS)
  const initIndexPage = () => {
    const originEl = $('#current-origin');
    if (originEl) originEl.textContent = location.origin;

    const pingBtn = $('#ping-btn');
    const pingOut = $('#ping-result');

    if (pingBtn && pingOut && window.APP_CONFIG?.agents?.hermes) {
      pingBtn.addEventListener('click', async () => {
        pingOut.textContent = 'probando…';
        try {
          const resp = await fetchWithTimeout(
            window.APP_CONFIG.agents.hermes.webhookUrl,
            {
              method: 'POST',
              headers: buildHeaders(),
              mode: 'cors',
              body: JSON.stringify({ chatInput: 'ping', sessionId: 'ping-index' }),
            },
            8000
          );
          if (!resp.ok) {
            const snippet = (await resp.text()).slice(0, 120);
            pingOut.textContent = `HTTP ${resp.status} (${snippet || 'sin cuerpo'})`;
          } else {
            pingOut.textContent = 'CORS OK ✓';
          }
        } catch (e) {
          pingOut.textContent = 'CORS bloqueado o timeout ✗';
        }
      });
    }
  };

  // ---- Páginas de Chat
  const initChatPage = () => {
    // Validar configuración cargada
    if (!window.APP_CONFIG || !window.APP_CONFIG.agents) {
      alert('APP_CONFIG no encontrado. Verifica <script src="assets/config.js"> en el HTML.');
      return;
    }

    const agentKey = document.body.getAttribute('data-agent');
    const agentCfg = window.APP_CONFIG.agents[agentKey];
    if (!agentCfg || !agentCfg.webhookUrl) {
      alert('Agente no configurado en assets/config.js');
      return;
    }

    const msgWrap = $('#messages');
    const input = $('#userInput');
    const sendBtn = $('#sendBtn');
    const banner = $('#banner');
    const charCount = $('#charCount');
    const sessionInput = $('#sessionId');
    const mockToggle = $('#mockToggle');

    // Param mock via URL
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('mock') === '1') mockToggle.checked = true;

    // SessionId autogenerado si vacío
    const ensureSessionId = () => {
      if (!sessionInput.value.trim()) sessionInput.value = uuidv4();
      return sessionInput.value.trim();
    };

    // Cargar historial si existía
    const sessionId = ensureSessionId();
    const prev = loadHistory(agentKey, sessionId);
    prev.forEach(m => renderMessage(msgWrap, m.role, m.content, m.ts));

    // Contador de chars
    const updateCount = () => { charCount.textContent = `${input.value.length} / ${input.maxLength}`; };
    input.addEventListener('input', updateCount);
    updateCount();

    // Estados UI
    const setUIBusy = (busy) => {
      sendBtn.disabled = busy;
      input.disabled = busy;
      banner.classList.toggle('hidden', !busy);
      banner.classList.toggle('error', false);
      if (busy) banner.textContent = 'Enviando…';
    };

    const showError = (msg) => {
      banner.classList.remove('hidden');
      banner.classList.add('error');
      banner.textContent = msg;
    };

    // Envío
    const onSend = async () => {
      const text = input.value.trim();
      if (!text) return;
      const sid = ensureSessionId();

      // Append usuario
      const history = loadHistory(agentKey, sid);
      const userMsg = { role: 'user', content: text, ts: Date.now() };
      history.push(userMsg);
      saveHistory(agentKey, sid, history);
      renderMessage(msgWrap, 'user', text, userMsg.ts);
      input.value = '';
      updateCount();

      // Llamada
      setUIBusy(true);
      try {
        let assistantText = '';
        if (mockToggle.checked) {
          await new Promise(r => setTimeout(r, 600));
          assistantText = 'Respuesta simulada (mock).';
        } else {
          const headers = buildHeaders();
          // Log suave de diagnóstico (no invade UI)
          console.info('[Chat]', agentKey, '→', agentCfg.webhookUrl);

          const resp = await fetchWithTimeout(
            agentCfg.webhookUrl,
            {
              method: 'POST',
              headers,
              mode: 'cors',
              body: JSON.stringify({ chatInput: text, sessionId: sid }),
            },
            45000
          );

          if (!resp.ok) {
            const snippet = (await resp.text()).slice(0, 240);
            throw new Error(`HTTP ${resp.status} — ${snippet || 'sin cuerpo'}`);
          }

          assistantText = await parseApiResponse(resp);
        }

        const botMsg = { role: 'assistant', content: assistantText, ts: Date.now() };
        const h2 = loadHistory(agentKey, sid); h2.push(botMsg); saveHistory(agentKey, sid, h2);
        renderMessage(msgWrap, 'assistant', assistantText, botMsg.ts);
        banner.classList.add('hidden');
      } catch (err) {
        console.error('[Chat] Error al llamar webhook:', err);
        showError('No se pudo conectar o respuesta inválida (CORS/HTTP/timeout). Activa Mock Mode o reintenta.');
      } finally {
        setUIBusy(false);
      }
    };

    sendBtn.addEventListener('click', onSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend();
    });
  };

  // ---- Boot
  const page = document.body.getAttribute('data-page');
  const origin = $('#current-origin');
  if (origin) origin.textContent = location.origin;
  if (page === 'index') initIndexPage();
  if (page === 'chat') initChatPage();
})();
