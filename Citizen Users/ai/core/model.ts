import fs from "fs";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { MODEL_PATH, MODEL_CONTEXT_SIZE, MODEL_THREADS } from "./config.js";

export interface LLMAdapter {
  generate(systemPrompt: string, userMessage: string, temperature?: number, maxTokens?: number): Promise<string>;
  isInitialized(): boolean;
  getInitializationError(): string;
}

export class LlamaCppAdapter implements LLMAdapter {
  private llama: any = null;
  private model: any = null;
  private context: any = null;
  private initialized: boolean = false;
  private initError: string = "Model not yet initialized — server may still be loading.";
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initializeModel();
  }

  public waitForInit(): Promise<void> {
    return this.initPromise;
  }

  private async initializeModel(): Promise<void> {
    if (!fs.existsSync(MODEL_PATH)) {
      this.initError = `Qwen3 4B GGUF model file not found at: ${MODEL_PATH}. Place qwen3-4b.gguf in the models/ directory.`;
      console.error(`[ERROR] ${this.initError}`);
      return;
    }

    try {
      console.log(`[INFO] Loading Qwen3 4B GGUF from: ${MODEL_PATH}`);
      this.llama = await getLlama();
      this.model = await this.llama.loadModel({
        modelPath: MODEL_PATH,
      });
      this.context = await this.model.createContext({
        contextSize: MODEL_CONTEXT_SIZE,
        threads: MODEL_THREADS,
      });
      this.initialized = true;
      this.initError = "";
      console.log(`[SUCCESS] Qwen3 4B loaded successfully. Context: ${MODEL_CONTEXT_SIZE} tokens, Threads: ${MODEL_THREADS}`);
    } catch (e: any) {
      this.initError = `Failed to load Qwen3 4B GGUF: ${e.message || String(e)}`;
      console.error(`[ERROR] ${this.initError}`);
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getInitializationError(): string {
    return this.initError;
  }

  public async generate(
    systemPrompt: string,
    userMessage: string,
    temperature: number = 0.3,
    maxTokens: number = 768
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error(`Flood AI model is currently unavailable. The local Qwen3 4B model could not be loaded. Reason: ${this.initError}`);
    }

    // node-llama-cpp v3: create a fresh context sequence per call
    const sequence = this.context.getSequence();
    const session = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt: systemPrompt,
    });

    try {
      const response = await session.prompt(userMessage, {
        temperature,
        maxTokens,
      });
      return response ?? "";
    } finally {
      // Release the sequence back so context memory is freed
      sequence.dispose();
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: LlamaCppAdapter | null = null;

export function getModelAdapter(): LlamaCppAdapter {
  if (!_instance) {
    _instance = new LlamaCppAdapter();
  }
  return _instance;
}
