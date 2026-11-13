/**
 * =============================================================================
 * FloodGuard AI 2.0 — Frontend Qwen Model Telemetry Interface
 * =============================================================================
 * Aggregates live Pi GPS + LoRa sensor pole telemetry + Kamareddy grids,
 * and streams queries directly to the local offline Qwen model engine.
 * Features an Antigravity / ChatGPT typewriter streaming response effect
 * with blinking cursor and interactive clickable situation-appropriate action chips.
 * =============================================================================
 */

class AI2Interface {
  constructor(bridgeBaseUrl = 'http://127.0.0.1:8088') {
    this.baseUrl = bridgeBaseUrl;
    this.isAnalyzing = false;
    this.isGenerating = false;
    this.currentStream = null;
    this.activeAbortController = null;
    this.injectStyles();
    this.startLiveStatusPolling();
  }

  /**
   * Toggles Send Directive ↔ Stop button in-place (Antigravity / ChatGPT style)
   */
  setGeneratingState(active) {
    this.isGenerating = Boolean(active);
    if (typeof document === 'undefined') return;
    const sendBtn = document.getElementById('rescueAISendBtn');
    const stopBtn = document.getElementById('rescueAIStopBtn');
    if (sendBtn) sendBtn.style.display = active ? 'none' : 'inline-flex';
    if (stopBtn) stopBtn.style.display = active ? 'inline-flex' : 'none';
  }

