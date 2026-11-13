#!/usr/bin/env python3
"""
=============================================================================
FloodGuard AI 2.0 — Qwen Model Telemetry Ingestion & Tactical Engine
=============================================================================
Aggregates and formats real-time inputs for Qwen 2.5:
1. NEARBY Kamareddy GeoJSON spatial flood grids (5 nearest to GPS fix, NOT all 713)
   (Mean/Min/Max Elevation, Basin Depressions, High-Ground Ridges, Risk Scores)
2. Live Rescue Convoy GNSS GPS (Pi Module: Lat, Lng, Heading, Speed)
3. Live LoRa Sensor Poles (Water depth, Hourly rise rate, Temperature, Battery)
4. Active Citizen SOS Incident Stream

AI Backend — 100% GGUF (no safetensors / PyTorch / transformers):
  Tier 1: llama-cpp-python  + custom Q4_K_M GGUF (~940 MB disk, ~1.5 GB RAM)
  Tier 2: Ollama REST API   (port 11434, model: floodguard-qwen)

Zero hardcoded dummy coordinates.
Channel 2 (Citizen Evacuation Broadcast) is ONLY output when explicitly ordered
by the Incident Commander.
=============================================================================
"""

import os
import sys
import json
import math
import time
import re
import threading
import glob

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# GeoJSON path resolution
# ---------------------------------------------------------------------------
_possible_geojson = [
    os.path.join(BASE_DIR, "kmr_grids_ai_latlon.geojson"),
    os.path.join(BASE_DIR, "data", "kmr_grids_ai_latlon.geojson"),
    os.path.join(os.path.dirname(BASE_DIR), "data", "kmr_grids_ai_latlon.geojson"),
]
GEOJSON_PATH = next((p for p in _possible_geojson if os.path.exists(p)), _possible_geojson[0])

# Model directory resolution
MODEL_DIR = os.path.join(BASE_DIR, "Model")
if not os.path.exists(MODEL_DIR):
    for _d in [
        os.path.join(BASE_DIR, "ai 2.0", "Model"),
        os.path.join(os.path.dirname(BASE_DIR), "Rescue Users", "ai 2.0", "Model"),
    ]:
        if os.path.exists(_d):
            MODEL_DIR = _d
            break

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REGIONAL_BASIN_DATUM_M    = 515.0
DEFAULT_TRUCK_WADING_LIMIT_M = 0.85
NEARBY_GRID_RADIUS_KM     = 3.0   # Only inject grids within this radius of GPS fix
NEARBY_GRID_MAX           = 5     # Max grids to include in AI prompt
FALLBACK_HIGH_RISK_COUNT  = 3     # Grids to include when no GPS fix

KAMAREDDY_LANDMARK_MAP = {
    "sarampally":        613,
    "adloor":            478,
    "adlur":             478,
    "tekriyal":          315,
    "devanpally":        583,
    "rameshwarpally":    389,
    "lingapur":          396,
    "chinna mallareddy": 255,
    "ashok nagar":       424,
    "stadium":           189,
    "medical college":   212,
}

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")

# Load GGUF model & tokenizer descriptors generated alongside the Q4_K_M GGUF
def _load_json_safe(path, default):
    try:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return default

GGUF_CONFIG = _load_json_safe(
    os.path.join(MODEL_DIR, "gguf_config.json"),
    {
        "model_file": "qwen2.5-1.5b-custom-q4_k_m.gguf",
        "model_name": "Rescue Sentinel AI 2.0 (Qwen 2.5 1.5B Custom GGUF Q4_K_M)",
        "architecture": "qwen2",
        "quantization": "Q4_K_M",
        "runtime": {"n_ctx": 2048, "n_threads": 4, "n_gpu_layers": 0, "temperature": 0.3, "max_new_tokens": 400},
        "ollama_model_name": "floodguard-qwen",
    },
)

GGUF_TOKENIZER = _load_json_safe(
    os.path.join(MODEL_DIR, "gguf_tokenizer.json"),
    {
        "format": "gguf_embedded",
        "tokenizer_model": "gpt2",
        "pre_tokenizer": "qwen2",
        "vocab_size": 151936,
        "merges_count": 151387,
        "bos_token_id": 151643,
        "eos_token_id": 151645,
        "pad_token_id": 151643,
        "im_start_token": "<|im_start|>",
        "im_end_token": "<|im_end|>",
        "stop_tokens": ["<|im_end|>", "<|endoftext|>"],
        "chat_format": "chatml",
    },
)

OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", GGUF_CONFIG.get("ollama_model_name", "floodguard-qwen"))


