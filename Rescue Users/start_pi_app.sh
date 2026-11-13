#!/bin/bash
# =============================================================================
# FloodGuard Rescue Operations — Raspberry Pi One-Command Launcher
# =============================================================================
# Installs dependencies & launches the app WITHOUT Chromium:
#   • System packages  (webkit2gtk, python3-gi, pyserial, cmake/build-essential)
#   • PyWebView        (native GTK3 + WebKit2 window — NO Chromium)
#   • Swap guard       (ensures >= 2 GB swap if compiling llama-cpp-python)
#   • llama-cpp-python / Ollama registration for YOUR custom Q4_K_M GGUF
#   • Desktop shortcut
#
# Usage:
#   chmod +x start_pi_app.sh
#   ./start_pi_app.sh
# =============================================================================

set -euo pipefail

CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo -e "${CYAN}======================================================================"
echo -e "   FLOODGUARD AI 2.0 — RASPBERRY PI SETUP & LAUNCHER (NO CHROMIUM)"
echo -e "   Autonomous NDRF/SDRF Field Unit | Custom Q4_K_M GGUF Engine"
echo -e "======================================================================${NC}"
echo ""

# ── STEP 1: Serial / hardware permissions ────────────────────────────────────
echo -e "${CYAN}[STEP 1/5]${NC} Serial device permissions (GNSS + LoRa)..."
sudo usermod -a -G dialout,tty,video,audio "$USER" 2>/dev/null || true
sudo chmod 666 /dev/ttyUSB* /dev/ttyACM* /dev/serial* /dev/ttyAMA* 2>/dev/null || true
echo -e "${GREEN}  ✔ Serial bus access granted${NC}"

# ── STEP 2: System packages (WebKit2 + build tools) ──────────────────────────
echo -e "${CYAN}[STEP 2/5]${NC} Verifying WebKit2 / GTK3 / serial system packages..."
WEBKIT_PKG="gir1.2-webkit2-4.1"
apt-cache show gir1.2-webkit2-4.1 &>/dev/null || WEBKIT_PKG="gir1.2-webkit2-4.0"

MISSING_PKGS=""
for pkg in python3-gi python3-gi-cairo gir1.2-gtk-3.0 "$WEBKIT_PKG" python3-webview python3-serial python3-jinja2 python3-markupsafe python3-numpy python3-pip; do
    if ! dpkg -s "$pkg" &>/dev/null; then
        MISSING_PKGS="$MISSING_PKGS $pkg"
    fi
done

if [ -n "$MISSING_PKGS" ]; then
    echo -e "${YELLOW}  Installing:${MISSING_PKGS}${NC}"
    sudo apt-get update -qq 2>/dev/null || true
    if ! sudo apt-get install -y $MISSING_PKGS 2>/dev/null; then
        for pkg in $MISSING_PKGS; do
            sudo apt-get install -y "$pkg" 2>/dev/null || true
        done
    fi
    echo -e "${GREEN}  ✔ System packages step complete${NC}"
else
    echo -e "${GREEN}  ✔ System packages already present${NC}"
fi

# ── STEP 3: Python GUI + Serial + AI Runtime ─────────────────────────────────
echo -e "${CYAN}[STEP 3/5]${NC} Verifying PyWebView & Custom Q4_K_M AI Runtime..."

pip_install() {
    local pkg="$1"
    pip3 install "$pkg" --break-system-packages -q 2>/dev/null || \
    pip3 install "$pkg" -q 2>/dev/null || \
    pip3 install "$pkg" --user -q 2>/dev/null || true
}

if ! python3 -c "import webview" 2>/dev/null; then
    echo -e "${YELLOW}  Installing PyWebView (GTK WebKit2)...${NC}"
    pip_install "pywebview"
fi

if ! python3 -c "import serial" 2>/dev/null; then
    pip_install "pyserial"
fi

MODEL_DIR="$DIR/ai 2.0/Model"
GGUF_FILE=$(find "$MODEL_DIR" -maxdepth 1 -name "*.gguf" 2>/dev/null | head -1 || true)

