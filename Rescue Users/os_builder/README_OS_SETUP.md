# FloodGuard Rescue OS 2.0 — Separate OS + USB Pendrive Guide

Your **`vs` project stays 100% separate on your USB pendrive**, while the **OS stays separate on the Raspberry Pi SD card**.

## 1. On Your Windows Laptop (First)
1. Copy `d:\vs` onto your laptop (`C:\`) as backup.
2. Run once (while connected to internet) to make sure the portable ARM64 Llama runtime is inside `Rescue Users/runtime/linux_arm64/`:
   ```powershell
   python "d:\vs\Rescue Users\scripts\bundle_pendrive_runtime.py"
   ```
3. Keep `Rescue Users/` on your **USB Pendrive**.

## 2. On Your Raspberry Pi SD Card (One-Time OS Build)
1. Flash **Raspberry Pi OS Lite (64-bit)** using Raspberry Pi Imager onto your **SD Card** (with SSH/user `pi` enabled).
2. Boot the Pi with your **USB Pendrive** plugged in, mount/cd to `Rescue Users/os_builder/`, and run:
   ```bash
   sudo bash setup_floodguard_os.sh
   sudo reboot
   ```

## 3. Daily Field Use
- **Power ON Pi** → Branded FloodGuard boot splash → **Zero OS desktop** → Directly opens **FLOODGUARD RESCUE COMMAND** live splash (`127.0.0.1:8088` Hardware Bridge + GNSS/LoRa + Qwen 2.5 GGUF auto-started) → Rescue Dashboard!
- **Top-Left `>_` ↔ FloodGuard Button**: Click **`>_`** for fullscreen built-in Terminal (`htop`, `cgps`, `minicom`, `nmcli`, `bash`); click the **FloodGuard emblem** to return to the map.
- **Emergency Linux TTY**: `Ctrl + Alt + F2` (`Ctrl + Alt + F1` returns to app).
