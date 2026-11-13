---
license: apache-2.0
language:
- en
- te
pipeline_tag: text-generation
base_model: Qwen/Qwen2.5-1.5B-Instruct
tags:
- gguf
- q4_k_m
- floodguard
---

# FloodGuard AI 2.0 — Custom Qwen 2.5 1.5B (GGUF Q4_K_M)

Custom fine-tuned Qwen 2.5 1.5B model for Kamareddy Flood Rescue Operations (bilingual English + Telugu tactical directives & hydrology calculations), converted and quantized to `Q4_K_M` GGUF for Raspberry Pi 5.

## Files
- `qwen2.5-1.5b-custom-q4_k_m.gguf` — Quantized model weights + embedded Qwen2/ChatML tokenizer (`986 MB`, `338` tensors)
- `gguf_config.json` — Runtime configuration (`n_ctx=2048`, `n_threads=4`, `Q4_K_M`)
- `gguf_tokenizer.json` — Embedded tokenizer specification (`vocab_size=151936`, stop tokens)
- `gguf_chat_template.jinja` — ChatML prompt template
- `Modelfile` — Ollama import specification (`floodguard-qwen`)

## Usage
Run automatically via `ai_telemetry_interface.py` (`LlamaCppManager` -> `OllamaManager` cascade):
- **llama-cpp-python**: loads `qwen2.5-1.5b-custom-q4_k_m.gguf` directly
- **Ollama**: `cd "ai 2.0/Model" && ollama create floodguard-qwen -f Modelfile`
