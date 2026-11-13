import fs from "fs";
import path from "path";
import { BASE_DIR, PROJECT_ROOT } from "../core/config.js";
import { getEmbeddingVector } from "./embeddings.js";

const STORE_PATH = path.join(BASE_DIR, "vector_store.json");

export interface DocumentChunk {
  text: string;
  metadata: {
    source: string;
    category: string;
    chunk_index: number;
  };
  embedding: number[];
}

export class VectorStore {
  private documents: DocumentChunk[] = [];

  constructor() {
    this.load();
    if (this.documents.length === 0) {
      this.rebuildIndex();
    }
  }

  private load() {
    if (fs.existsSync(STORE_PATH)) {
      try {
        const raw = fs.readFileSync(STORE_PATH, "utf-8");
        this.documents = JSON.parse(raw);
      } catch (e) {
        this.documents = [];
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.documents, null, 2), "utf-8");
    } catch (e) {
      // Fail silently
    }
  }

  public clear() {
    this.documents = [];
    this.save();
  }

  public async addDocument(text: string, metadata: any) {
    const embedding = await getEmbeddingVector(text);
    this.documents.push({
      text,
      metadata,
      embedding
    });
  }

  public async rebuildIndex() {
    this.clear();
    let knowledgeRoot = path.join(PROJECT_ROOT, "knowledge");
    if (!fs.existsSync(knowledgeRoot)) {
      knowledgeRoot = path.join(BASE_DIR, "knowledge");
    }
    if (!fs.existsSync(knowledgeRoot)) return;

    const traverse = async (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const category = path.basename(dir);

      for (const entry of entries) {
        const resPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await traverse(resPath);
        } else if (entry.isFile() && entry.name.endsWith(".txt")) {
          try {
            const content = fs.readFileSync(resPath, "utf-8");
            const paragraphs = content.split("\n\n").map(p => p.trim()).filter(Boolean);
            
            for (let i = 0; i < paragraphs.length; i++) {
              await this.addDocument(paragraphs[i], {
                source: entry.name,
                category,
                chunk_index: i
              });
            }
          } catch (e) {
            continue;
          }
        }
      }
    };

    await traverse(knowledgeRoot);
    this.save();
    console.log(`[SUCCESS] Vector store reindexed with ${this.documents.length} chunks.`);
  }

  public async search(query: string, topK: number = 3): Promise<DocumentChunk[]> {
    if (this.documents.length === 0) return [];

    const queryEmbedding = await getEmbeddingVector(query);
    const results: { sim: number; doc: DocumentChunk }[] = [];

    for (const doc of this.documents) {
      const docEmbedding = doc.embedding;
      if (!docEmbedding || docEmbedding.length === 0) continue;

      let dot = 0;
      let normQ = 0;
      let normD = 0;

      for (let i = 0; i < queryEmbedding.length; i++) {
        dot += queryEmbedding[i] * docEmbedding[i];
        normQ += queryEmbedding[i] * queryEmbedding[i];
        normD += docEmbedding[i] * docEmbedding[i];
      }

      normQ = Math.sqrt(normQ);
      normD = Math.sqrt(normD);

      const sim = (normQ > 0 && normD > 0) ? (dot / (normQ * normD)) : 0.0;
      results.push({ sim, doc });
    }

    results.sort((a, b) => b.sim - a.sim);
    return results.slice(0, topK).map(r => r.doc);
  }
}
export default VectorStore;
