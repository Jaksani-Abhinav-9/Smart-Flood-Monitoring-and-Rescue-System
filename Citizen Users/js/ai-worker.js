// FloodGuard In-Browser AI Worker — Autonomous Local Fine-Tuned Model Execution
// Loads the fine-tuned INT8 ONNX model from ../ai/model/ with zero external runtime servers.

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3";

// Configure local model paths
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "../ai/model/";
env.useBrowserCache = true;

let generator = null;
let isInitializing = false;

self.onmessage = async (e) => {
  const { type, id, data } = e.data;

  if (type === "init") {
    if (generator) {
      self.postMessage({ type: "init_complete", id, success: true });
      return;
    }
    if (isInitializing) return;

    isInitializing = true;
    try {
      self.postMessage({ type: "progress", id, status: "Loading Fine-Tuned AI from /ai/model/..." });

      // Detect hardware: WebGPU or CPU WASM
      let device = "wasm";
      if (typeof navigator !== "undefined" && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) device = "webgpu";
        } catch (_) {}
      }

      self.postMessage({ type: "progress", id, status: `Compiling ${device.toUpperCase()} pipeline...` });

      generator = await pipeline("text-generation", "./", {
        device: device,
        dtype: "q8",
        progress_callback: (p) => {
          if (p.status === "progress" && p.total) {
            const pct = Math.round((p.loaded / p.total) * 100);
            self.postMessage({ type: "progress", id, status: `Loading AI Engine (${pct}%)...` });
          } else if (p.status === "ready") {
            self.postMessage({ type: "progress", id, status: "FloodGuard AI Model Ready!" });
          }
        }
      });

      isInitializing = false;
      self.postMessage({ type: "init_complete", id, success: true, device });
    } catch (err) {
      isInitializing = false;
      console.warn("Local worker load note:", err);
      self.postMessage({ type: "init_error", id, error: err.message || String(err) });
    }
  } else if (type === "generate") {
    if (!generator) {
      self.postMessage({ type: "generate_error", id, error: "Model not initialized" });
      return;
    }

    try {
      const messages = [
        { role: "system", content: data.systemPrompt },
        { role: "user", content: data.userMessage }
      ];

      const output = await generator(messages, {
        max_new_tokens: data.maxTokens || 200,
        temperature: data.temperature || 0.2,
        do_sample: false
      });

      const fullText = output[0]?.generated_text;
      let reply = "";
      if (Array.isArray(fullText)) {
        reply = fullText[fullText.length - 1]?.content || "";
      } else if (typeof fullText === "string") {
        reply = fullText;
      } else {
        reply = JSON.stringify(fullText);
      }

      self.postMessage({ type: "generate_complete", id, reply });
    } catch (err) {
      self.postMessage({ type: "generate_error", id, error: err.message || String(err) });
    }
  }
};
