/**
 * =============================================================================
 * FloodGuard Rescue OS 2.0 — Mobile-Style Auto-Popup On-Screen Touch Keyboard
 * =============================================================================
 * Slides up automatically when tapping any text <input>, <textarea>, or
 * Terminal command input; disappears automatically when tapping outside
 * (map, background) or pressing the Hide key. Works 100% offline on Pi & PC.
 * =============================================================================
 */
(function initFloodGuardTouchKeyboard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__floodguardTouchKeyboardInit) return;
  window.__floodguardTouchKeyboardInit = true;

  let activeInput = null;
  let shiftOn = false;
  let symbolsOn = false;
  let kbEl = null;

  const ROWS_ALPHA = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['SHIFT','z','x','c','v','b','n','m','BKSP'],
    ['123','SPACE','.','-','/','ENTER','HIDE']
  ];

  const ROWS_NUM = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['@','#','$','_','&','-','+','(',')','/'],
    ['*','"',"'",':',';','!','?','=','BKSP'],
    ['ABC','SPACE',',','.','~','ENTER','HIDE']
  ];

  function injectStyles() {
    if (document.getElementById('fgTouchKbStyles')) return;
    const st = document.createElement('style');
    st.id = 'fgTouchKbStyles';
    st.textContent = `
      #fgTouchKeyboard {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10050;
        background: rgba(5, 8, 17, 0.97);
        border-top: 1px solid rgba(56, 189, 248, 0.35);
        box-shadow: 0 -14px 40px rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(14px);
        padding: 10px 8px 14px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        transform: translateY(105%);
        transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        user-select: none;
        touch-action: manipulation;
      }
      #fgTouchKeyboard.visible {
        transform: translateY(0);
      }
      .fg-kb-row {
        display: flex;
        justify-content: center;
        gap: 6px;
        width: 100%;
        max-width: 820px;
        margin: 0 auto;
      }
      .fg-kb-key {
        flex: 1;
        min-width: 28px;
        height: 44px;
        border-radius: 9px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(30, 41, 59, 0.9);
        color: #f8fafc;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: 'Inter', system-ui, sans-serif !important;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background 0.1s, transform 0.08s;
      }
      .fg-kb-key:active {
        background: rgba(56, 189, 248, 0.35);
        transform: scale(0.95);
      }
      .fg-kb-key.wide { flex: 1.5; background: rgba(15, 23, 42, 0.95); color: #93c5fd; font-size: 0.82rem; }
      .fg-kb-key.space { flex: 4.2; font-size: 0.82rem; color: #cbd5e1; }
      .fg-kb-key.enter { flex: 1.7; background: linear-gradient(135deg, #0284c7, #2563eb); border-color: rgba(56, 189, 248, 0.5); color: #fff; font-size: 0.84rem; }
      .fg-kb-key.hide { flex: 1.2; background: rgba(239, 68, 68, 0.18); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; font-size: 0.82rem; }
      .fg-kb-key.active-mod { background: rgba(56, 189, 248, 0.3); border-color: #38bdf8; color: #fff; }
    `;
    document.head.appendChild(st);
  }

  function ensureKeyboard() {
    if (kbEl) return kbEl;
    injectStyles();
    kbEl = document.createElement('div');
    kbEl.id = 'fgTouchKeyboard';
    kbEl.setAttribute('aria-hidden', 'true');
    // Prevent losing focus on input when tapping keyboard keys
    kbEl.addEventListener('mousedown', (e) => e.preventDefault());
    kbEl.addEventListener('touchstart', (e) => {
      if (e.target && e.target.classList.contains('fg-kb-key')) {
        e.preventDefault();
        handleKeyPress(e.target.dataset.key);
      }
    }, { passive: false });
    kbEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.fg-kb-key');
      if (btn) handleKeyPress(btn.dataset.key);
    });
    document.body.appendChild(kbEl);
    renderKeys();
    return kbEl;
  }

  function renderKeys() {
    if (!kbEl) return;
    const layout = symbolsOn ? ROWS_NUM : ROWS_ALPHA;
    kbEl.innerHTML = layout.map(row => {
      const btns = row.map(k => {
        let label = k;
        let cls = 'fg-kb-key';
        if (k === 'SHIFT') { label = '⇧'; cls += ' wide' + (shiftOn ? ' active-mod' : ''); }
        else if (k === 'BKSP') { label = '⌫'; cls += ' wide'; }
        else if (k === '123' || k === 'ABC') { cls += ' wide'; }
        else if (k === 'SPACE') { label = 'space'; cls += ' space'; }
        else if (k === 'ENTER') { label = '↵ Enter'; cls += ' enter'; }
        else if (k === 'HIDE') { label = '⌨ ▾'; cls += ' hide'; }
        else if (!symbolsOn && shiftOn) { label = k.toUpperCase(); }
        return `<button type="button" class="${cls}" data-key="${k}">${label}</button>`;
      }).join('');
      return `<div class="fg-kb-row">${btns}</div>`;
    }).join('');
  }

  function insertTextAtCursor(el, text) {
    const start = el.selectionStart != null ? el.selectionStart : el.value.length;
    const end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
    const val = el.value || '';
    el.value = val.slice(0, start) + text + val.slice(end);
    const nextPos = start + text.length;
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(nextPos, nextPos);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function handleKeyPress(k) {
    if (!k) return;
    if (k === 'HIDE') {
      hideKeyboard(true);
      return;
    }
    if (k === 'SHIFT') {
      shiftOn = !shiftOn;
      renderKeys();
      return;
    }
    if (k === '123' || k === 'ABC') {
      symbolsOn = (k === '123');
      renderKeys();
      return;
    }
    if (!activeInput) return;

    if (k === 'BKSP') {
      const start = activeInput.selectionStart != null ? activeInput.selectionStart : activeInput.value.length;
      const end = activeInput.selectionEnd != null ? activeInput.selectionEnd : activeInput.value.length;
      const val = activeInput.value || '';
      if (start !== end) {
        activeInput.value = val.slice(0, start) + val.slice(end);
        activeInput.setSelectionRange?.(start, start);
      } else if (start > 0) {
        activeInput.value = val.slice(0, start - 1) + val.slice(start);
        activeInput.setSelectionRange?.(start - 1, start - 1);
      }
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    if (k === 'ENTER') {
      activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      if (activeInput.tagName !== 'TEXTAREA') {
        hideKeyboard(false);
      } else {
        insertTextAtCursor(activeInput, '\n');
      }
      return;
    }

    const ch = (k === 'SPACE') ? ' ' : ((!symbolsOn && shiftOn) ? k.toUpperCase() : k);
    insertTextAtCursor(activeInput, ch);
    if (shiftOn && !symbolsOn && k !== 'SPACE') {
      shiftOn = false;
      renderKeys();
    }
  }

  function isTextInput(el) {
    if (!el || el.readOnly || el.disabled) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(t);
    }
    return false;
  }

  function showKeyboard(target) {
    activeInput = target;
    const el = ensureKeyboard();
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    // Scroll focused element smoothly above keyboard if needed
    setTimeout(() => {
      try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    }, 120);
  }

  function hideKeyboard(blurInput = false) {
    if (kbEl) {
      kbEl.classList.remove('visible');
      kbEl.setAttribute('aria-hidden', 'true');
    }
    if (blurInput && activeInput && typeof activeInput.blur === 'function') {
      activeInput.blur();
    }
    activeInput = null;
  }

  document.addEventListener('focusin', (e) => {
    if (isTextInput(e.target)) {
      showKeyboard(e.target);
    }
  });

  // Hide automatically when user taps anywhere outside text inputs and keyboard
  document.addEventListener('pointerdown', (e) => {
    if (!kbEl || !kbEl.classList.contains('visible')) return;
    if (kbEl.contains(e.target)) return;
    if (isTextInput(e.target)) return;
    hideKeyboard(true);
  });

  window.fgTouchKeyboard = { show: showKeyboard, hide: hideKeyboard };
})();
