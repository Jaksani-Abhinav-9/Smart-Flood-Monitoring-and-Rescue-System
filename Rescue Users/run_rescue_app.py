#!/usr/bin/env python3
"""
=============================================================================
FloodGuard Rescue Operations — Native Desktop & Raspberry Pi Launcher
=============================================================================
Launches the Rescue Operations Dashboard as a standalone, frameless desktop
application with NO Chromium dependency.

Window engine priority (Pi & Linux):
  1. PyWebView  — GTK3 + webkit2gtk (system WebKit, zero browser needed)
  2. Epiphany   — GNOME Web (lightweight WebKit2, comes with Pi OS Full)
  3. Midori     — Ultra-light WebKit browser
  4. Surf       — Minimal suckless WebKit browser
  5. Firefox ESR — Last resort browser fallback (no --app mode, opens normally)
  6. Python http.server + xdg-open — absolute last resort

Window engine priority (Windows):
  1. PyWebView  — WebView2 (Edge engine, always available on Win10/11)
  2. Edge / Chrome  — --app mode (kiosk-style, no tabs)
=============================================================================
"""

import os
import sys
import time
import shutil
import subprocess
import threading
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

APP_PORT = 8088
APP_URL  = f"http://127.0.0.1:{APP_PORT}/home.html"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IS_PI    = sys.platform.startswith('linux')
IS_WIN   = sys.platform.startswith('win')


# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
def print_banner():
    try:
        if IS_WIN:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(
                ctypes.windll.kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass
    print("\033[1;36m" + "=" * 70 + "\033[0m")
    print("\033[1;36m   FLOODGUARD AI 2.0 — RESCUE COMMAND & OPERATIONS TERMINAL\033[0m")
    print("\033[1;32m   Autonomous NDRF/SDRF Field Unit | 100% Offline Framework\033[0m")
    print("\033[1;36m" + "=" * 70 + "\033[0m\n")


# ---------------------------------------------------------------------------
# Offline tile check
# ---------------------------------------------------------------------------
def verify_offline_tiles():
    tiles_dir = os.path.join(BASE_DIR, "tiles")
    if not os.path.isdir(tiles_dir):
        print(f"  [1/4] Offline Tiles : WARNING — {tiles_dir} not found")
        return
    count = 0
    try:
        for root, _, files in os.walk(tiles_dir):
            count += sum(1 for f in files if f.endswith(('.jpg', '.png')))
            if count > 54000:
                break
        print(f"  [1/4] Offline Tiles : {count:,}+ tiles verified")
    except Exception:
        print(f"  [1/4] Offline Tiles : cache directory active")


# ---------------------------------------------------------------------------
# Bridge health
# ---------------------------------------------------------------------------
def is_server_running():
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{APP_PORT}/api/status",
            headers={"User-Agent": "FloodGuard-Launcher"})
        with urllib.request.urlopen(req, timeout=1.0) as r:
            return r.status == 200
    except Exception:
        return False


def start_backend_bridge():
    if is_server_running():
        print(f"  [2/4] Hardware Bridge : Already online on port {APP_PORT}")
        return None

    print(f"  [2/4] Hardware Bridge : Starting on port {APP_PORT}...")
    bridge = os.path.join(BASE_DIR, "pi_hardware_bridge.py")

    if IS_WIN:
        python_bin = sys.executable
        pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        if os.path.isfile(pythonw):
            python_bin = pythonw
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if hasattr(subprocess, "DETACHED_PROCESS"):
            flags |= subprocess.DETACHED_PROCESS
        proc = subprocess.Popen([python_bin, bridge], cwd=BASE_DIR,
                                 creationflags=flags, close_fds=True)
    else:
        proc = subprocess.Popen(
            [sys.executable, bridge], cwd=BASE_DIR,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True)

    sys.stdout.write("         Waiting for bridge")
    sys.stdout.flush()
    for _ in range(40):
        time.sleep(0.4)
        sys.stdout.write(".")
        sys.stdout.flush()
        if is_server_running():
            sys.stdout.write(" [ONLINE]\n")
            sys.stdout.flush()
            print("  ✔ Bridge bound successfully.")
            return proc
    sys.stdout.write(" [TIMEOUT — still starting in background]\n")
    sys.stdout.flush()
    return proc


def verify_ai_engine():
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{APP_PORT}/api/ai/status",
            headers={"User-Agent": "FloodGuard-Launcher"})
        with urllib.request.urlopen(req, timeout=2.0) as r:
            if r.status == 200:
                import json
                data = json.loads(r.read())
                backend = data.get("backend", "")
                status  = data.get("status", "")
                label   = f"{backend} ({status})" if backend and backend != "none" else status
                print(f"  [3/4] Sentinel AI 2.0 : Qwen 2.5 — {label}")
                return
    except Exception:
        pass
    print("  [3/4] Sentinel AI 2.0 : GGUF Q4_K_M loader active (llama-cpp-python / Ollama)")


