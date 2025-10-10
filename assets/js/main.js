/* assets/js/main.js — lógica común Index + Chats */
(() => {
  'use strict';

  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const nowYear = () => new Date().getFullYear();
  const elYearAll = $$(`#year`); elYearAll.forEach(e => e.textContent = nowYear());
  const sanitize = (str='') => str
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  // UUID v4 sin dependencias (suficiente para sessionId no-criptográfico)
  const uuidv4 = () => (URL.createObjectURL(new Blob()).split('/').pop() || '').replace(/-/g,'');

  // Helpers de almacenamiento local
  const storageKey = (agent, sessionId) => `app_chat_${agent}_${sessionId}`;
  const loadHistory = (agent, sessionId) => {
    try { return JSON.parse(localStorage.getItem(storageKey(agent, sessionId)) || '[]'); }
    catch { return []; }
  };
  const saveHistory = (agent, sessionId, arr) => {
    localStorage.setItem(storageKey(agent, sessionId), JSON.stringify(arr));
  };

  // Render de burbujas
  const renderMessage = (wrap, role, content, ts = Date.now()) => {
    const item = document.createElement('div');
    item.className = `msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = sanitize(content);
    const time = document.createElement('span');
    const date = new Date(ts);
    time.className = 'timestamp';
    time.textContent = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    bubble.appendChild(time);
    item.appendChild(bubble);
    wrap.appendChild(item);
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
  };

  // Fetch con timeout; usa AbortSignal.timeout si está disponible
  const fetchWithTimeout = async (url, opts={}, ms=45000) => {
    if (AbortSignal && 'timeout' in AbortSignal) {
      return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try { return await fetch(url, { ...opts, signal: controller.signal }); }
    finally { clearTimeout(id); }
  };

  // Analiza y formatea la respuesta del backend n8n
  const parseApiResponse = async (resp) => {
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.messages)) {
        return data.messages.map(m => (m.content ?? '')).join('\n\n').trim();
      }
      if (data && typeof data.assistant === 'string') {
        return data.assistant;
      }
      return text || 'Respuesta vacía.';
    } catch {
      return text || 'Respuesta no-JSON.';
    }
  };

  // Página Index
  const initIndexPage = () => {
    const originEl = $('#current-origin');
    if (originEl) originEl.textContent = location.origin;
    const pingBtn = $('#ping-btn');
    const pingOut = $('#ping-result');

    if (pingBtn && pingOut && window.APP_CONFIG?.agents?.hermes) {
      pingBtn.addEventListener('click', async () => {
        pingOut.textContent = 'probando…';
        try {
          const resp = await fetchWithTimeout(window.APP_CONFIG.agents.hermes.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify({ chatInput: 'ping', sessionId: 'ping-index' }),
          }, 8000);
          pingOut.textContent = resp.ok ? 'CORS OK ✓' : `HTTP ${resp.status}`;
        } catch (e) {
          pingOut.textContent = 'CORS bloqueado o timeout ✗';
        }
      });
    }
  };

  // Página de Chat
  const initChatPage = () => {
    const agentKey = document.body.getAttribute('data-agent');
    const agentCfg = window.APP_CONFIG?.agents?.[agentKey];
    if (!agentCfg) { alert('Agente no configurado en assets/config.js'); return; }

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

    // Contador de caracteres
    input.addEventListener('input', () => {
      charCount.textContent = `${input.value.length} / ${input.maxLength}`;
    });
    charCount.textContent = `${input.value.length} / ${input.maxLength}`;

    // Manejo de UI
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

    // Envío de mensaje
    const onSend = async () => {
      const text = input.value.trim();
      if (!text) return;
      const sid = ensureSessionId();

      // Agregar mensaje de usuario
      const history = loadHistory(agentKey, sid);
      const userMsg = { role:'user', content:text, ts: Date.now() };
      history.push(userMsg);
      saveHistory(agentKey, sid, history);
      renderMessage(msgWrap, 'user', text, userMsg.ts);
      input.value = '';
      charCount.textContent = `${input.value.length} / ${input.maxLength}`;

      // Llamada al backend
      setUIBusy(true);
      try {
        let assistantText = '';

        if (mockToggle.checked) {
          await new Promise(r => setTimeout(r, 600));
          assistantText = 'Respuesta simulada (mock).';
        } else {
          const headers = { 'Content-Type': 'application/json' };

          // 🔐 soporte opcional de Basic Auth o Bearer Token
          if (window.APP_CONFIG?.auth?.type === 'basic') {
            const { username, password } = window.APP_CONFIG.auth;
            headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
          } else if (window.APP_CONFIG?.auth?.type === 'bearer') {
            headers['Authorization'] = `Bearer ${window.APP_CONFIG.auth.token}`;
          }

          const resp = await fetchWithTimeout(agentCfg.webhookUrl, {
            method: 'POST',
            headers,
            mode: 'cors',
            body: JSON.stringify({ chatInput: text, sessionId: sid })
          }, 45000);

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          }

          assistantText = await parseApiResponse(resp);
        }

        // Renderizar respuesta del bot
        const botMsg = { role:'assistant', content:assistantText, ts: Date.now() };
        const h2 = loadHistory(agentKey, sid);
        h2.push(botMsg); 
        saveHistory(agentKey, sid, h2);
        renderMessage(msgWrap, 'assistant', assistantText, botMsg.ts);
        banner.classList.add('hidden');
      } catch (err) {
        console.error('Chat error:', err);
        showError('No se pudo conectar con el agente (CORS, auth o timeout). Activa Mock Mode o reintenta.');
      } finally {
        setUIBusy(false);
      }
    };

    sendBtn.addEventListener('click', onSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend();
    });
  };

  // Boot
  const page = document.body.getAttribute('data-page');
  $('#current-origin') && ($('#current-origin').textContent = location.origin);
  if (page === 'index') initIndexPage();
  if (page === 'chat') initChatPage();
})();
