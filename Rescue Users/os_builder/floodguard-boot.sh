#!/bin/bash
# =============================================================================
# FloodGuard Rescue OS 2.0 — Pendrive Auto-Detector & Kiosk Boot Launcher
# =============================================================================
# Installed on the Pi OS at /usr/local/bin/floodguard-boot.sh.
# Keeps `vs` strictly separate on your USB pendrive:
#   1. Scans mounted USB pendrives for `Rescue Users/run_rescue_app.py`
#   2. If pendrive not yet inserted, shows branded waiting page until plugged in
#   3. Starts `pi_hardware_bridge.py` (GNSS + LoRa + Qwen GGUF Q4_K_M)
#   4. Launches `run_rescue_app.py --foreground --kiosk` inside Cage / Openbox
# =============================================================================

set -u

WAIT_HTML="/tmp/floodguard_wait_usb.html"

find_pendrive_app() {
  local dir
  shopt -s nullglob
  local candidates=(
    /mnt/fg_*/"Rescue Users"
    /mnt/fg_*/vs/"Rescue Users"
    "/mnt/floodguard_usb/Rescue Users"
    "/mnt/floodguard_usb/vs/Rescue Users"
    "/media/$USER"/*/"Rescue Users"
    "/media/$USER"/*/vs/"Rescue Users"
    "/run/media/$USER"/*/"Rescue Users"
    "/run/media/$USER"/*/vs/"Rescue Users"
    "$HOME/Rescue Users"
    "$HOME/vs/Rescue Users"
    "/opt/floodguard/Rescue Users"
    "/opt/floodguard/vs/Rescue Users"
  )
  shopt -u nullglob
  for dir in "${candidates[@]}"; do
    if [ -f "$dir/run_rescue_app.py" ] && [ -f "$dir/pi_hardware_bridge.py" ]; then
      echo "$dir"
      return 0
    fi
  done
  return 1
}

try_mount_usb_partitions() {
  # Fallback scan if udev automount hasn't mounted a newly inserted USB stick yet
  # Safely skips OS USB boot partitions (/ and /boot/firmware) via findmnt check
  local dev mnt fstype opts
  for dev in /dev/sd[a-z][0-9]* /dev/sd[a-z]; do
    [ -b "$dev" ] || continue
    if ! findmnt -rn "$dev" >/dev/null 2>&1; then
      fstype="$(blkid -o value -s TYPE "$dev" 2>/dev/null || true)"
      [ -n "$fstype" ] || continue
      mnt="/mnt/fg_$(basename "$dev")"
      opts="defaults,uid=$(id -u),gid=$(id -g)"
      [ "$fstype" = "ext4" ] && opts="defaults"
      systemd-mount --no-block --automount=yes --options="$opts" "$dev" "$mnt" 2>/dev/null || true
    fi
  done
}

# Create clean waiting HTML in case Pi boots before pendrive is plugged in
cat > "$WAIT_HTML" << 'EOF'
<!DOCTYPE html><html><head><meta charset="utf-8"><title>FloodGuard Rescue OS</title>
<style>
  body{margin:0;height:100vh;background:#050811;color:#f8fafc;font-family:system-ui,sans-serif;display:grid;place-items:center;text-align:center;}
  .card{padding:36px 44px;border-radius:20px;background:rgba(15,23,42,.92);border:1px solid rgba(56,189,248,.35);box-shadow:0 20px 60px rgba(0,0,0,.7);max-width:480px;}
  h1{margin:0 0 10px;font-size:1.35rem;color:#38bdf8;letter-spacing:.04em;}
  p{margin:0;color:#94a3b8;font-size:.95rem;line-height:1.5;}
  .dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981;margin-right:8px;animation:p 1.2s infinite;}
  @keyframes p{0%,100%{opacity:.4}50%{opacity:1}}
</style></head><body><div class="card">
  <h1><span class="dot"></span>FLOODGUARD RESCUE OS 2.0</h1>
  <p>Waiting for <strong>FloodGuard USB Pendrive</strong> (<code>Rescue Users/</code>)...<br>Plug in the pendrive to auto-launch Qwen 2.5 GGUF &amp; Live Telemetry.</p>
</div></body></html>
EOF

echo "🔍 [FloodGuard OS] Scanning for FloodGuard USB Pendrive..."
APP_DIR="$(find_pendrive_app || true)"

if [ -z "$APP_DIR" ]; then
  echo "⏳ [FloodGuard OS] Pendrive not detected yet — waiting for USB insertion..."
  # Show waiting notice briefly on console and poll until USB pendrive arrives
  while [ -z "$APP_DIR" ]; do
    try_mount_usb_partitions
    APP_DIR="$(find_pendrive_app || true)"
    [ -n "$APP_DIR" ] && break
    sleep 1
  done
fi

echo "✅ [FloodGuard OS] Detected App on Pendrive: $APP_DIR"
cd "$APP_DIR"

# Start Hardware Bridge + Qwen 2.5 GGUF + GNSS/LoRa immediately in background
chmod 666 /dev/ttyUSB* /dev/ttyACM* /dev/serial* /dev/ttyAMA* 2>/dev/null || true
nohup python3 "$APP_DIR/pi_hardware_bridge.py" >/tmp/floodguard_bridge.log 2>&1 &

# Launch fullscreen kiosk via Labwc (Pi 5 GPU Wayland), Cage, or X11 Openbox fallback
if command -v labwc >/dev/null 2>&1; then
  export GDK_BACKEND=wayland
  exec labwc -s "python3 '$APP_DIR/run_rescue_app.py' --foreground --kiosk"
elif command -v cage >/dev/null 2>&1; then
  export GDK_BACKEND=wayland
  export WLR_NO_HARDWARE_CURSORS=1
  exec cage -s -- python3 "$APP_DIR/run_rescue_app.py" --foreground --kiosk
else
  cat > "$HOME/.xinitrc" << EOF
xset s off
xset -dpms
xset s noblank
xsetroot -solid "#050811"
openbox --config-file "$HOME/.config/openbox/rc.xml" &
exec python3 "$APP_DIR/run_rescue_app.py" --foreground --kiosk
EOF
  exec startx
fi
