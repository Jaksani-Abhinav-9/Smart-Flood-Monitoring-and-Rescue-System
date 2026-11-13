import { VectorStore, DocumentChunk } from "./vector-store.js";

let _storeInstance: VectorStore | null = null;

export function getStore(): VectorStore {
  if (!_storeInstance) {
    _storeInstance = new VectorStore();
  }
  return _storeInstance;
}

export async function retrieveContext(query: string, role: string = "citizen", topK: number = 3): Promise<string> {
  const store = getStore();
  const matches = await store.search(query, topK * 2);

  // Security check: restrict categories based on agent authorization
  const allowedCategories = new Set<string>(["flood", "evacuation", "safety", "first-aid", "project"]);
  if (role === "rescue") {
    allowedCategories.add("rescue");
  }

  const filteredMatches: DocumentChunk[] = [];
  for (const doc of matches) {
    const category = doc.metadata?.category || "";
    if (allowedCategories.has(category)) {
      filteredMatches.push(doc);
    }
    if (filteredMatches.length >= topK) {
      break;
    }
  }

  if (filteredMatches.length === 0) {
    return "No relevant emergency flood guidelines matched from local RAG knowledge base.";
  }

  const contextBlocks = filteredMatches.map(doc => {
    const source = doc.metadata?.source || "unknown";
    const category = doc.metadata?.category || "unknown";
    return `[Source: ${category}/${source}]\n${doc.text}`;
  });

  return contextBlocks.join("\n\n");
}