# ===========================================================================
#  TIER 1 — llama-cpp-python + GGUF  (Primary backend for Raspberry Pi)
# ===========================================================================
class LlamaCppManager:
    """
    Runs your custom fine-tuned Qwen 2.5 1.5B via llama-cpp-python (Q4_K_M GGUF).

    RAM usage : ~1.5 GB total (vs ~5.8 GB for float32 safetensors)
    Speed     : 8–11 tokens/sec on Raspberry Pi 5 (ARM Cortex-A76, 4 cores)
    Install   : pip install llama-cpp-python
    Model file: qwen2.5-1.5b-custom-q4_k_m.gguf (configured in gguf_config.json)
    """

    def __init__(self, model_dir=MODEL_DIR):
        self.model_dir  = model_dir
        self.llm        = None
        self.status     = "idle"   # idle | loading | ready | error | not_found
        self.error_msg  = None
        self._lock      = threading.Lock()
        self._gguf_path = None

    # ------------------------------------------------------------------
    def _find_gguf(self):
        """Scan Model directory for configured GGUF model (prefers gguf_config.json)."""
        if not os.path.isdir(self.model_dir):
            return None
        configured = GGUF_CONFIG.get("model_file")
        if configured:
            exact = os.path.join(self.model_dir, configured)
            if os.path.isfile(exact):
                return exact
        candidates = glob.glob(os.path.join(self.model_dir, "*.gguf"))
        if not candidates:
            return None
        for tag in ["custom", "q4_k_m", "q5_k_m", "q4_0", "q8_0"]:
            for c in candidates:
                if tag in os.path.basename(c).lower():
                    return c
        return candidates[0]

    # ------------------------------------------------------------------
    def start_background_loading(self):
        with self._lock:
            if self.status in ("loading", "ready"):
                return
            path = self._find_gguf()
            if not path:
                self.status = "not_found"
                print("⚠️  [llama.cpp] No *.gguf file found in Model dir — skipping GGUF backend.")
                return
            self._gguf_path = path
            self.status = "loading"
            t = threading.Thread(target=self._worker, daemon=True)
            t.start()

    # ------------------------------------------------------------------
    @staticmethod
    def _attach_portable_runtime():
        """
        Loads portable llama_cpp bundled inside Rescue Users/runtime/ so the
        app can run straight off a USB pendrive without system-wide installation.
        """
        rescue_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        rt_base = os.path.join(rescue_root, "runtime")
        common_dir = os.path.join(rt_base, "common")
        if os.path.isdir(common_dir) and common_dir not in sys.path:
            sys.path.insert(0, common_dir)

        if sys.platform.startswith("win"):
            plat_dir = os.path.join(rt_base, "win_x64")
            if os.path.isdir(plat_dir) and plat_dir not in sys.path:
                sys.path.insert(0, plat_dir)
                lib_dir = os.path.join(plat_dir, "llama_cpp", "lib")
                if os.path.isdir(lib_dir) and hasattr(os, "add_dll_directory"):
                    try:
                        os.add_dll_directory(lib_dir)
                    except Exception:
                        pass
        elif sys.platform.startswith("linux"):
            plat_dir = os.path.join(rt_base, "linux_arm64")
            if os.path.isdir(plat_dir):
                # USB pendrives (FAT32/exFAT) often mount with noexec; stage to /tmp in RAM/tmpfs if needed
                import shutil
                import tempfile
                target_dir = plat_dir
                test_so = glob.glob(os.path.join(plat_dir, "llama_cpp", "lib", "*.so*"))
                needs_stage = test_so and not os.access(test_so[0], os.X_OK)
                if needs_stage:
                    staged = os.path.join(tempfile.gettempdir(), "floodguard_llama_rt")
                    if not os.path.exists(os.path.join(staged, "llama_cpp")):
                        shutil.copytree(plat_dir, staged, dirs_exist_ok=True)
                    for so_file in glob.glob(os.path.join(staged, "llama_cpp", "lib", "*.so*")):
                        try:
                            os.chmod(so_file, 0o755)
                        except Exception:
                            pass
                    target_dir = staged
                if target_dir not in sys.path:
                    sys.path.insert(0, target_dir)

    # ------------------------------------------------------------------
    def _worker(self):
        try:
            self._attach_portable_runtime()
            from llama_cpp import Llama  # type: ignore
            rt = GGUF_CONFIG.get("runtime", {})
            n_ctx = int(rt.get("n_ctx", 2048))
            n_threads = int(rt.get("n_threads", 4))
            n_gpu_layers = int(rt.get("n_gpu_layers", 0))
            print(f"🔄 [llama.cpp] Loading GGUF: {os.path.basename(self._gguf_path)} (n_ctx={n_ctx}, threads={n_threads})...")
            llm = Llama(
                model_path=self._gguf_path,
                n_ctx=n_ctx,
                n_threads=n_threads,
                n_gpu_layers=n_gpu_layers,
                verbose=False,
            )
            with self._lock:
                self.llm    = llm
                self.status = "ready"
            print("✅ [llama.cpp] GGUF model loaded — ready for inference!")
        except ImportError:
            with self._lock:
                self.status    = "not_found"
                self.error_msg = "llama-cpp-python not installed (pip install llama-cpp-python)"
            print(f"⚠️  [llama.cpp] {self.error_msg}")
        except Exception as e:
            import traceback
            with self._lock:
                self.status    = "error"
                self.error_msg = str(e)
            print(f"❌ [llama.cpp] Load error: {type(e).__name__}: {e}")
            traceback.print_exc()

    # ------------------------------------------------------------------
    def ensure_loaded(self, timeout_sec=60.0):
        if self.status == "ready":
            return True
        if self.status == "idle":
            self.start_background_loading()
        deadline = time.time() + timeout_sec
        while self.status == "loading" and time.time() < deadline:
            time.sleep(0.4)
        return self.status == "ready"

    # ------------------------------------------------------------------
    def generate(self, prompt, max_new_tokens=400, temperature=0.3):
        if not self.ensure_loaded(timeout_sec=90.0):
            return None  # caller falls through to next tier

        with self._lock:
            llm = self.llm

        try:
            stop_toks = GGUF_TOKENIZER.get("stop_tokens", ["<|im_end|>", "<|endoftext|>"])
            resp = llm(
                prompt,
                max_tokens=max_new_tokens,
                temperature=temperature,
                stop=stop_toks,
                echo=False,
            )
            text = resp["choices"][0]["text"].strip()
            return text if text else None
        except Exception as e:
            print(f"❌ [llama.cpp] Generation error: {type(e).__name__}: {e}")
            return None

    # ------------------------------------------------------------------
    def generate_stream(self, prompt, max_new_tokens=400, temperature=0.3):
        if not self.ensure_loaded(timeout_sec=90.0):
            return

        with self._lock:
            llm = self.llm

        try:
            stop_toks = GGUF_TOKENIZER.get("stop_tokens", ["<|im_end|>", "<|endoftext|>"])
            stream = llm(
                prompt,
                max_tokens=max_new_tokens,
                temperature=temperature,
                stop=stop_toks,
                echo=False,
                stream=True,
            )
            for chunk in stream:
                token = chunk["choices"][0]["text"]
                if token:
                    yield token
        except Exception as e:
            print(f"❌ [llama.cpp] Stream error: {type(e).__name__}: {e}")