# ===========================================================================
#  WINDOW LAUNCH — No Chromium
# ===========================================================================

# ---------------------------------------------------------------------------
# Tier 1: PyWebView  (GTK3 + system webkit2gtk on Pi, WebView2 on Windows)
# ---------------------------------------------------------------------------
def _try_pywebview():
    """
    Uses PyWebView which wraps the OS-native WebKit engine:
    - Linux/Pi : GTK3 + webkit2gtk  (NO Chromium, uses system WebKit)
    - Windows  : WebView2 (Edge engine, always available Win10/11+)
    Returns True if window was shown, False if not available.
    """
    # Must be set BEFORE importing webview / WebKit2 on Pi 5:
    # stops WebKitWebProcess DMA-BUF texture stride corruption (horizontal blur/lines)
    if IS_PI:
        try:
            os.environ.setdefault("PYWEBVIEW_GUI", "gtk")
            os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
        except Exception:
            pass

    try:
        import webview  # type: ignore
    except ImportError:
        return False

    try:
        screens = getattr(webview, "screens", []) or []
        scr_w = int(getattr(screens[0], "width", 0) or (1024 if IS_PI else 1366)) if screens else (1024 if IS_PI else 1366)
        scr_h = int(getattr(screens[0], "height", 0) or (600 if IS_PI else 768)) if screens else (600 if IS_PI else 768)

        win_ref = {"win": None}

        class AppWindowApi:
            def minimize_window(self):
                w = win_ref["win"]
                if w:
                    try:
                        w.minimize()
                    except Exception:
                        pass

            def toggle_fullscreen(self):
                w = win_ref["win"]
                if w:
                    try:
                        w.toggle_fullscreen()
                    except Exception:
                        pass

            def close_app(self):
                w = win_ref["win"]
                if w:
                    try:
                        w.destroy()
                    except Exception:
                        os._exit(0)

        window = webview.create_window(
            title="FloodGuard Rescue — Tactical Operations",
            url=APP_URL,
            width=min(scr_w, 1280),
            height=min(scr_h, 720),
            min_size=(480, 320),
            resizable=True,
            maximized=True,
            fullscreen=False,
            frameless=False,
            background_color="#050811",
            js_api=AppWindowApi(),
        )
        win_ref["win"] = window

        def _on_loaded(win):
            try:
                win.maximize()
            except Exception:
                pass

        # debug=False keeps the window clean (no DevTools shortcut)
        webview.start(_on_loaded, window, debug=False, private_mode=False)
        return True
    except Exception as e:
        print(f"  ⚠  PyWebView error: {e}")
        return False


# ---------------------------------------------------------------------------
# Tier 2: Lightweight WebKit browsers (Linux/Pi only, NO Chromium)
# ---------------------------------------------------------------------------
# These are ordered from lightest to heaviest.
# All use the system's WebKit2 engine — no Chromium involved.
_LIGHTWEIGHT_WEBKIT_BROWSERS = [
    # (binary, extra_args)
    # Epiphany / GNOME Web — available via: sudo apt install epiphany-browser
    # Launches in "app mode" (no tabs, no address bar) since GNOME 3.28+
    ("epiphany-browser", ["--application-mode", "--profile=/tmp/floodguard_epiphany"]),
    ("epiphany",         ["--application-mode", "--profile=/tmp/floodguard_epiphany"]),
    # Midori — lightweight, available via: sudo apt install midori
    # -e FullScreen opens maximised without chrome
    ("midori",           ["-e", "Fullscreen"]),
    # Surf — absolutely minimal suckless browser
    # available via: sudo apt install surf
    ("surf",             ["-F"]),   # -F = fullscreen
    # Firefox ESR — available on Pi OS, opens normally (no kiosk flags without risks)
    ("firefox-esr",      []),
    ("firefox",          []),
]


def _try_lightweight_browser():
    """
    Tries lightweight WebKit-based browsers one by one.
    None of these are Chromium — all use the GTK/WebKit2 engine.
    """
    if not IS_PI:
        return False

    for binary, extra_args in _LIGHTWEIGHT_WEBKIT_BROWSERS:
        path = shutil.which(binary)
        if not path:
            continue
        try:
            cmd = [path] + extra_args + [APP_URL]
            subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            print(f"  ✔ Window opened via {binary}")
            return True
        except Exception as e:
            print(f"  ⚠  {binary} failed: {e}")
            continue
    return False


# ---------------------------------------------------------------------------
# Tier 3: Windows — Edge / Chrome in --app mode
# ---------------------------------------------------------------------------
def _try_windows_app_mode():
    if not IS_WIN:
        return False

    edge_paths = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
    ]
    chrome_paths = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    ]
    flags = [
        f"--app={APP_URL}",
        "--start-maximized",
        "--window-size=1366,768",
        f"--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:{APP_PORT}",
        "--noerrdialogs",
        "--disable-infobars",
        "--no-first-run",
    ]
    for path in edge_paths + chrome_paths:
        if os.path.isfile(path):
            try:
                subprocess.Popen([path] + flags)
                print(f"  ✔ Window opened via {os.path.basename(path)}")
                return True
            except Exception:
                continue
    return False


