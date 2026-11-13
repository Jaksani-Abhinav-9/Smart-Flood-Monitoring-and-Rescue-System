import { getModelAdapter } from "./model.js";
import { retrieveContext } from "../rag/retriever.js";
import { isOutOfDomain, getOutOfDomainResponse, getModelOfflineResponse } from "./safety.js";

export class AIAgent {
  protected systemPrompt: string;
  protected role: string;

  constructor(systemPrompt: string, role: string) {
    this.systemPrompt = systemPrompt;
    this.role = role;
  }

  public enrichContext(_question: string, _params: any): Promise<string> {
    return Promise.resolve("");
  }

  public async run(question: string, params: any): Promise<string> {
    if (isOutOfDomain(question)) return getOutOfDomainResponse();

    const model = getModelAdapter();
    if (!model.isInitialized()) return getModelOfflineResponse(model.getInitializationError());

    try {
      let ragContext = "";
      try { ragContext = await retrieveContext(question, this.role); } catch (_) {}
      const liveContext = await this.enrichContext(question, params);

      const userMessage = `### RETRIEVED FLOOD KNOWLEDGE
${ragContext || "None available."}

### LIVE PROJECT DATA
${liveContext || "No live data available."}

### USER QUESTION
${question}

Answer based only on the above data. If data is unavailable or marked UNAVAILABLE, say so clearly. Do not fabricate readings, sensor values, or status.`;

      return await model.generate(this.systemPrompt, userMessage);
    } catch (e: any) {
      return getModelOfflineResponse(e.message || String(e));
    }
  }
}