# ===========================================================================
#  TIER 2 — Ollama REST API  (Alternative backend)
# ===========================================================================
class OllamaManager:
    """
    Calls a locally running Ollama server (port 11434) via HTTP.

    Install on Pi:
      curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-linux-arm64.tgz \\
           | sudo tar -C /usr -xzf -
      ollama serve &
      ollama pull qwen2.5:1.5b   # or import from GGUF (see plan doc)
    """

    def __init__(self, host=OLLAMA_HOST, model=OLLAMA_MODEL):
        self.host      = host.rstrip("/")
        self.model     = model
        self.status    = "idle"
        self.error_msg = None
        self._checked  = False

    # ------------------------------------------------------------------
    def _check_available(self):
        """Non-blocking ping to see if Ollama is running with our custom or Qwen model."""
        if self._checked:
            return self.status == "ready"
        try:
            import urllib.request
            with urllib.request.urlopen(f"{self.host}/api/tags", timeout=2.0) as r:
                data = json.loads(r.read().decode())
                models = [m.get("name", "") for m in data.get("models", [])]
                # Prefer our custom fine-tuned GGUF imported into Ollama as 'floodguard-qwen'
                preferred = ["floodguard-qwen", self.model, self.model.split(":")[0]]
                matched = None
                for p in preferred:
                    for m in models:
                        if p in m:
                            matched = m
                            break
                    if matched:
                        break
                if matched:
                    self.model = matched
                    self.status = "ready"
                    print(f"✅ [Ollama] Active model '{self.model}' at {self.host}")
                else:
                    self.status = "not_found"
                    self.error_msg = f"Ollama running but no FloodGuard/Qwen model imported. Found: {models}"
                    print(f"⚠️  [Ollama] {self.error_msg}")
        except Exception as e:
            self.status    = "not_found"
            self.error_msg = str(e)
        self._checked = True
        return self.status == "ready"

    def start_background_loading(self):
        # Ollama has no "load" step — just check availability
        t = threading.Thread(target=self._check_available, daemon=True)
        t.start()

    def ensure_loaded(self, timeout_sec=5.0):
        if self.status == "ready":
            return True
        return self._check_available()

    # ------------------------------------------------------------------
    def generate(self, prompt, max_new_tokens=400, temperature=0.3):
        if not self._check_available():
            return None

        import urllib.request
        stop_toks = GGUF_TOKENIZER.get("stop_tokens", ["<|im_end|>", "<|endoftext|>"])
        payload = json.dumps({
            "model":  self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_new_tokens,
                "temperature": temperature,
                "stop": stop_toks,
            }
        }).encode()

        try:
            req = urllib.request.Request(
                f"{self.host}/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read().decode())
                return (data.get("response") or "").strip() or None
        except Exception as e:
            print(f"❌ [Ollama] Generate error: {e}")
            return None

    # ------------------------------------------------------------------
    def generate_stream(self, prompt, max_new_tokens=400, temperature=0.3):
        if not self._check_available():
            return

        import urllib.request
        stop_toks = GGUF_TOKENIZER.get("stop_tokens", ["<|im_end|>", "<|endoftext|>"])
        payload = json.dumps({
            "model":  self.model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "num_predict": max_new_tokens,
                "temperature": temperature,
                "stop": stop_toks,
            }
        }).encode()

        try:
            req = urllib.request.Request(
                f"{self.host}/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                for line in r:
                    if line.strip():
                        chunk = json.loads(line.decode())
                        token = chunk.get("response", "")
                        if token:
                            yield token
                        if chunk.get("done"):
                            break
        except Exception as e:
            print(f"❌ [Ollama] Stream error: {e}")


# ===========================================================================
#  UNIFIED QwenModelManager — Pure GGUF Engine (llama-cpp-python + Ollama)
# ===========================================================================
class QwenModelManager:
    """
    Single public interface for your custom fine-tuned GGUF model
    (qwen2.5-1.5b-custom-q4_k_m.gguf). Tries backends in priority order:
      1. llama-cpp-python (in-process GGUF)
      2. Ollama REST API  (floodguard-qwen)
    """

    def __init__(self, model_dir=MODEL_DIR):
        self._llamacpp  = LlamaCppManager(model_dir)
        self._ollama    = OllamaManager()
        self._active    = None
        self._lock      = threading.Lock()
        self._started   = False
        self.error_msg  = None

    # ------------------------------------------------------------------
    def format_chat_prompt(self, system_prompt, user_prompt):
        """Formats system + user messages using gguf_tokenizer.json ChatML tokens."""
        im_start = GGUF_TOKENIZER.get("im_start_token", "<|im_start|>")
        im_end   = GGUF_TOKENIZER.get("im_end_token", "<|im_end|>")
        return (
            f"{im_start}system\n{system_prompt}\n{im_end}\n"
            f"{im_start}user\n{user_prompt}\n{im_end}\n"
            f"{im_start}assistant\n"
        )

    def get_model_metadata(self):
        """Returns active GGUF config + embedded tokenizer metadata."""
        active = self._get_active()
        backend = type(active).__name__.replace("Manager", "") if active else "none"
        return {
            "model": GGUF_CONFIG.get("model_name", "Rescue Sentinel AI 2.0 (Qwen 2.5 1.5B Custom GGUF Q4_K_M)"),
            "model_file": GGUF_CONFIG.get("model_file", "qwen2.5-1.5b-custom-q4_k_m.gguf"),
            "quantization": GGUF_CONFIG.get("quantization", "Q4_K_M"),
            "architecture": GGUF_CONFIG.get("architecture", "qwen2"),
            "n_ctx": GGUF_CONFIG.get("runtime", {}).get("n_ctx", 2048),
            "vocab_size": GGUF_TOKENIZER.get("vocab_size", 151936),
            "tokenizer_format": GGUF_TOKENIZER.get("format", "gguf_embedded"),
            "chat_format": GGUF_TOKENIZER.get("chat_format", "chatml"),
            "backend": backend,
            "status": self.status,
            "ready": (self.status == "ready"),
            "error": self.error_msg,
        }

    # ------------------------------------------------------------------
    @property
    def status(self):
        b = self._get_active()
        if b is not None:
            return b.status
        for mgr in (self._llamacpp, self._ollama):
            if mgr.status == "loading":
                return "loading"
        if self.error_msg:
            return "error"
        for mgr in (self._llamacpp, self._ollama):
            if mgr.status == "error":
                self.error_msg = mgr.error_msg
                return "error"
        return "idle"

    # ------------------------------------------------------------------
    def _get_active(self):
        """Return the first ready GGUF backend."""
        for mgr in (self._llamacpp, self._ollama):
            if mgr.status == "ready":
                return mgr
        return None

    # ------------------------------------------------------------------
    def start_background_loading(self):
        """Kick off GGUF backends concurrently; first ready wins."""
        with self._lock:
            if self._started:
                return
            self._started = True

        self._llamacpp.start_background_loading()
        self._ollama.start_background_loading()

        def _monitor_ready():
            for _ in range(30):
                if self._get_active() is not None:
                    return
                if self._llamacpp.status == "loading":
                    time.sleep(0.5)
                    continue
                if self._llamacpp.status in ("not_found", "error") and self._ollama.status in ("not_found", "error"):
                    self.error_msg = (
                        self._llamacpp.error_msg
                        or self._ollama.error_msg
                        or "GGUF runtime unavailable. Install llama-cpp-python or run Ollama with Modelfile."
                    )
                    return
                time.sleep(0.3)

        threading.Thread(target=_monitor_ready, daemon=True).start()

    # ------------------------------------------------------------------
    def ensure_model_loaded(self, timeout_sec=60.0):
        if self._get_active():
            return True
        self.start_background_loading()
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            active = self._get_active()
            if active:
                print(f"✅ [AI] Active GGUF backend: {type(active).__name__}")
                return True
            if self.status == "error":
                return False
            time.sleep(0.4)
        return False

    # ------------------------------------------------------------------
    def generate(self, prompt, max_new_tokens=400, temperature=0.3):
        if not self.ensure_model_loaded(timeout_sec=60.0):
            return f"⚠️ {self.error_msg}" if self.error_msg else "⏳ AI GGUF engine is still loading. Please retry."

        for backend in (self._llamacpp, self._ollama):
            if backend.status != "ready":
                continue
            result = backend.generate(prompt, max_new_tokens=max_new_tokens, temperature=temperature)
            if result:
                return result

        return "⚠️ GGUF AI backend returned an empty response. Please retry."

    # ------------------------------------------------------------------
    def generate_stream(self, prompt, max_new_tokens=400, temperature=0.3):
        if not self.ensure_model_loaded(timeout_sec=60.0):
            yield f"⚠️ {self.error_msg}" if self.error_msg else "⏳ AI GGUF engine is loading into RAM. Please retry."
            return

        for backend in (self._llamacpp, self._ollama):
            if backend.status != "ready":
                continue
            yielded = False
            for token in backend.generate_stream(prompt, max_new_tokens=max_new_tokens,
                                                  temperature=temperature):
                yield token
                yielded = True
            if yielded:
                return

        yield "⚠️ GGUF AI backend offline. Check llama-cpp-python or Ollama."


# ===========================================================================
#  AITelemetryInterface — Spatial grid engine + prompt builder
# ===========================================================================
class AITelemetryInterface:
    def __init__(self):
        self.grids_data        = []
        self.grid_index        = {}   # id -> grid dict
        self.high_ground_grids = []   # sorted by elevation desc
        self.low_basin_grids   = []   # sorted by elevation asc
        self.load_geojson()

    # ------------------------------------------------------------------
    def load_geojson(self):
        """Loads and indexes all Kamareddy flood grid features from GeoJSON."""
        if not os.path.exists(GEOJSON_PATH):
            print(f"⚠️  [AI 2.0] GeoJSON not found: {GEOJSON_PATH}")
            return
        try:
            with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.grids_data = data.get("features", [])

            for feat in self.grids_data:
                props = feat.get("properties", {})
                gid = props.get("id") or props.get("fid")
                if gid is None:
                    continue
                gid = int(gid)

                elev_mean = float(props.get("elev_\nmean") or props.get("elev_mean") or
                                  props.get("elevation") or 526.8)
                elev_min  = float(props.get("elev_\nmin")  or props.get("elev_min")  or elev_mean)
                elev_max  = float(props.get("elev_\nmax")  or props.get("elev_max")  or elev_mean)
                elev_diff = float(props.get("elev_diff\n") or props.get("elev_diff") or 0.0)
                safety    = float(props.get("safety_score", 50.0))
                risk      = props.get("risk_level") or (
                    "Very High Risk" if elev_mean < 515.0 else
                    "High Risk"      if elev_mean < 525.0 else
                    "Moderate Risk"
                )

                # Polygon centroid
                geom   = feat.get("geometry", {})
                coords = geom.get("coordinates", [])
                centroid = None
                if coords and coords[0]:
                    pts = coords[0]
                    centroid = {
                        "lat": round(sum(p[1] for p in pts) / len(pts), 6),
                        "lng": round(sum(p[0] for p in pts) / len(pts), 6),
                    }

                self.grid_index[gid] = {
                    "grid_id":      gid,
                    "elevation_m":  round(elev_mean, 2),
                    "elev_min":     round(elev_min,  2),
                    "elev_max":     round(elev_max,  2),
                    "elev_diff":    round(elev_diff, 2),
                    "risk_level":   risk,
                    "safety_score": round(safety, 1),
                    "centroid":     centroid,
                    "is_basin_trap": elev_mean < REGIONAL_BASIN_DATUM_M,
                    "is_high_ridge": elev_mean >= 530.0,
                }

            all_indexed = list(self.grid_index.values())
            self.high_ground_grids = sorted(all_indexed, key=lambda g: g["elevation_m"], reverse=True)
            self.low_basin_grids   = sorted(all_indexed, key=lambda g: g["elevation_m"])
            print(f"🗺️  [AI 2.0] Indexed {len(self.grid_index)} Kamareddy grids from {os.path.basename(GEOJSON_PATH)}")
        except Exception as e:
            print(f"⚠️  [AI 2.0] GeoJSON load error: {e}")

    # ------------------------------------------------------------------
    def get_grid_by_id(self, grid_id):
        try:
            return self.grid_index.get(int(grid_id))
        except (ValueError, TypeError):
            return None

    # ------------------------------------------------------------------
    def find_nearest_grid(self, lat, lng):
        """Finds the single closest grid centroid to a GPS coordinate."""
        if not self.grid_index or lat is None or lng is None:
            return None
        best, min_d = None, float("inf")
        for g in self.grid_index.values():
            c = g.get("centroid")
            if not c:
                continue
            d = math.hypot(lat - c["lat"], lng - c["lng"])
            if d < min_d:
                min_d = d
                best  = dict(g)
                best["distance_km"] = round(d * 111.0, 2)
        return best

    # ------------------------------------------------------------------
    def get_nearby_grids(self, lat, lng, radius_km=NEARBY_GRID_RADIUS_KM,
                         max_count=NEARBY_GRID_MAX):
        """
        Returns up to `max_count` grids within `radius_km` of the GPS fix,
        sorted by distance (nearest first).  Much smaller than all 713 grids —
        keeps the AI prompt lean for Raspberry Pi inference.

        If no GPS fix, falls back to the top FALLBACK_HIGH_RISK_COUNT highest-risk
        (lowest elevation) grids so the model still has useful context.
        """
        if lat is None or lng is None:
            # No GPS: return worst-risk (lowest elevation) grids as context
            return self.low_basin_grids[:FALLBACK_HIGH_RISK_COUNT]

        nearby = []
        radius_deg = radius_km / 111.0  # ~1° ≈ 111 km

        for g in self.grid_index.values():
            c = g.get("centroid")
            if not c:
                continue
            d_deg = math.hypot(lat - c["lat"], lng - c["lng"])
            if d_deg <= radius_deg:
                entry = dict(g)
                entry["distance_km"] = round(d_deg * 111.0, 2)
                nearby.append(entry)

        if not nearby:
            # GPS fix but no grids within radius — return the single nearest
            nearest = self.find_nearest_grid(lat, lng)
            return [nearest] if nearest else self.low_basin_grids[:FALLBACK_HIGH_RISK_COUNT]

        nearby.sort(key=lambda g: g.get("distance_km", 999))
        return nearby[:max_count]

    # ------------------------------------------------------------------
    def get_nearby_high_ground_ridges(self, ref_grid=None, min_elev=530.0, limit=2):
        """Finds nearest safe elevated grids (≥530m) for evacuation staging."""
        if not ref_grid or not ref_grid.get("centroid"):
            return [g for g in self.high_ground_grids if g["elevation_m"] >= min_elev][:limit]
        ref_c = ref_grid["centroid"]
        candidates = []
        for g in self.high_ground_grids:
            if g["elevation_m"] >= min_elev and g["grid_id"] != ref_grid.get("grid_id"):
                c = g.get("centroid")
                if c:
                    dist = math.hypot(ref_c["lat"] - c["lat"], ref_c["lng"] - c["lng"]) * 111.0
                    candidates.append((dist, g))
        candidates.sort(key=lambda x: x[0])
        return [c[1] for c in candidates[:limit]]

    # ------------------------------------------------------------------
    def resolve_target_grid_from_query(self, query_text):
        """Parses grid ID or landmark name from commander queries."""
        if not query_text or not isinstance(query_text, str):
            return None
        q = query_text.lower()
        m = re.search(r'(?:grid|sector)\s*#?\s*(\d+)', q)
        if m:
            return self.get_grid_by_id(int(m.group(1)))
        for landmark, gid in KAMAREDDY_LANDMARK_MAP.items():
            if landmark in q:
                return self.get_grid_by_id(gid)
        return None

    # ------------------------------------------------------------------
    def build_qwen_analysis_payload(self, gps_telemetry, lora_poles, active_sos_list=None):
        """
        Builds the structured context + prompt for Qwen inference.
        Only nearby grids are included (not all 713) to keep the prompt
        small enough for llama.cpp's 2048-token context window.
        """
        curr_lat = curr_lng = None
        speed = heading = 0.0
        gps_source = "NO_GPS_FIX"

        if gps_telemetry and isinstance(gps_telemetry, dict):
            lv = gps_telemetry.get("lat")
            lw = gps_telemetry.get("lng")
            if lv is not None and lw is not None:
                curr_lat   = float(lv)
                curr_lng   = float(lw)
                speed      = float(gps_telemetry.get("speed_kmh")  or 0.0)
                heading    = float(gps_telemetry.get("heading_deg") or 0.0)
                gps_source = gps_telemetry.get("source") or "GNSS_PI"

        # Spatial context — NEARBY GRIDS ONLY
        nearby = self.get_nearby_grids(curr_lat, curr_lng)
        current_grid = nearby[0] if nearby else None

        # LoRa poles summary
        active_poles, highest_threat = [], None
        max_rate = -1.0
        if lora_poles and isinstance(lora_poles, dict):
            for nid, pole in lora_poles.items():
                water = pole.get("water_level")
                if water is None:
                    continue
                rate = pole.get("hourly_rise_rate")
                entry = {
                    "id":                     nid,
                    "name":                   pole.get("name", f"Pole {nid}"),
                    "water_depth_m":          round(float(water), 2),
                    "hourly_rise_rate_m_per_h": round(float(rate), 2) if rate is not None else 0.0,
                    "temperature_c":          round(float(pole.get("temp_c", 25.0)), 1),
                    "battery_v":              round(float(pole.get("battery_v", 4.0)),  2),
                    "status":                 pole.get("status", "ACTIVE"),
                }
                if pole.get("lat") and pole.get("lng"):
                    entry["lat"] = pole["lat"]
                    entry["lng"] = pole["lng"]
                active_poles.append(entry)
                if rate is not None and float(rate) > max_rate:
                    max_rate       = float(rate)
                    highest_threat = entry

        # Structured context (returned alongside the prompt for API consumers)
        context = {
            "timestamp":    time.time(),
            "rescue_unit": {
                "has_gps_fix": (curr_lat is not None),
                "gps": {
                    "lat": curr_lat, "lng": curr_lng,
                    "speed_kmh": speed, "heading_deg": heading, "source": gps_source,
                },
                "nearby_grids":           nearby,
                "current_grid":           current_grid,
                "vehicle_wading_limit_m": DEFAULT_TRUCK_WADING_LIMIT_M,
                "regional_basin_datum_m": REGIONAL_BASIN_DATUM_M,
            },
            "field_lora_telemetry": {
                "active_pole_count": len(active_poles),
                "poles":             active_poles,
                "highest_threat_pole": highest_threat,
            },
            "sos_count": len(active_sos_list) if active_sos_list else 0,
        }

        # Build compact prompt
        pos_str  = (f"GPS={curr_lat:.5f},{curr_lng:.5f} | Hdg={heading}° | Spd={speed}km/h"
                    if curr_lat is not None else "GPS=Awaiting GNSS Fix")
        grid_str = (f"Grid #{current_grid['grid_id']} (Elev:{current_grid['elevation_m']}m)"
                    if current_grid else "Grid=Unknown")

        nearby_str = ""
        if nearby:
            nearby_str = "Nearby grids: " + ", ".join(
                f"#{g['grid_id']}({g['elevation_m']}m,{g['risk_level'][:4]})"
                for g in nearby
            )

        lora_str = "No LoRa sensors active."
        if active_poles:
            lora_str = "\n".join(
                f"- [{p['id']}] Depth={p['water_depth_m']}m Rise={p['hourly_rise_rate_m_per_h']}m/h Batt={p['battery_v']}V ({p['status']})"
                for p in active_poles
            )

        prompt = qwen_manager.format_chat_prompt(
            (
                f"You are Rescue Sentinel AI 2.0 for Kamareddy flood operations.\n"
                f"Vehicle wading limit: {DEFAULT_TRUCK_WADING_LIMIT_M}m. Basin datum: {REGIONAL_BASIN_DATUM_M}m.\n"
                f"If water depth > {DEFAULT_TRUCK_WADING_LIMIT_M}m: order HALT + deploy inflatable boats.\n"
                f"Do NOT output Channel 2 Citizen Broadcast unless commander orders it."
            ),
            (
                f"[POSITION]: {pos_str} | {grid_str}\n"
                f"{nearby_str}\n"
                f"[LORA]:\n{lora_str}\n"
                f"Assess sector passability. Provide tactical instructions."
            ),
        )

        return {"structured_context": context, "qwen_prompt": prompt}

    # ------------------------------------------------------------------
    def derive_dynamic_options(self, q_lower, target_grid=None, is_broadcast_ordered=False):
        return []

    # ------------------------------------------------------------------
    def get_tactical_prompt_and_meta(self, payload, custom_query=None):
        """Builds a grounded, compact prompt from live telemetry + nearby grids."""
        q_clean  = (custom_query or "").strip()
        q_lower  = q_clean.lower()
        broadcast_triggers = [
            "broadcast", "warn citizen", "citizen alert", "public alert",
            "evacuation alert", "send warning", "warn residents",
        ]
        is_broadcast_ordered = any(t in q_lower for t in broadcast_triggers)

        ctx          = payload.get("structured_context", {})
        rescue_unit  = ctx.get("rescue_unit", {})
        nearby       = rescue_unit.get("nearby_grids", [])
        grid_loc     = rescue_unit.get("current_grid")
        target_grid  = self.resolve_target_grid_from_query(custom_query) or grid_loc
        datum        = rescue_unit.get("regional_basin_datum_m", REGIONAL_BASIN_DATUM_M)
        wading       = rescue_unit.get("vehicle_wading_limit_m", DEFAULT_TRUCK_WADING_LIMIT_M)

        if target_grid:
            gid      = target_grid["grid_id"]
            elev     = target_grid["elevation_m"]
            is_trap  = elev < datum
            diff     = abs(elev - datum)
            ridges   = self.get_nearby_high_ground_ridges(target_grid, limit=2)
            ridge_s  = ", ".join(f"Grid #{g['grid_id']}({g['elevation_m']}m)" for g in ridges) or "Grid #189(548m)"
            hydro    = (f"Basin trap ({diff:.1f}m BELOW datum — flood catchment)"
                        if is_trap else f"Ridge ({diff:.1f}m above datum)")
            spatial  = (f"Grid #{gid} Elev:{elev}m | {hydro} | "
                        f"Risk:{target_grid.get('risk_level','?')} | Safe staging: {ridge_s}")
        else:
            spatial = "No grid fix. Use regional datum 515m as reference."

        # Nearby grid summary (compact — 1 line per grid)
        nearby_summary = ""
        if nearby:
            nearby_summary = "Nearby sectors: " + ", ".join(
                f"#{g['grid_id']}({g['elevation_m']}m,{g['risk_level'][:4]},{g.get('distance_km','?')}km)"
                for g in nearby
            ) + "\n"

        poles = ctx.get("field_lora_telemetry", {}).get("poles", [])
        pole_info = (", ".join(f"{p['name']}:{p['water_depth_m']}m(+{p.get('hourly_rise_rate_m_per_h',0)}m/h)"
                               for p in poles)
                     if poles else "Sensor poles: normal levels")

        prompt = qwen_manager.format_chat_prompt(
            (
                f"Rescue Sentinel AI 2.0 — Kamareddy district flood operations.\n"
                f"SPATIAL: {spatial}\n"
                f"{nearby_summary}"
                f"LoRa: {pole_info}\n"
                f"Vehicle wading limit: {wading}m | Basin datum: {datum}m\n"
                f"RULES: Answer directly. If water > {wading}m: HALT wheeled convoy, deploy IRBs.\n"
                f"Sectors < {datum}m elevation = flood catchment traps.\n"
                f"No Channel 2 citizen broadcast unless explicitly ordered."
            ),
            q_clean if q_clean else "Evaluate current sector status and passability.",
        )
        options = self.derive_dynamic_options(q_lower, target_grid=target_grid,
                                              is_broadcast_ordered=is_broadcast_ordered)
        return prompt, options, is_broadcast_ordered, target_grid

    # ------------------------------------------------------------------
    def generate_tactical_response(self, payload, custom_query=None):
        """Generates a tactical advisory using the active AI backend."""
        prompt, options, is_broadcast_ordered, _ = self.get_tactical_prompt_and_meta(
            payload, custom_query=custom_query
        )

        if not qwen_manager.ensure_model_loaded(timeout_sec=35.0):
            err = qwen_manager.error_msg
            return {
                "text": f"⚠️ AI Engine Not Ready: {err}" if err else (
                    "⏳ AI engine is still loading into RAM. Please wait a moment and retry."
                ),
                "options": options,
                "engine": "error" if err else "loading",
            }

        try:
            text = qwen_manager.generate(prompt, max_new_tokens=400, temperature=0.3)
            if text and len(text.strip()) > 5:
                if not is_broadcast_ordered:
                    text = re.sub(
                        r'### (📢 CHANNEL 2: CITIZEN EVACUATION BROADCAST|CHANNEL 2)[\s\S]*?(?=(###|$))',
                        '', text
                    ).strip()
                backend_name = type(qwen_manager._get_active()).__name__ if qwen_manager._get_active() else "unknown"
                return {"text": text.strip(), "options": options, "engine": backend_name}
            return {
                "text": "⚠️ AI returned an empty response. Please retry your directive.",
                "options": options, "engine": "empty",
            }
        except Exception as e:
            return {
                "text": f"⚠️ AI generation error: {e}",
                "options": options, "engine": "error",
            }


# ===========================================================================
#  Global singletons (imported by pi_hardware_bridge.py)
# ===========================================================================
qwen_manager = QwenModelManager()
ai_interface  = AITelemetryInterface()


# ===========================================================================
#  Standalone test
# ===========================================================================
if __name__ == "__main__":
    test_gps   = {"lat": 18.3261, "lng": 78.3332, "speed_kmh": 0.0, "heading_deg": 0.0}
    test_poles = {"Node-01": {"water_level": 1.15, "hourly_rise_rate": 0.65, "name": "Tekriyal Basin"}}

    print("=== Nearby grids for test GPS ===")
    nearby = ai_interface.get_nearby_grids(test_gps["lat"], test_gps["lng"])
    for g in nearby:
        print(f"  Grid #{g['grid_id']} | {g['elevation_m']}m | {g['risk_level']} | {g.get('distance_km','?')} km")

    print("\n=== Building payload ===")
    payload = ai_interface.build_qwen_analysis_payload(test_gps, test_poles)

    print("\n=== Prompt preview (first 800 chars) ===")
    print(payload["qwen_prompt"][:800])

    print("\n=== Generating tactical response ===")
    res = ai_interface.generate_tactical_response(payload)
    print("ADVISORY:", res["text"])
    print("ENGINE :", res["engine"])