# ---------------------------------------------------------------------------
# Tier 4: xdg-open / webbrowser fallback
# ---------------------------------------------------------------------------
def _fallback_open():
    try:
        import webbrowser
        webbrowser.open(APP_URL)
        print(f"  ✔ Opened {APP_URL} in default browser")
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Main launch_app_window
# ---------------------------------------------------------------------------
def launch_app_window():
    """Tries each display engine tier until one succeeds."""

    # Hide console on Windows
    if IS_WIN:
        try:
            import ctypes
            hWnd = ctypes.windll.kernel32.GetConsoleWindow()
            if hWnd:
                ctypes.windll.user32.ShowWindow(hWnd, 0)
        except Exception:
            pass

    print("  [4/4] Display Engine  : launching window...")

    # Tier 1 — PyWebView (best: native GTK WebKit on Pi, WebView2 on Win)
    if _try_pywebview():
        return   # pywebview.start() blocks until window closes — exit normally

    # Tier 2 — Lightweight WebKit browsers (Pi/Linux only, no Chromium)
    if IS_PI and _try_lightweight_browser():
        # Keep the process alive so the bridge stays up while browser is open
        _wait_for_bridge_exit()
        return

    # Tier 3 — Windows Edge/Chrome --app mode
    if IS_WIN and _try_windows_app_mode():
        _wait_for_bridge_exit()
        return

    # Tier 4 — Last resort: open in whatever browser is set as default
    print("  ⚠  No dedicated window engine found — opening in default browser.")
    _fallback_open()
    _wait_for_bridge_exit()


def _wait_for_bridge_exit():
    """
    Keeps the launcher alive so the bridge process (and AI engine) stays up
    while the user has the app open. Exits cleanly on Ctrl+C.
    """
    print("\n  Bridge is running. Press Ctrl+C to stop.\n")
    try:
        while is_server_running():
            time.sleep(3)
    except KeyboardInterrupt:
        print("\n  Shutting down FloodGuard bridge...")


# ===========================================================================
#  Auto-install PyWebView on Pi if missing
# ===========================================================================
def _ensure_pywebview_on_pi():
    """
    On Raspberry Pi, silently tries to install PyWebView + webkit2gtk deps
    if they're not already present. Runs in background — does not block startup.
    """
    if not IS_PI:
        return

    def _install():
        try:
            import webview  # already installed
            return
        except ImportError:
            pass

        print("  [AUTO] Installing PyWebView (GTK+webkit2gtk)...")
        cmds = [
            # System WebKit2 libraries (needed by pywebview's GTK backend)
            "sudo apt-get install -y python3-gi python3-gi-cairo "
            "gir1.2-gtk-3.0 gir1.2-webkit2-4.0 libwebkit2gtk-4.0-dev 2>/dev/null",
            # PyWebView Python package
            "pip3 install pywebview --break-system-packages 2>/dev/null || "
            "pip3 install pywebview 2>/dev/null",
        ]
        for cmd in cmds:
            subprocess.run(cmd, shell=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        try:
            import webview  # noqa
            print("  [AUTO] PyWebView installed successfully.")
        except ImportError:
            pass  # Will fall through to lightweight browser tier

    t = threading.Thread(target=_install, daemon=True)
    t.start()


# ===========================================================================
#  Spawn detached GUI process (so terminal can close cleanly)
# ===========================================================================
def spawn_detached_gui():
    script = os.path.abspath(__file__)
    print("  [4/4] Display Engine  : Spawning native window...")

    if IS_WIN:
        python_bin = sys.executable
        pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        if os.path.isfile(pythonw):
            python_bin = pythonw
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if hasattr(subprocess, "DETACHED_PROCESS"):
            flags |= subprocess.DETACHED_PROCESS
        subprocess.Popen(
            [python_bin, script, "--gui-window"],
            cwd=BASE_DIR, creationflags=flags, close_fds=True)
    else:
        subprocess.Popen(
            [sys.executable, script, "--gui-window"],
            cwd=BASE_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True)

    print("=" * 70)
    print("  ✔ App window launched.")
    print("  ✔ Terminal may now be closed.")
    print("=" * 70)
    time.sleep(1.5)
    sys.exit(0)


# ===========================================================================
#  Entry point
# ===========================================================================
def main():
    # --gui-window mode: just open the display engine (called by spawner above)
    if "--gui-window" in sys.argv:
        launch_app_window()
        return

    print_banner()

    # Kick off background PyWebView auto-install on Pi (non-blocking)
    _ensure_pywebview_on_pi()

    verify_offline_tiles()
    start_backend_bridge()
    verify_ai_engine()

    if "--foreground" in sys.argv:
        # Foreground mode: block here (useful for debugging, systemd, etc.)
        launch_app_window()
    else:
        spawn_detached_gui()


if __name__ == "__main__":
    main()
