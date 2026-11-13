import { AIAgent } from "../core/agent.js";
import { CITIZEN_SYSTEM_PROMPT } from "./citizen-prompt.js";
import { getCitizenDataContext } from "./citizen-tools.js";

export class CitizenAgent extends AIAgent {
  constructor() {
    super(CITIZEN_SYSTEM_PROMPT, "citizen");
  }

  public override async enrichContext(question: string, params: any): Promise<string> {
    return await getCitizenDataContext(params);
  }
}