if [ -n "$GGUF_FILE" ]; then
    echo -e "${GREEN}  ✔ Custom GGUF ready: $(basename "$GGUF_FILE")${NC}"
else
    echo -e "${YELLOW}  ⚠ No *.gguf file found in $MODEL_DIR${NC}"
    echo -e "${YELLOW}    Copy qwen2.5-1.5b-custom-q4_k_m.gguf from Windows PC into ai 2.0/Model/${NC}"
fi

if [ -d "$DIR/runtime/linux_arm64/llama_cpp" ]; then
    echo -e "${GREEN}  ✔ Portable pendrive llama runtime ready (runtime/linux_arm64/)${NC}"
elif ! python3 -c "import llama_cpp" 2>/dev/null; then
    # Try offline wheel from pendrive first (zero internet, zero compile)
    if ls "$DIR/scripts/offline_packages"/llama_cpp_python*aarch64*.whl >/dev/null 2>&1; then
        echo -e "${YELLOW}  Installing llama-cpp-python from pendrive offline wheel...${NC}"
        pip3 install --no-index --find-links="$DIR/scripts/offline_packages" llama-cpp-python --break-system-packages -q 2>/dev/null || \
        pip3 install --no-index --find-links="$DIR/scripts/offline_packages" llama-cpp-python -q 2>/dev/null || true
    fi

    if ! python3 -c "import llama_cpp" 2>/dev/null; then
        # Guard against C++ compiler OOM when compiling llama-cpp-python on 4GB Pi
        SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
        if [ "${SWAP_MB:-0}" -lt 1024 ] && [ -f /etc/dphys-swapfile ]; then
            echo -e "${YELLOW}  Temporarily increasing swap to 2048 MB for llama-cpp-python install...${NC}"
            sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile 2>/dev/null || true
            sudo systemctl restart dphys-swapfile 2>/dev/null || true
        fi
        echo -e "${YELLOW}  Installing llama-cpp-python (custom GGUF runtime)...${NC}"
        python3 "$DIR/pi_setup.py" || true
    fi
else
    echo -e "${GREEN}  ✔ llama-cpp-python ready.${NC}"
    # If Ollama is also installed, ensure custom GGUF is registered cleanly
    if command -v ollama &>/dev/null && [ -n "$GGUF_FILE" ]; then
        if ! ollama list 2>/dev/null | grep -q "floodguard-qwen"; then
            python3 "$DIR/pi_setup.py" || true
        fi
    fi
fi

# ── STEP 4: Desktop shortcut ──────────────────────────────────────────────────
echo -e "${CYAN}[STEP 4/5]${NC} Checking Raspberry Pi Desktop shortcut..."
DESKTOP_DIR="$HOME/Desktop"
if [ -d "$DESKTOP_DIR" ]; then
    SHORTCUT="$DESKTOP_DIR/FloodGuard_Rescue.desktop"
    EMBLEM="$DIR/assets/Flood Rescue Monitoring Emblem.png"
    cat > "$SHORTCUT" << EOF
[Desktop Entry]
Type=Application
Name=FloodGuard Rescue Terminal
Comment=Autonomous Flood Rescue & LoRa Telemetry Command Terminal
Icon=$EMBLEM
Exec=/bin/bash -c "cd '$DIR' && ./start_pi_app.sh"
Terminal=false
StartupNotify=true
Categories=Utility;Application;
EOF
    chmod +x "$SHORTCUT" 2>/dev/null || true
    gio set "$SHORTCUT" metadata::trusted true 2>/dev/null || true
    echo -e "${GREEN}  ✔ Desktop shortcut: $SHORTCUT${NC}"
fi

# ── STEP 5: Launch ────────────────────────────────────────────────────────────
echo -e "${CYAN}[STEP 5/5]${NC} Launching FloodGuard Rescue App (PyWebView / WebKit2)..."
chmod +x "$DIR/run_rescue_app.py" 2>/dev/null || true
export WEBKIT_DISABLE_DMABUF_RENDERER=1
exec python3 run_rescue_app.py --foreground
