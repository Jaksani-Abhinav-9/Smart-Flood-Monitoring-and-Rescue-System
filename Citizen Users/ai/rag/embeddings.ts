import { getModelAdapter } from "../core/model.js";

export async function getEmbeddingVector(text: string): Promise<number[]> {
  try {
    const adapter = getModelAdapter();
    const vec = await adapter.embed(text);
    if (vec && vec.length > 0) {
      return vec;
    }
    return new Array(1024).fill(0.0);
  } catch (e) {
    return new Array(1024).fill(0.0);
  }
}
