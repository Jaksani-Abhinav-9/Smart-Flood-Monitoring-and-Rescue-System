#!/bin/bash
# =============================================================================
# FloodGuard Rescue OS 2.0 — Dedicated Pi 5 Appliance Builder
# =============================================================================
# Turns Raspberry Pi OS Lite (64-bit) — or an existing Pi OS SD card — into
# a minimal custom OS where NOTHING else loads: ONLY FloodGuard App + Terminal.
#
# Keeps `vs/Rescue Users` strictly SEPARATE on your USB pendrive:
#   • SD Card / OS Drive  : Minimal OS + Display Stack + USB Pendrive Auto-Detect
#   • USB Pendrive        : vs/Rescue Users/ (App + Tiles + Qwen GGUF + Runtime)
#
# Usage on Raspberry Pi:
#   sudo bash setup_floodguard_os.sh
# =============================================================================

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash setup_floodguard_os.sh"
  exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
RESCUE_DIR="$( dirname "$SCRIPT_DIR" )"
TARGET_USER="${SUDO_USER:-pi}"
TARGET_HOME="$(eval echo "~$TARGET_USER")"

echo "======================================================================"
echo "  Building FloodGuard Rescue OS 2.0 (Target user: $TARGET_USER)"
echo "======================================================================"

# 1. Install minimal single-app display stack + useful field hardware tools
echo "[1/7] Installing Kiosk Display, WebKit2, USB & Field Diagnostics..."
apt-get update -qq
apt-get install -y --no-install-recommends \
  labwc xserver-xorg x11-xserver-utils xinit openbox \
  lxterminal xterm python3-webview python3-gi python3-gi-cairo gir1.2-webkit2-4.1 \
  python3-pip python3-serial python3-jinja2 python3-markupsafe python3-numpy \
  plymouth plymouth-themes fbi \
  exfatprogs ntfs-3g udisks2 util-linux \
  gpsd gpsd-clients minicom screen usbutils network-manager htop nano curl git \
  squeekboard onboard || true

# 2. Brand hostname & custom terminal MOTD
echo "[2/7] Branding OS identity (floodguard-rescue)..."
hostnamectl set-hostname floodguard-rescue 2>/dev/null || echo "floodguard-rescue" > /etc/hostname
sed -i 's/127\.0\.1\.1.*/127.0.1.1\tfloodguard-rescue/' /etc/hosts || true

cat > /etc/motd << 'EOF'
======================================================================
   FLOODGUARD RESCUE OS 2.0  |  NDRF / SDRF Autonomous Field Unit
   App Engine : PyWebView + Qwen 2.5 GGUF Q4_K_M + 3km GIS Focus
   Tools      : htop | cgps (GNSS) | minicom (LoRa) | nmtui (WiFi)
   Switch UI  : Top-left button  or  Ctrl+Alt+F1 (App) / F2 (TTY)
======================================================================
EOF

# 3. Grant hardware serial & input permissions
echo "[3/7] Configuring GNSS/LoRa serial & video permissions..."
usermod -a -G dialout,tty,video,audio,plugdev,netdev "$TARGET_USER" 2>/dev/null || true
[ -d /opt/floodguard ] && chown -R "$TARGET_USER:$TARGET_USER" /opt/floodguard || true

# 4. Bookworm-safe USB Pendrive Auto-Mount (unique per-partition mount avoids OS USB conflict)
echo "[4/7] Installing USB Pendrive auto-mount rules..."
mkdir -p /mnt/floodguard_usb
chown "$TARGET_USER:$TARGET_USER" /mnt/floodguard_usb

cat > /etc/udev/rules.d/99-floodguard-usb.rules << 'EOF'
# Automount USB pendrives cleanly via systemd-mount (supports USB-booted Pi 5 + data pendrive)
ACTION=="add", SUBSYSTEM=="block", ENV{ID_BUS}=="usb", ENV{ID_FS_TYPE}=="exfat|vfat|ntfs", RUN+="/usr/bin/systemd-mount --no-block --automount=yes --options=defaults,uid=1000,gid=1000 $devnode /mnt/fg_%k"
ACTION=="add", SUBSYSTEM=="block", ENV{ID_BUS}=="usb", ENV{ID_FS_TYPE}=="ext4", RUN+="/usr/bin/systemd-mount --no-block --automount=yes --options=defaults $devnode /mnt/fg_%k"
ACTION=="remove", SUBSYSTEM=="block", ENV{ID_BUS}=="usb", RUN+="/usr/bin/systemd-mount --umount $devnode"
EOF

udevadm control --reload-rules || true