  /**
   * Immediately aborts active AI streaming/request and restores Send button
   */
  stopGeneration() {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch (_) {}
      this.activeAbortController = null;
    }
    if (this.currentStream && typeof this.currentStream.stop === 'function') {
      this.currentStream.stop();
    } else if (this.currentStream && typeof this.currentStream.finish === 'function') {
      this.currentStream.finish(true);
    }
    this.setGeneratingState(false);
  }

  /**
   * Real-time live status polling: updates actual neural model status dot
   */
  startLiveStatusPolling() {
    if (typeof window === 'undefined') return;
    const checkStatus = async () => {
      const badge = document.getElementById('qwenLiveStatusBadge');
      const dot = document.getElementById('qwenLiveStatusDot');
      const text = document.getElementById('qwenLiveStatusText');
      if (!badge || !dot || !text) return;

      try {
        const res = await fetch(`${this.baseUrl}/api/ai/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ready') {
            badge.style.background = 'rgba(16, 185, 129, 0.15)';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.45)';
            badge.style.color = '#6ee7b7';
            dot.style.background = '#10b981';
            dot.style.boxShadow = '0 0 8px #10b981';
            text.textContent = 'QWEN 2.5: READY';
          } else if (data.status === 'loading') {
            badge.style.background = 'rgba(245, 158, 11, 0.15)';
            badge.style.borderColor = 'rgba(245, 158, 11, 0.45)';
            badge.style.color = '#fcd34d';
            dot.style.background = '#f59e0b';
            dot.style.boxShadow = '0 0 8px #f59e0b';
            text.textContent = 'WARMING UP (RAM)...';
          } else {
            badge.style.background = 'rgba(239, 68, 68, 0.15)';
            badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            badge.style.color = '#fca5a5';
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 8px #ef4444';
            text.textContent = data.error ? 'MODEL ERROR' : 'OFFLINE';
          }
        } else {
          setOffline();
        }
      } catch (_e) {
        setOffline();
      }

      function setOffline() {
        if (!badge || !dot || !text) return;
        badge.style.background = 'rgba(239, 68, 68, 0.12)';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.35)';
        badge.style.color = '#fca5a5';
        dot.style.background = '#ef4444';
        dot.style.boxShadow = '0 0 6px #ef4444';
        text.textContent = 'OFFLINE';
      }
    };

    // Immediate check + recurring poll
    setTimeout(checkStatus, 500);
    setInterval(checkStatus, 2500);
  }

  /**
   * Injects keyframe animations and chip styling for typewriter streaming
   */
  injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('aiTypewriterStyles')) return;

    const style = document.createElement('style');
    style.id = 'aiTypewriterStyles';
    style.textContent = `
      @keyframes aiCursorBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      @keyframes aiFadeInUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes aiPulseDot {
        0%, 100% { transform: scale(0.9); opacity: 0.7; box-shadow: 0 0 4px #38bdf8; }
        50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 12px #38bdf8; }
      }
      .ai-typing-cursor {
        display: inline-block;
        color: #38bdf8;
        font-weight: 900;
        animation: aiCursorBlink 0.65s infinite;
        margin-left: 2px;
        vertical-align: baseline;
      }
      .ai-thinking-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #7dd3fc;
        font-size: 0.86rem;
        padding: 6px 12px;
        background: rgba(56, 189, 248, 0.08);
        border-radius: 8px;
        border: 1px dashed rgba(56, 189, 248, 0.35);
        margin-bottom: 4px;
      }
      .ai-pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #38bdf8;
        animation: aiPulseDot 1.2s infinite ease-in-out;
        display: inline-block;
      }
      .ai-option-chip {
        text-align: left;
        background: rgba(56, 189, 248, 0.08);
        border: 1px solid rgba(56, 189, 248, 0.25);
        border-radius: 10px;
        padding: 9px 14px;
        color: #e0f2fe;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-family: inherit;
        animation: aiFadeInUp 0.35s ease forwards;
      }
      .ai-option-chip:hover {
        background: rgba(56, 189, 248, 0.22);
        border-color: rgba(56, 189, 248, 0.55);
        transform: translateX(4px);
        color: #ffffff;
        box-shadow: 0 4px 16px rgba(56, 189, 248, 0.2);
      }
      .ai-option-chip:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Safe HTML escaping helper
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Formats response markdown into styled HTML elements
   */
  formatMarkdown(text) {
    if (!text) return '';
    let out = this.escapeHtml(text);

    // Channel 1: Tactical Command Heading
    out = out.replace(/### (🚑 RESCUE TACTICAL COMMAND[^\n]*)/g, 
      '<div style="font-size:0.86rem;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 6px 0;display:flex;align-items:center;gap:6px;"><span>🚑</span> $1</div>');
    out = out.replace(/### (CHANNEL 1: RESCUE TACTICAL COMMAND)/g, 
      '<div style="font-size:0.86rem;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 6px 0;display:flex;align-items:center;gap:6px;"><span>🚑</span> $1</div>');

    // Channel 2: Citizen Broadcast Heading
    out = out.replace(/### (📢 CHANNEL 2: CITIZEN EVACUATION BROADCAST[^\n]*)/g, 
      '<div style="font-size:0.86rem;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 6px 0;padding:8px 12px;background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;border-radius:6px;display:flex;align-items:center;gap:6px;"><span>📢</span> $1</div>');
    out = out.replace(/### (CHANNEL 2: CITIZEN EVACUATION BROADCAST)/g, 
      '<div style="font-size:0.86rem;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 6px 0;padding:8px 12px;background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;border-radius:6px;display:flex;align-items:center;gap:6px;"><span>📢</span> $1</div>');

    // Generic H3
    out = out.replace(/### ([^\n]+)/g, 
      '<div style="font-size:0.84rem;font-weight:800;color:#38bdf8;text-transform:uppercase;margin:8px 0 4px 0;">$1</div>');

    // Bold tags
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#38bdf8;font-weight:700;">$1</strong>');

    // Bullets
    out = out.replace(/^• /gm, '<span style="color:#38bdf8;font-weight:bold;margin-right:6px;">•</span>');

    // Newlines
    out = out.replace(/\n\n/g, '<div style="height:8px;"></div>');
    out = out.replace(/\n/g, '<br>');

    return out;
  }

  /**
   * Helper to construct AI chat response bubble
   */
  createResponseBubble(msgsContainer) {
    const respDiv = document.createElement('div');
    respDiv.style.cssText = 'align-self:flex-start;background:rgba(15,23,42,0.92);border:1px solid rgba(56,189,248,0.3);padding:16px 20px;border-radius:16px 16px 16px 4px;max-width:92%;font-size:0.92rem;line-height:1.65;color:#f8fafc;box-shadow:0 10px 30px rgba(0,0,0,0.5);margin-bottom:8px;';

    respDiv.innerHTML = `
      <div style="font-size:0.75rem;font-weight:700;color:#10b981;margin-bottom:10px;display:flex;align-items:center;letter-spacing:0.04em;">
        <span style="display:flex;align-items:center;gap:6px;"><span>🛰️</span> TACTICAL OPERATIONS ADVISORY</span>
      </div>
      <div class="ai-text-content" style="word-break:break-word;"></div>
    `;

    msgsContainer.appendChild(respDiv);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
    return respDiv;
  }

  /**
   * Options tray disabled per commander directive
   */
  renderOptionsTray(optionsEl, msgsContainer, options = []) {
    if (optionsEl) optionsEl.style.display = 'none';
  }

  /**
   * Streams AI response with typewriter effect like Antigravity / ChatGPT
   */
  streamResponse(msgsContainer, fullText, options = [], speedMs = 24, onComplete = null) {
    if (!msgsContainer) return null;

    if (this.currentStream && typeof this.currentStream.finish === 'function') {
      this.currentStream.finish();
    }

    let cleanText = fullText || '';
    cleanText = cleanText.replace(/---\s*\n(\*\*)?💡 Suggested Next Actions[\s\S]*$/, '').trim();
    cleanText = cleanText.replace(/(\*\*)?💡 Suggested Next Actions[\s\S]*$/, '').trim();

    const respDiv = this.createResponseBubble(msgsContainer);
    const textEl = respDiv.querySelector('.ai-text-content');
    const optionsEl = respDiv.querySelector('.ai-options-tray');

    // Split text into words/whitespace for natural cadence
    const tokens = cleanText.split(/(\s+)/);
    let tokenIndex = 0;
    let isFinished = false;

    const finishStream = () => {
      if (isFinished) return;
      isFinished = true;
      if (streamTimer) clearInterval(streamTimer);
      textEl.innerHTML = this.formatMarkdown(cleanText);
      this.renderOptionsTray(optionsEl, msgsContainer, options);
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
      this.currentStream = null;
      if (typeof onComplete === 'function') onComplete();
    };

    const streamTimer = setInterval(() => {
      if (tokenIndex < tokens.length) {
        tokenIndex = Math.min(tokenIndex + 1, tokens.length);
        const currentSlice = tokens.slice(0, tokenIndex).join('');
        textEl.innerHTML = this.formatMarkdown(currentSlice) + '<span class="ai-typing-cursor">▍</span>';
        msgsContainer.scrollTop = msgsContainer.scrollHeight;
      } else {
        finishStream();
      }
    }, speedMs);

    this.currentStream = { finish: finishStream };
    return this.currentStream;
  }

  /**
   * Primary method: streams live from Qwen 2.5 neural model via SSE with instant bubble & typewriter cursor
   */
  async streamTacticalAdvisory(msgsContainer, customQuery = null, sosList = [], onComplete = null) {
    if (!msgsContainer) return null;

    if (this.currentStream && typeof this.currentStream.finish === 'function') {
      this.currentStream.finish();
    }
    if (this.activeAbortController) {
      try { this.activeAbortController.abort(); } catch (_) {}
    }

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.setGeneratingState(true);

    // 1. Immediately create AI bubble so user sees response starting right away
    const respDiv = this.createResponseBubble(msgsContainer);
    const textEl = respDiv.querySelector('.ai-text-content');
    const optionsEl = respDiv.querySelector('.ai-options-tray');

    // Show active thinking badge with glowing pulse dot and typewriter cursor
    textEl.innerHTML = `
      <div class="ai-thinking-badge">
        <span class="ai-pulse-dot"></span>
        <span>Consulting nearby Kamareddy Grids &amp; live LoRa telemetry...</span>
      </div>
      <span class="ai-typing-cursor">▍</span>
    `;
    msgsContainer.scrollTop = msgsContainer.scrollHeight;

    let accumulatedText = "";
    let finalOptions = [];
    let isFirstToken = true;
    let streamDone = false;
    let reader = null;
    let fallbackTimer = null;

    const finishStream = (wasStopped = false) => {
      if (streamDone) return;
      streamDone = true;
      if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
      let cleanText = accumulatedText.replace(/---\s*\n(\*\*)?💡 Suggested Next Actions[\s\S]*$/, '').trim();
      cleanText = cleanText.replace(/(\*\*)?💡 Suggested Next Actions[\s\S]*$/, '').trim();
      if (wasStopped) {
        const stoppedNote = '<div style="margin-top:8px;font-size:0.78rem;color:#fca5a5;font-weight:600;">■ Stopped by Commander</div>';
        textEl.innerHTML = (cleanText ? this.formatMarkdown(cleanText) : '') + stoppedNote;
      } else {
        textEl.innerHTML = this.formatMarkdown(cleanText);
      }
      this.renderOptionsTray(optionsEl, msgsContainer, finalOptions);
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
      this.currentStream = null;
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }
      this.setGeneratingState(false);
      if (typeof onComplete === 'function') onComplete();
    };

    const stopStream = () => {
      try { if (reader) reader.cancel(); } catch (_) {}
      finishStream(true);
    };

    this.currentStream = { finish: () => finishStream(false), stop: stopStream };

    try {
      const bodyData = {};
      if (customQuery) bodyData.query = customQuery;
      if (sosList && sosList.length) bodyData.sos_list = sosList;

      const res = await fetch(`${this.baseUrl}/api/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
        signal: abortController.signal
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP stream failed: ${res.status}`);
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = "";

      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep remainder

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'start') {
              if (event.options) finalOptions = event.options;
            } else if (event.type === 'token') {
              if (isFirstToken) {
                isFirstToken = false;
                textEl.innerHTML = "";
              }
              accumulatedText += event.token;
              textEl.innerHTML = this.formatMarkdown(accumulatedText) + '<span class="ai-typing-cursor">▍</span>';
              msgsContainer.scrollTop = msgsContainer.scrollHeight;
            } else if (event.type === 'done') {
              if (event.options) finalOptions = event.options;
              if (event.text && !accumulatedText) accumulatedText = event.text;
              finishStream(false);
              return;
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Stream error');
            }
          } catch (_e) {
            // Ignore partial parse
          }
        }
      }

      finishStream(false);
    } catch (err) {
      if (err && (err.name === 'AbortError' || abortController.signal.aborted)) {
        finishStream(true);
        return;
      }
      console.warn('[AI2Interface] Streaming fallback to analyze:', err);
      // Fallback: query analyze endpoint and typewrite it smoothly
      try {
        const res2 = await fetch(`${this.baseUrl}/api/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: customQuery, sos_list: sosList }),
          signal: abortController.signal
        });
        if (res2.ok) {
          const data = await res2.json();
          const txt = data.tactical_advisory || data.text || '';
          finalOptions = data.suggested_options || data.options || [];

          let cleanText = txt.replace(/---\s*\n(\*\*)?💡 Suggested Next Actions[\s\S]*$/, '').trim();
          cleanText = cleanText.replace(/(\*\*)?💡 Suggested Next Actions[\s\S]*$/, '').trim();
          const tokens = cleanText.split(/(\s+)/);
          let tokenIndex = 0;

          fallbackTimer = setInterval(() => {
            if (streamDone) { clearInterval(fallbackTimer); return; }
            if (tokenIndex < tokens.length) {
              tokenIndex = Math.min(tokenIndex + 1, tokens.length);
              accumulatedText = tokens.slice(0, tokenIndex).join('');
              textEl.innerHTML = this.formatMarkdown(accumulatedText) + '<span class="ai-typing-cursor">▍</span>';
              msgsContainer.scrollTop = msgsContainer.scrollHeight;
            } else {
              clearInterval(fallbackTimer);
              finishStream(false);
            }
          }, 24);
          return;
        }
      } catch (e2) {
        if (e2 && (e2.name === 'AbortError' || abortController.signal.aborted)) {
          finishStream(true);
          return;
        }
      }

      // Error display
      textEl.innerHTML = `<span style="color:#fca5a5;">⚠️ Qwen 2.5 AI Engine offline. Ensure pi_hardware_bridge.py is running.</span>`;
      this.currentStream = null;
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }
      this.setGeneratingState(false);
    }
  }

  /**
   * Fetches the current live context payload assembled from GPS, LoRa & Grids
   */
  async getLiveContext() {
    try {
      const res = await fetch(`${this.baseUrl}/api/ai/context`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[AI2Interface] Failed to reach local AI bridge:', err);
    }
    return null;
  }

  /**
   * Triggers full tactical analysis & citizen warning dispatch
   */
  async triggerAnalysis(customQuery = null, sosList = []) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    try {
      const bodyData = {};
      if (customQuery) bodyData.query = customQuery;
      if (sosList && sosList.length) bodyData.sos_list = sosList;

      const res = await fetch(`${this.baseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.error('[AI2Interface] Error running AI analysis:', err);
    } finally {
      this.isAnalyzing = false;
    }
    return null;
  }

  /**
   * Opens the tactical co-pilot modal on either home.html or lora-data.html
   * and runs live grounded inference with typewriter response.
   */
  async launchTacticalHUD(customQuery = null) {
    const overlay = document.getElementById('rescueAIOverlay');
    if (overlay) overlay.style.display = 'flex';

    const msgs = document.getElementById('rescueMessages');
    if (!msgs) return;

    // Append user / query notice
    const queryText = customQuery || '⚡ Autonomous Tactical Assessment: Analyzing live GNSS GPS position, LoRa sensor poles & Kamareddy grid elevation.';
    
    const userDiv = document.createElement('div');
    userDiv.style.cssText = 'align-self:flex-end;background:linear-gradient(135deg,rgba(239,68,68,0.22),rgba(185,28,28,0.14));border:1px solid rgba(239,68,68,0.4);padding:12px 16px;border-radius:16px 16px 4px 16px;max-width:85%;font-size:0.92rem;line-height:1.55;color:#f8fafc;';
    userDiv.innerHTML = `<div style="font-size:0.75rem;font-weight:700;color:#fca5a5;margin-bottom:4px;text-transform:uppercase;">🧑‍🚒 Tactical Directive Request</div><div>${this.escapeHtml(queryText)}</div>`;
    msgs.appendChild(userDiv);
    msgs.scrollTop = msgs.scrollHeight;

    // Stream live with typewriter effect
    await this.streamTacticalAdvisory(msgs, customQuery);
  }
}

export const ai2 = new AI2Interface();
window.ai2 = ai2;
