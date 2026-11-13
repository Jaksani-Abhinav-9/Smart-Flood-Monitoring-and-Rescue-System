// FloodGuard Citizen AI Engine — Direct Python Qwen Bridge Client
// All queries route 100% directly to Qwen 2.5 running in Python backend on port 8088.

const LOCAL_SERVER = "http://127.0.0.1:8088";

class AIEngine {
  constructor() {
    this.isReady = false;
    this.statusListeners = [];
  }

  async checkServer() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${LOCAL_SERVER}/api/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        this.isReady = true;
        this.notifyStatus("● FloodGuard AI Online (Qwen 2.5 Neural)");
        return true;
      }
    } catch (_) {}
    this.isReady = false;
    this.notifyStatus("● FloodGuard AI Connecting (port 8088)...");
    return false;
  }

  async init(statusCallback) {
    if (statusCallback) this.statusListeners.push(statusCallback);
    return await this.checkServer();
  }

  notifyStatus(statusText) {
    this.statusListeners.forEach((fn) => {
      try { fn(statusText); } catch (_) {}
    });

    if (typeof document !== "undefined") {
      const badge = document.getElementById("aiStatusBadge");
      if (badge) badge.textContent = statusText;
      const thinking = document.getElementById("aiThinking");
      if (thinking) thinking.textContent = `⏳ ${statusText}`;
    }
  }

  async generateCitizenResponse(question, params = {}) {
    try {
      const res = await fetch(`${LOCAL_SERVER}/api/ai/citizen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, ...params })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.answer) {
          return data.answer;
        }
      }
    } catch (err) {
      console.warn("[Citizen AI] Error contacting Python bridge:", err);
    }

    return "⚠️ Qwen 2.5 Sentinel AI Engine is currently offline. Please ensure pi_hardware_bridge.py is running on port 8088.";
  }
}

export const aiEngine = new AIEngine();
