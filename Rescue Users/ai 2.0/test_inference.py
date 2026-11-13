#!/usr/bin/env python3
"""
=============================================================================
FloodGuard AI 2.0 — Custom GGUF Q4_K_M Model Verification Suite
=============================================================================
Tests the quantized custom model (ai 2.0/Model/qwen2.5-1.5b-custom-q4_k_m.gguf)
via llama-cpp-python or Ollama (no safetensors / PyTorch / transformers):
1. Convoy Tactical Command (Wading limits, surge calculation, Go/No-Go)
2. Dual-Channel Telugu & English Emergency Citizen Broadcasts
3. Hardware LoRa Telemetry & Dynamic Danger Assessment
=============================================================================
"""

import os
import sys
import argparse

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ai_telemetry_interface import qwen_manager, MODEL_DIR

SYSTEM_PROMPT = (
    "You are Rescue Sentinel AI 2.0, the autonomous disaster intelligence engine for Kamareddy rescue operations. "
    "Adhere strictly to dynamic reasoning over hardcoded values: compare live water depths against vehicle wading limits (0.8m), "
    "evaluate sector elevation against regional datum (515m), and compute evacuation windows dynamically. "
    "When a flood hazard or surge is reported, produce dual-channel outputs: [CHANNEL 1: RESCUE TACTICAL COMMAND] for convoy drivers and rescue teams, "
    "and [CHANNEL 2: CITIZEN EVACUATION BROADCAST] in clear English and Telugu for public early warning."
)

TEST_SCENARIOS = [
    {
        "name": "Aspect 1: Tactical Convoy Wading & Rapid Surge Assessment",
        "query": (
            "Rescue convoy approaching Grid #680 (Elevation 504.6m, Adloor High Hazard Sector). "
            "Telemetry pole reports water depth 0.65m and surging at +0.45 m/h. Vehicle safe wading limit is 0.80m. "
            "Can the convoy cross, and how many minutes remain before the road is completely impassable?"
        )
    },
    {
        "name": "Aspect 2: Bilingual Citizen Broadcast (Telugu & English)",
        "query": (
            "Causeway near Kamareddy low-lying railway underpass is now submerged under 1.1m of floodwater. "
            "Provide immediate dual-channel guidance: tactical convoy detour route and citizen evacuation broadcast in English and Telugu."
        )
    },
    {
        "name": "Aspect 3: LoRa Hardware Telemetry Packet Analysis",
        "query": (
            "Received LoRa telemetry packet from River Node #3: "
            "{\"node\": \"RN-03\", \"lat\": 18.3182, \"lon\": 78.3341, \"water_level_m\": 3.82, \"surge_rate_m_hr\": 0.68, \"danger_threshold_m\": 3.50}. "
            "Interpret the sensor telemetry and generate emergency deployment orders."
        )
    }
]


def load_gguf_engine():
    print("==================================================================")
    print(" 🤖 RESCUE SENTINEL AI 2.0 — CUSTOM GGUF Q4_K_M VERIFICATION")
    print("==================================================================")
    print(f" 📂 Model Directory: {MODEL_DIR}")
    qwen_manager.start_background_loading()
    if not qwen_manager.ensure_model_loaded(timeout_sec=60.0):
        print(f" ❌ Failed to load GGUF engine: {qwen_manager.error_msg}")
        sys.exit(1)
    meta = qwen_manager.get_model_metadata()
    print(f" ✅ Model     : {meta['model_file']} ({meta['quantization']}, n_ctx={meta['n_ctx']})")
    print(f" ✅ Tokenizer : {meta['tokenizer_format']} (vocab={meta['vocab_size']}, chat={meta['chat_format']})")
    print(f" ✅ Backend   : {meta['backend']}")
    print("==================================================================\n")


def generate_response(query):
    prompt = qwen_manager.format_chat_prompt(SYSTEM_PROMPT, query)
    return qwen_manager.generate(prompt, max_new_tokens=320, temperature=0.3)


def main():
    parser = argparse.ArgumentParser(description="Test Custom GGUF Q4_K_M Qwen Model.")
    parser.add_argument("--prompt", type=str, default=None, help="Custom prompt to test")
    parser.add_argument("--scenario", type=int, default=None, help="Test scenario index (1, 2, or 3)")
    args = parser.parse_args()

    load_gguf_engine()

    if args.prompt:
        print(f"🎯 Running Custom Test Prompt:\n{args.prompt}\n")
        resp = generate_response(args.prompt)
        print("======================== AI 2.0 RESPONSE =========================")
        print(resp)
        print("==================================================================")
        return

    scenarios = TEST_SCENARIOS
    if args.scenario is not None and 1 <= args.scenario <= len(TEST_SCENARIOS):
        scenarios = [TEST_SCENARIOS[args.scenario - 1]]

    for i, scen in enumerate(scenarios, 1):
        print("\n==================================================================")
        print(f" 🧪 TEST CASE #{i}: {scen['name']}")
        print("==================================================================")
        print(f"📥 Query:\n{scen['query']}\n")
        print("⚡ Generating AI Response from Custom GGUF Q4_K_M...")
        response = generate_response(scen['query'])
        print("\n---------------------- AI 2.0 DUAL-CHANNEL OUTPUT ----------------------")
        print(response)
        print("------------------------------------------------------------------------")

    print("\n==================================================================")
    print(" ✅ ALL GGUF VERIFICATION TESTS COMPLETED!")
    print("==================================================================")


if __name__ == "__main__":
    main()
