#!/usr/bin/env python3
"""
=============================================================================
FloodGuard AI 2.0 — Raspberry Pi Custom GGUF Runtime Setup
=============================================================================
Configures the Raspberry Pi to run YOUR custom fine-tuned GGUF model:
  ai 2.0/Model/qwen2.5-1.5b-custom-q4_k_m.gguf  (~935 MiB, Q4_K_M)

Does NOT download any generic model from HuggingFace — strictly uses your
trained FloodGuard Qwen 2.5 1.5B model.

Runtime priority on Pi:
  1. llama-cpp-python  (in-process, fastest startup)
  2. Ollama            (registers your custom GGUF as 'floodguard-qwen')

Usage (on Pi, inside Rescue Users/):
    python3 pi_setup.py
=============================================================================
"""

import os
import sys
import subprocess
import glob

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "ai 2.0", "Model")
CUSTOM_GGUF_NAME = "qwen2.5-1.5b-custom-q4_k_m.gguf"


def run(cmd, **kw):
    print(f"\n$ {cmd}")
    return subprocess.run(cmd, shell=True, **kw)


def find_custom_gguf():
    if not os.path.isdir(MODEL_DIR):
        return None
    exact = os.path.join(MODEL_DIR, CUSTOM_GGUF_NAME)
    if os.path.isfile(exact):
        return exact
    any_gguf = glob.glob(os.path.join(MODEL_DIR, "*.gguf"))
    return any_gguf[0] if any_gguf else None


def install_llama_cpp():
    print("\n─── Checking / Installing llama-cpp-python ────────────────")
    portable_arm = os.path.join(BASE_DIR, "runtime", "linux_arm64", "llama_cpp")
    if os.path.isdir(portable_arm):
        print("✅ Portable pendrive runtime found: runtime/linux_arm64/llama_cpp")
        return True
    try:
        import llama_cpp  # noqa
        print("✅ llama-cpp-python already installed.")
        return True
    except ImportError:
        pass

    offline_dir = os.path.join(BASE_DIR, "scripts", "offline_packages")
    if os.path.isdir(offline_dir) and glob.glob(os.path.join(offline_dir, "llama_cpp_python*.whl")):
        run(f'pip3 install --no-index --find-links="{offline_dir}" llama-cpp-python --break-system-packages -q 2>/dev/null || pip3 install --no-index --find-links="{offline_dir}" llama-cpp-python -q')

    # Try pre-built CPU wheels first (fast, no compilation)
    if not glob.glob(os.path.join(offline_dir, "llama_cpp_python*.whl")):
        ret = run("pip3 install llama-cpp-python --break-system-packages -q 2>/dev/null || pip3 install llama-cpp-python -q")
        if ret.returncode != 0:
            print("⚠️  Pre-built wheel unavailable — building from source (may take 5-10 min on Pi)...")
            run("pip3 install llama-cpp-python --no-binary llama-cpp-python --break-system-packages || pip3 install llama-cpp-python --no-binary llama-cpp-python")

    try:
        import llama_cpp  # noqa
        print("✅ llama-cpp-python installed and verified.")
        return True
    except ImportError:
        print("❌ llama-cpp-python could not be imported.")
        return False


def register_ollama_custom_gguf(gguf_path):
    """If Ollama is installed, register our custom fine-tuned GGUF as 'floodguard-qwen'."""
    ret = subprocess.run("ollama list", shell=True, capture_output=True, text=True)
    if ret.returncode != 0:
        return False

    print("\n─── Ollama detected — checking custom model registration ──")
    if "floodguard-qwen" in ret.stdout:
        print("✅ Ollama already has 'floodguard-qwen' registered.")
        return True

    if not gguf_path:
        print("⚠️  No custom GGUF file found to register in Ollama.")
        return False

    modelfile_path = os.path.join(MODEL_DIR, "Modelfile")
    if not os.path.isfile(modelfile_path):
        with open(modelfile_path, "w", encoding="utf-8") as f:
            f.write(f'FROM ./{os.path.basename(gguf_path)}\n')
            f.write('PARAMETER temperature 0.3\n')
            f.write('PARAMETER num_ctx 2048\n')
            f.write('PARAMETER stop "<|im_end|>"\n')
            f.write('PARAMETER stop "<|endoftext|>"\n')

    print(f"📦 Importing {os.path.basename(gguf_path)} into Ollama as 'floodguard-qwen'...")
    res = run(f'cd "{MODEL_DIR}" && ollama create floodguard-qwen -f Modelfile')
    if res.returncode == 0:
        print("✅ Custom model registered in Ollama as 'floodguard-qwen'!")
        return True
    print("⚠️  Ollama import failed.")
    return False


def main():
    print("=" * 64)
    print("  FloodGuard AI 2.0 — Raspberry Pi Custom GGUF Runtime Setup")
    print("=" * 64)

    gguf_path = find_custom_gguf()
    if gguf_path:
        size_mb = os.path.getsize(gguf_path) / (1024 * 1024)
        print(f"✅ Custom GGUF found: {os.path.basename(gguf_path)} ({size_mb:.0f} MB)")
    else:
        print(f"❌ Custom GGUF missing in: {MODEL_DIR}")
        print(f"   Copy '{CUSTOM_GGUF_NAME}' from your Windows PC into '{MODEL_DIR}'")

    llamacpp_ok = install_llama_cpp()
    ollama_ok   = register_ollama_custom_gguf(gguf_path)

    print("\n" + "=" * 64)
    print("  SETUP SUMMARY")
    print("=" * 64)
    print(f"  Custom GGUF      : {'✅ Ready' if gguf_path else '❌ Missing'}")
    print(f"  llama-cpp-python : {'✅ Ready' if llamacpp_ok else '❌ Not installed'}")
    print(f"  Ollama fallback  : {'✅ Ready (floodguard-qwen)' if ollama_ok else '— Not installed'}")
    print("=" * 64)


if __name__ == "__main__":
    main()