# 5. Custom FloodGuard Plymouth Boot Splash + Quiet Boot (/boot/firmware on Bookworm)
echo "[5/7] Configuring custom FloodGuard silent boot splash..."
EMBLEM_SRC="$RESCUE_DIR/assets/Flood Rescue Monitoring Emblem.png"
THEME_DIR="/usr/share/plymouth/themes/floodguard"
mkdir -p "$THEME_DIR"
if [ -f "$EMBLEM_SRC" ]; then
  cp "$EMBLEM_SRC" "$THEME_DIR/emblem.png"
fi

cat > "$THEME_DIR/floodguard.plymouth" << 'EOF'
[Plymouth Theme]
Name=FloodGuard Rescue OS
Description=Custom FloodGuard Boot Splash
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/floodguard
ScriptFile=/usr/share/plymouth/themes/floodguard/floodguard.script
EOF

cat > "$THEME_DIR/floodguard.script" << 'EOF'
Window.SetBackgroundTopColor(0.02, 0.03, 0.07);
Window.SetBackgroundBottomColor(0.02, 0.03, 0.07);
emblem = Image("emblem.png");
if (emblem) {
  resized = emblem.Scale(220, 220);
  sprite = Sprite(resized);
  sprite.SetX(Window.GetWidth() / 2 - resized.GetWidth() / 2);
  sprite.SetY(Window.GetHeight() / 2 - resized.GetHeight() / 2 - 20);
}
EOF

plymouth-set-default-theme -R floodguard 2>/dev/null || true

CMDLINE_FILE="/boot/firmware/cmdline.txt"
[ -f "$CMDLINE_FILE" ] || CMDLINE_FILE="/boot/cmdline.txt"
if [ -f "$CMDLINE_FILE" ]; then
  cp "$CMDLINE_FILE" "${CMDLINE_FILE}.bak"
  sed -i 's/console=tty1/console=tty3/g' "$CMDLINE_FILE"
  for flag in quiet splash plymouth.ignore-serial-consoles logo.nologo vt.global_cursor_default=0; do
    grep -q "$flag" "$CMDLINE_FILE" || sed -i "s/$/ $flag/" "$CMDLINE_FILE"
  done
fi

CONFIG_FILE="/boot/firmware/config.txt"
[ -f "$CONFIG_FILE" ] || CONFIG_FILE="/boot/config.txt"
if [ -f "$CONFIG_FILE" ]; then
  grep -q "^disable_splash=1" "$CONFIG_FILE" || echo "disable_splash=1" >> "$CONFIG_FILE"
fi

# 6. Install OS Boot Launcher & Openbox Fallback Config
echo "[6/7] Installing /usr/local/bin/floodguard-boot.sh & Terminal hotkeys..."
cp "$SCRIPT_DIR/floodguard-boot.sh" /usr/local/bin/floodguard-boot.sh
chmod +x /usr/local/bin/floodguard-boot.sh

mkdir -p "$TARGET_HOME/.config/openbox"
cat > "$TARGET_HOME/.config/openbox/rc.xml" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <keyboard>
    <keybind key="C-A-t"><action name="Execute"><command>lxterminal</command></action></keybind>
    <keybind key="F12"><action name="Execute"><command>lxterminal</command></action></keybind>
  </keyboard>
  <applications>
    <application class="*"><decor>no</decor><maximized>yes</maximized></application>
  </applications>
</openbox_config>
EOF
chown -R "$TARGET_USER:$TARGET_USER" "$TARGET_HOME/.config"

# 7. Configure Console Autologin on tty1 (bypasses Desktop OS completely)
echo "[7/7] Configuring direct console autologin -> FloodGuard Kiosk..."
systemctl set-default multi-user.target
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $TARGET_USER --noclear %I \$TERM
EOF

# Disable unnecessary services if present
systemctl disable cups.service bluetooth.service triggerhappy.service 2>/dev/null || true

# Wire tty1 login to launch FloodGuard directly
BASH_PROFILE="$TARGET_HOME/.bash_profile"
touch "$BASH_PROFILE"
if ! grep -q "floodguard-boot.sh" "$BASH_PROFILE"; then
  cat >> "$BASH_PROFILE" << 'EOF'

# Auto-launch FloodGuard Rescue OS on tty1 (no desktop OS)
if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec /usr/local/bin/floodguard-boot.sh
fi
EOF
fi
chown "$TARGET_USER:$TARGET_USER" "$BASH_PROFILE"

echo "======================================================================"
echo "  ✅ FloodGuard Rescue OS 2.0 Ready!"
echo "  • Reboot Pi with your vs/Rescue Users USB pendrive plugged in."
echo "  • OS boots directly to FloodGuard splash -> App (no desktop UI)."
echo "  • Press top-left >_ button, Ctrl+Alt+T, F12, or Ctrl+Alt+F2 for Terminal."
echo "======================================================================"
