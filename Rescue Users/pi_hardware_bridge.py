#!/usr/bin/env python3
"""
=============================================================================
FloodGuard AI 2.0 — Raspberry Pi 5 Hardware Telemetry Bridge
=============================================================================
Interfaces directly with:
1. GNSS / GPS Module (USB / UART /dev/ttyUSB0 or /dev/serial0) via NMEA sentences ($GPRMC, $GPGGA)
2. LoRa Transceiver Module (USB / UART /dev/ttyACM0 or /dev/ttyUSB1) receiving field sensor pole packets
3. Local HTTP & Server-Sent Events (SSE) server for web frontend (home.html, lora-data.html)

No external heavy dependencies required: runs on standard Python 3.
(Optional: 'pyserial' for real hardware; auto-engages high-fidelity simulation if no serial port is detected)
=============================================================================
"""

import sys
import os
import json
import time
import glob
import mimetypes
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import threading
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Default operational port for the bridge
BRIDGE_PORT = 8088

# Import AI 2.0 Telemetry Interface
AI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ai 2.0")
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

try:
    from ai_telemetry_interface import ai_interface, qwen_manager  # type: ignore
    from tactical_route_planner import tactical_planner  # type: ignore
except Exception as e:
    ai_interface = None
    qwen_manager = None
    tactical_planner = None
    print(f"⚠️ [AI 2.0] Could not import ai_interface/tactical_planner: {e}")

# Start background warm-up of Qwen model if available
if qwen_manager:
    try:
        qwen_manager.start_background_loading()
    except Exception as _err:
        pass

# Shared Thread-Safe State
TELEMETRY_STATE = {
    "system": {
        "device": "Raspberry Pi 5 (NDRF Field Unit)",
        "mode": "INITIALIZING",
        "timestamp": time.time(),
        "gps_hardware_connected": False,
        "lora_hardware_connected": False
    },
    "gps": {
        "lat": None,
        "lng": None,
        "speed_kmh": 0.0,
        "heading_deg": 0.0,
        "altitude_m": None,
        "satellites": 0,
        "fix_quality": "NOT_CONNECTED",
        "last_update": None,
        "source": "NOT_CONNECTED"
    },
    "lora_poles": {}
}

STATE_LOCK = threading.Lock()
ACTIVE_SSE_CLIENTS = []
CLIENTS_LOCK = threading.Lock()

def ensure_linux_serial_permissions():
    """Auto-grants read/write permissions to serial and USB devices on Linux/Raspberry Pi."""
    if sys.platform.startswith('linux'):
        try:
            import subprocess
            subprocess.run("sudo chmod 666 /dev/ttyUSB* /dev/ttyACM* /dev/serial* /dev/ttyAMA* 2>/dev/null", shell=True)
        except Exception:
            pass

# ---------------------------------------------------------------------------
# NMEA GPS Parser
# ---------------------------------------------------------------------------
def parse_nmea_coordinate(raw_val, direction):
    """Converts NMEA ddmm.mmmm to decimal degrees"""
    if not raw_val or not direction:
        return None
    try:
        dot_idx = raw_val.find('.')
        if dot_idx < 2:
            return None
        deg_len = dot_idx - 2
        deg = float(raw_val[:deg_len])
        minutes = float(raw_val[deg_len:])
        decimal = deg + (minutes / 60.0)
        if direction in ['S', 'W']:
            decimal = -decimal
        return round(decimal, 6)
    except Exception:
        return None

def parse_nmea_sentence(line):
    """Extracts position, speed, heading from $GPRMC and $GPGGA sentences"""
    try:
        line = line.strip()
        if not line.startswith('$'):
            return None
        parts = line.split('*')[0].split(',')
        tag = parts[0][-3:]

        result = {}
        if tag == "RMC" and len(parts) >= 9:
            # $GPRMC,time,status,lat,NS,lon,EW,speed_knots,heading_deg,date,...
            status = parts[2]
            if status == 'A': # Valid fix
                lat = parse_nmea_coordinate(parts[3], parts[4])
                lng = parse_nmea_coordinate(parts[5], parts[6])
                speed_knots = float(parts[7]) if parts[7] else 0.0
                speed_kmh = round(speed_knots * 1.852, 1)
                heading = float(parts[8]) if parts[8] else 0.0
                if lat and lng:
                    result['lat'] = lat
                    result['lng'] = lng
                    result['speed_kmh'] = speed_kmh
                    result['heading_deg'] = round(heading, 1)
                    result['fix_quality'] = "2D/3D_GNSS"
                    return result
        elif tag == "GGA" and len(parts) >= 10:
            # $GPGGA,time,lat,NS,lon,EW,quality,num_sats,hdop,alt,alt_unit,...
            fix_q = int(parts[6]) if parts[6] else 0
            if fix_q > 0:
                lat = parse_nmea_coordinate(parts[2], parts[3])
                lng = parse_nmea_coordinate(parts[4], parts[5])
                num_sats = int(parts[7]) if parts[7] else 0
                altitude = float(parts[9]) if parts[9] else 0.0
                if lat and lng:
                    result['lat'] = lat
                    result['lng'] = lng
                    result['satellites'] = num_sats
                    result['altitude_m'] = round(altitude, 1)
                    result['fix_quality'] = "3D_DGPS_FIX" if fix_q >= 2 else "STANDARD_GNSS"
                    return result
    except Exception:
        pass
    return None

# ---------------------------------------------------------------------------
# LoRa Packet Parser
# ---------------------------------------------------------------------------
def _safe_float(val, default=None):
    """Safely converts sensor strings (handles 'NA', 'NAN', empty, None)."""
    if val is None:
        return default
    s = str(val).strip()
    if not s or s.upper() in ("NA", "NAN", "NONE", "NULL", "--"):
        return default
    try:
        return float(s)
    except Exception:
        return default


def _map_flood_status(flood_level_str, wl, rr):
    fl = (flood_level_str or "").strip().upper()
    if fl in ("CRITICAL", "CRITICAL_SURGE", "HIGH_ALERT"):
        return "CRITICAL_SURGE"
    if fl in ("WARNING", "SURGE_WARNING"):
        return "SURGE_WARNING"
    if fl in ("NORMAL", "NORMAL_FLOW"):
        return "NORMAL_FLOW"
    if wl >= 4.0 or rr >= 0.8:
        return "CRITICAL_SURGE"
    if wl >= 2.5 or rr >= 0.4:
        return "SURGE_WARNING"
    return "NORMAL_FLOW"


def parse_lora_packet(raw_str):
    """
    Parses LoRa packets transmitted by sensor poles (including main.ino key-value
    packets and Receiver Arduino JSON lines).
    """
    try:
        raw_str = raw_str.strip()
        if not raw_str:
            return None

        rssi = None
        snr = None

        # 1. Reyax AT wrapper: +RCV=addr,len,payload,rssi,snr
        if raw_str.startswith('+RCV=') or raw_str.startswith('+RECV='):
            prefix_parts = raw_str.split(',')
            if len(prefix_parts) >= 5:
                try:
                    rssi = int(prefix_parts[-2])
                    snr = int(prefix_parts[-1])
                except Exception:
                    pass
                raw_str = ",".join(prefix_parts[2:-2]).strip()
            elif len(prefix_parts) >= 4:
                raw_str = ",".join(prefix_parts[2:-1]).strip()

        res = None

        # 2. JSON Format (Receiver Arduino standard output)
        if '{' in raw_str and '}' in raw_str:
            s_idx = raw_str.find('{')
            e_idx = raw_str.rfind('}') + 1
            data = json.loads(raw_str[s_idx:e_idx])
            node_id = str(data.get("id") or data.get("node") or data.get("node_id") or data.get("pole") or "")
            if node_id:
                dist_cm = _safe_float(data.get("dist_cm", data.get("dist")), None)
                wl = _safe_float(data.get("water", data.get("water_level")), None)
                if wl is None:
                    wl = round(max(0.0, (45.0 - dist_cm) / 30.0), 2) if dist_cm is not None else 0.0
                res = {
                    "id": node_id,
                    "water_level": wl,
                    "hourly_rise_rate": _safe_float(data.get("rate", data.get("hourly_rise_rate", data.get("rise"))), 0.0),
                    "temp_c": _safe_float(data.get("temp", data.get("temp_c", data.get("temperature"))), 25.0),
                    "battery_v": _safe_float(data.get("batt", data.get("battery_v", data.get("battery"))), 4.0),
                }
                lat = _safe_float(data.get("lat"), None)
                lng = _safe_float(data.get("lng", data.get("lon")), None)
                if lat is not None and lng is not None and (lat != 0.0 or lng != 0.0):
                    res["lat"] = lat
                    res["lng"] = lng
                if dist_cm is not None:
                    res["dist_cm"] = dist_cm
                if "hum" in data or "humidity" in data:
                    hum = _safe_float(data.get("hum", data.get("humidity")), None)
                    if hum is not None:
                        res["humidity"] = hum
                if "rain" in data:
                    res["rain"] = data["rain"]
                if "rain_detected" in data:
                    res["rain_detected"] = data["rain_detected"]
                if "wind" in data:
                    res["wind"] = data["wind"]
                if "flood_level" in data:
                    res["flood_level"] = data["flood_level"]
                if "status" in data:
                    res["status"] = data["status"]
                if rssi is None and "rssi" in data:
                    rssi = data["rssi"]
                if snr is None and "snr" in data:
                    snr = data["snr"]

        # 3. Key-Value Format: e.g. main.ino "ID=FLOOD_POLE_01,TEMP=28.4,HUM=65.2,RAIN=850,...,DIST=18.5,FLOOD_LEVEL=HIGH_ALERT,LAT=...,LON=..."
        elif (':' in raw_str or '=' in raw_str) and any(k in raw_str.upper() for k in ['NODE', 'WATER', 'RATE', 'ID', 'BATT', 'DIST', 'FLOOD_LEVEL']):
            delim = ';' if ';' in raw_str else ','
            pairs = raw_str.split(delim)
            kv = {}
            for p in pairs:
                if ':' in p:
                    k, v = p.split(':', 1)
                    kv[k.strip().upper()] = v.strip()
                elif '=' in p:
                    k, v = p.split('=', 1)
                    kv[k.strip().upper()] = v.strip()
            node_id = kv.get('ID') or kv.get('NODE') or kv.get('NODE_ID') or kv.get('POLE')
            if node_id:
                dist_cm = _safe_float(kv.get('DIST', kv.get('DIST_CM')), None)
                wl = _safe_float(kv.get('WATER', kv.get('W', kv.get('LEVEL'))), None)
                if wl is None:
                    wl = round(max(0.0, (45.0 - dist_cm) / 30.0), 2) if dist_cm is not None else 0.0
                res = {
                    "id": node_id,
                    "water_level": wl,
                    "hourly_rise_rate": _safe_float(kv.get('RATE', kv.get('R', kv.get('RISE'))), 0.0),
                    "temp_c": _safe_float(kv.get('TEMP', kv.get('T')), 25.0),
                    "battery_v": _safe_float(kv.get('BATT', kv.get('B')), 4.0)
                }
                lat = _safe_float(kv.get('LAT'), None)
                lng = _safe_float(kv.get('LNG', kv.get('LON')), None)
                if lat is not None and lng is not None and (lat != 0.0 or lng != 0.0):
                    res['lat'] = lat
                    res['lng'] = lng
                if dist_cm is not None:
                    res['dist_cm'] = dist_cm
                hum = _safe_float(kv.get('HUM', kv.get('HUMIDITY')), None)
                if hum is not None:
                    res['humidity'] = hum
                if 'RAIN' in kv:
                    res['rain'] = kv['RAIN']
                if 'RAIN_DETECTED' in kv:
                    res['rain_detected'] = kv['RAIN_DETECTED']
                if 'WIND' in kv:
                    res['wind'] = kv['WIND']
                if 'FLOOD_LEVEL' in kv:
                    res['flood_level'] = kv['FLOOD_LEVEL']

        # 4. CSV Format: NODE_ID,WATER,RATE,TEMP,BATT[,LAT,LNG]
        elif ',' in raw_str:
            tokens = [t.strip() for t in raw_str.split(',')]
            if len(tokens) >= 2:
                node_id = tokens[0]
                water = float(tokens[1])
                rate = float(tokens[2]) if len(tokens) > 2 else 0.0
                temp = float(tokens[3]) if len(tokens) > 3 else 25.0
                batt = float(tokens[4]) if len(tokens) > 4 else 4.0
                res = {
                    "id": node_id,
                    "water_level": water,
                    "hourly_rise_rate": rate,
                    "temp_c": temp,
                    "battery_v": batt
                }
                if len(tokens) >= 7:
                    try:
                        res["lat"] = float(tokens[5])
                        res["lng"] = float(tokens[6])
                    except Exception:
                        pass

        if res and "water_level" in res:
            wl = float(res.get("water_level", 0.0))
            rr = float(res.get("hourly_rise_rate", 0.0))
            if "status" not in res:
                res["status"] = _map_flood_status(res.get("flood_level"), wl, rr)
            if rssi is not None:
                res["rssi"] = rssi
            if snr is not None:
                res["snr"] = snr

            return res

    except Exception:
        pass
    return None

# ---------------------------------------------------------------------------
# Hardware Serial Monitor Thread (with Hot-Plug Reconnection & Multi-Baud)
# ---------------------------------------------------------------------------
def hardware_listener_thread():
    """Continuously monitors and auto-reconnects to real GNSS and LoRa serial devices"""
    pyserial_available = False
    list_ports_func = None
    try:
        import serial  # type: ignore
        import serial.tools.list_ports  # type: ignore
        pyserial_available = True
        list_ports_func = serial.tools.list_ports.comports
    except ImportError:
        pass

    active_serials = {}  # Map of port_name -> serial.Serial object
    last_scan_time = 0

    while True:
        now = time.time()

        # Scan for devices every 3 seconds if fewer than 2 devices are connected
        if pyserial_available and len(active_serials) < 4 and (now - last_scan_time > 3.0):
            last_scan_time = now
            ensure_linux_serial_permissions()
            candidate_ports = []

            if list_ports_func:
                try:
                    for p in list_ports_func():
                        candidate_ports.append(p.device)
                except Exception:
                    pass
            else:
                if sys.platform.startswith('linux'):
                    candidate_ports = (glob.glob('/dev/ttyUSB*') +
                                       glob.glob('/dev/ttyACM*') +
                                       glob.glob('/dev/serial*') +
                                       glob.glob('/dev/ttyAMA*'))
                elif sys.platform.startswith('win'):
                    candidate_ports = [f"COM{i}" for i in range(1, 25)]

            for port in candidate_ports:
                if port in active_serials:
                    continue

                for baud in [9600, 115200, 57600, 38400, 4800]:
                    try:
                        s = serial.Serial(port, baudrate=baud, timeout=0.6)
                        # Wait ~1.9s at 9600 so Arduino Uno/Mega finishes DTR auto-reset & prints boot banner
                        time.sleep(1.9 if baud == 9600 else 0.25)
                        sample = s.read(512).decode('utf-8', errors='ignore')

                        # Detect valid telemetry: GPS NMEA or LoRa signatures
                        has_gps = any(sig in sample for sig in ['$GP', '$GN', '$GL', '$BD', '$GA'])
                        has_lora = any(k in sample for k in [
                            'FLOODGUARD', 'LORA READY', 'FLOOD_POLE', 'FLOOD_LEVEL', 'DIST=',
                            'Node', 'node', 'water', '+RCV', '+RECV', '{', 'NODE', 'BATT', 'RATE'
                        ])

                        if not has_lora:
                            # Probe AT command for Reyax/Ai-Thinker LoRa
                            try:
                                s.write(b"AT\r\n")
                                time.sleep(0.08)
                                at_resp = s.read(128).decode('utf-8', errors='ignore')
                                if "+OK" in at_resp or "OK" in at_resp:
                                    has_lora = True
                            except Exception:
                                pass

                        # If signature detected or active data flowing
                        if has_gps or has_lora or len(sample.strip()) > 5:
                            active_serials[port] = s
                            print(f"🔌 [HARDWARE] Connected serial device on {port} ({baud} baud) [GPS: {has_gps}, LoRa: {has_lora}]")
                            if has_gps:
                                with STATE_LOCK:
                                    TELEMETRY_STATE["system"]["gps_hardware_connected"] = True
                                    TELEMETRY_STATE["gps"]["source"] = f"HARDWARE ({port}@{baud})"
                            if has_lora:
                                with STATE_LOCK:
                                    TELEMETRY_STATE["system"]["lora_hardware_connected"] = True
                            broadcast_sse("status", TELEMETRY_STATE["system"])
                            break
                        else:
                            s.close()
                    except Exception:
                        continue

        had_hardware_event = False

        # Read all active serial devices (supports single combined Arduino or separate USB ports)
        dead_ports = []
        for port, s in list(active_serials.items()):
            try:
                while s.in_waiting > 0:
                    raw_line = s.readline()
                    if not raw_line:
                        break
                    line = raw_line.decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue

                    # 1. Parse GPS NMEA sentences ($GPRMC, $GPGGA, $GNGGA, etc.)
                    if line.startswith('$'):
                        parsed_gps = parse_nmea_sentence(line)
                        if parsed_gps:
                            with STATE_LOCK:
                                TELEMETRY_STATE["gps"].update(parsed_gps)
                                TELEMETRY_STATE["gps"]["source"] = f"HARDWARE ({port})"
                                TELEMETRY_STATE["gps"]["last_update"] = time.time()
                                TELEMETRY_STATE["system"]["gps_hardware_connected"] = True
                            broadcast_sse("gps", TELEMETRY_STATE["gps"])
                            broadcast_sse("status", TELEMETRY_STATE["system"])
                            had_hardware_event = True
                            continue

                    # 2. Parse LoRa Field Sensor Pole packets
                    parsed_lora = parse_lora_packet(line)
                    if parsed_lora and parsed_lora.get("id"):
                        nid = parsed_lora["id"]
                        with STATE_LOCK:
                            if nid not in TELEMETRY_STATE["lora_poles"]:
                                TELEMETRY_STATE["lora_poles"][nid] = {
                                    "id": nid,
                                    "name": f"Sensor Pole {nid}",
                                    "lat": parsed_lora.get("lat"),
                                    "lng": parsed_lora.get("lng")
                                }
                            TELEMETRY_STATE["lora_poles"][nid]["water_level"] = parsed_lora["water_level"]
                            TELEMETRY_STATE["lora_poles"][nid]["hourly_rise_rate"] = parsed_lora["hourly_rise_rate"]
                            TELEMETRY_STATE["lora_poles"][nid]["temp_c"] = parsed_lora["temp_c"]
                            TELEMETRY_STATE["lora_poles"][nid]["battery_v"] = parsed_lora["battery_v"]
                            for extra_k in ("dist_cm", "humidity", "rain", "rain_detected", "wind", "flood_level"):
                                if extra_k in parsed_lora:
                                    TELEMETRY_STATE["lora_poles"][nid][extra_k] = parsed_lora[extra_k]
                            if parsed_lora.get("lat") and parsed_lora.get("lng"):
                                TELEMETRY_STATE["lora_poles"][nid]["lat"] = parsed_lora["lat"]
                                TELEMETRY_STATE["lora_poles"][nid]["lng"] = parsed_lora["lng"]
                            TELEMETRY_STATE["lora_poles"][nid]["status"] = parsed_lora.get("status", "ACTIVE_TRANSMISSION")
                            if "rssi" in parsed_lora:
                                TELEMETRY_STATE["lora_poles"][nid]["rssi"] = parsed_lora["rssi"]
                            if "snr" in parsed_lora:
                                TELEMETRY_STATE["lora_poles"][nid]["snr"] = parsed_lora["snr"]
                            TELEMETRY_STATE["lora_poles"][nid]["last_packet"] = time.time()
                            TELEMETRY_STATE["lora_poles"][nid]["source"] = "HARDWARE_RADIO"
                            TELEMETRY_STATE["system"]["lora_hardware_connected"] = True
                        broadcast_sse("lora", TELEMETRY_STATE["lora_poles"][nid])
                        broadcast_sse("status", TELEMETRY_STATE["system"])
                        had_hardware_event = True

            except Exception as e:
                print(f"⚠️ [HARDWARE] Serial port {port} disconnected: {e}")
                dead_ports.append(port)

        for dp in dead_ports:
            try:
                active_serials[dp].close()
            except Exception:
                pass
            active_serials.pop(dp, None)
            with STATE_LOCK:
                if len(active_serials) == 0:
                    TELEMETRY_STATE["system"]["gps_hardware_connected"] = False
                    TELEMETRY_STATE["system"]["lora_hardware_connected"] = False
            broadcast_sse("status", TELEMETRY_STATE["system"])

        if not had_hardware_event:
            time.sleep(0.04)

# ---------------------------------------------------------------------------
# Background Maintenance Engine (Zero Fake Data & GPS Staleness Watchdog)
# ---------------------------------------------------------------------------
def simulation_worker_thread():
    """Watchdog for location staleness. If browser location stops updating (permission turned off/tab closed), reset to Not Connected."""
    while True:
        time.sleep(2.0)
        now = time.time()
        need_broadcast = False
        snapshot = None
        with STATE_LOCK:
            is_hw = TELEMETRY_STATE["system"].get("gps_hardware_connected", False)
            if not is_hw and TELEMETRY_STATE["gps"]["lat"] is not None:
                last_up = TELEMETRY_STATE["gps"].get("last_update")
                if last_up is None or (now - last_up > 8.0):
                    TELEMETRY_STATE["gps"]["lat"] = None
                    TELEMETRY_STATE["gps"]["lng"] = None
                    TELEMETRY_STATE["gps"]["speed_kmh"] = 0.0
                    TELEMETRY_STATE["gps"]["heading_deg"] = 0.0
                    TELEMETRY_STATE["gps"]["altitude_m"] = None
                    TELEMETRY_STATE["gps"]["satellites"] = 0
                    TELEMETRY_STATE["gps"]["fix_quality"] = "NOT_CONNECTED"
                    TELEMETRY_STATE["gps"]["source"] = "NOT_CONNECTED"
                    TELEMETRY_STATE["gps"]["accuracy"] = None
                    TELEMETRY_STATE["gps"]["last_update"] = None
                    need_broadcast = True
                    snapshot = dict(TELEMETRY_STATE["gps"])
        if need_broadcast and snapshot:
            broadcast_sse("gps", snapshot)

# ---------------------------------------------------------------------------
# Server-Sent Events (SSE) Dispatcher
# ---------------------------------------------------------------------------
def broadcast_sse(event_type, payload):
    """Pushes live JSON payload to all connected browser windows"""
    msg = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n".encode('utf-8')
    with CLIENTS_LOCK:
        dead_clients = []
        for client in ACTIVE_SSE_CLIENTS:
            try:
                client.wfile.write(msg)
                client.wfile.flush()
            except Exception:
                dead_clients.append(client)
                client.is_connected = False
        for dead in dead_clients:
            if dead in ACTIVE_SSE_CLIENTS:
                ACTIVE_SSE_CLIENTS.remove(dead)

# ---------------------------------------------------------------------------
# HTTP API Request Handler
# ---------------------------------------------------------------------------
class HardwareBridgeHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local web applications
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        url_path = self.path.split('?')[0]

        if url_path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            with STATE_LOCK:
                resp = json.dumps(TELEMETRY_STATE["system"]).encode('utf-8')
            self.wfile.write(resp)

        elif url_path == '/api/ai/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if qwen_manager and hasattr(qwen_manager, "get_model_metadata"):
                meta = qwen_manager.get_model_metadata()
            else:
                meta = {
                    "status": "offline",
                    "ready": False,
                    "model": "Qwen 2.5 1.5B (Custom GGUF Q4_K_M)",
                    "backend": "none",
                    "error": None
                }
            self.wfile.write(json.dumps(meta).encode('utf-8'))

        elif url_path == '/api/gps':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            with STATE_LOCK:
                resp = json.dumps(TELEMETRY_STATE["gps"]).encode('utf-8')
            self.wfile.write(resp)

        elif url_path in ['/api/lora', '/api/lora/poles']:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            with STATE_LOCK:
                resp = json.dumps(TELEMETRY_STATE["lora_poles"]).encode('utf-8')
            self.wfile.write(resp)

        elif url_path == '/api/telemetry':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            with STATE_LOCK:
                resp = json.dumps(TELEMETRY_STATE).encode('utf-8')
            self.wfile.write(resp)

        elif url_path == '/api/ai/context':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if ai_interface:
                with STATE_LOCK:
                    payload = ai_interface.build_qwen_analysis_payload(TELEMETRY_STATE["gps"], TELEMETRY_STATE["lora_poles"])
                self.wfile.write(json.dumps(payload).encode('utf-8'))
            else:
                self.wfile.write(b'{"error": "AI interface not initialized"}')

        elif url_path == '/api/stream':
            # Persistent Server-Sent Events (SSE) connection
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()

            self.is_connected = True

            # Send initial state snapshot immediately
            with STATE_LOCK:
                init_msg = f"event: init\ndata: {json.dumps(TELEMETRY_STATE)}\n\n".encode('utf-8')
            try:
                self.wfile.write(init_msg)
                self.wfile.flush()
            except Exception:
                self.is_connected = False
                return

            with CLIENTS_LOCK:
                ACTIVE_SSE_CLIENTS.append(self)

            last_ping = time.time()
            try:
                while self.is_connected:
                    time.sleep(0.5)
                    now = time.time()
                    if now - last_ping >= 10.0:
                        last_ping = now
                        try:
                            self.wfile.write(b": ping\n\n")
                            self.wfile.flush()
                        except Exception:
                            self.is_connected = False
                            break
            except Exception:
                pass
            finally:
                self.is_connected = False
                with CLIENTS_LOCK:
                    if self in ACTIVE_SSE_CLIENTS:
                        ACTIVE_SSE_CLIENTS.remove(self)

        else:
            # Static File Serving (home.html, lora-data.html, tiles, css, js, alerts, etc.)
            base_dir = os.path.dirname(os.path.abspath(__file__))
            unquoted_path = urllib.parse.unquote(url_path)
            clean_path = unquoted_path.lstrip('/')
            if not clean_path:
                clean_path = 'home.html'

            file_path = os.path.normpath(os.path.join(base_dir, clean_path))
            if os.path.isdir(file_path):
                index_candidate = os.path.join(file_path, 'index.html')
                if os.path.isfile(index_candidate):
                    file_path = index_candidate
                else:
                    file_path = os.path.join(base_dir, 'home.html')

            if os.path.isfile(file_path):
                mime_type, _ = mimetypes.guess_type(file_path)
                if not mime_type:
                    mime_type = 'application/octet-stream'
                if file_path.endswith('.js'):
                    mime_type = 'application/javascript'
                elif file_path.endswith('.css'):
                    mime_type = 'text/css'
                elif file_path.endswith('.geojson') or file_path.endswith('.json'):
                    mime_type = 'application/json'
                elif file_path.endswith('.svg'):
                    mime_type = 'image/svg+xml'

                try:
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', mime_type)
                    self.send_header('Content-Length', str(len(content)))
                    if file_path.endswith('.jpg') or file_path.endswith('.png'):
                        self.send_header('Cache-Control', 'public, max-age=604800')
                    else:
                        self.send_header('Cache-Control', 'no-cache')
                    self.end_headers()
                    self.wfile.write(content)
                    return
                except Exception as e:
                    self.send_response(500)
                    self.send_header('Content-Type', 'text/plain')
                    self.end_headers()
                    self.wfile.write(f"500 Internal Error: {e}".encode('utf-8'))
                    return

            self.send_response(404)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"404 Not Found: {url_path}".encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/gps':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                data = json.loads(body)
                if "lat" in data and "lng" in data and data["lat"] is not None and data["lng"] is not None:
                    with STATE_LOCK:
                        TELEMETRY_STATE["gps"]["lat"] = float(data["lat"])
                        TELEMETRY_STATE["gps"]["lng"] = float(data["lng"])
                        if "speed_kmh" in data and data["speed_kmh"] is not None:
                            TELEMETRY_STATE["gps"]["speed_kmh"] = round(float(data["speed_kmh"]), 1)
                        if "heading_deg" in data and data["heading_deg"] is not None:
                            TELEMETRY_STATE["gps"]["heading_deg"] = round(float(data["heading_deg"]), 1)
                        if "altitude_m" in data and data["altitude_m"] is not None:
                            TELEMETRY_STATE["gps"]["altitude_m"] = round(float(data["altitude_m"]), 1)
                        if "accuracy" in data and data["accuracy"] is not None:
                            TELEMETRY_STATE["gps"]["accuracy"] = round(float(data["accuracy"]), 1)
                        TELEMETRY_STATE["gps"]["last_update"] = time.time()
                        TELEMETRY_STATE["gps"]["source"] = "LIVE_DEVICE_GEOLOCATION"
                        TELEMETRY_STATE["gps"]["fix_quality"] = "LIVE_GPS_FIX"
                    broadcast_sse("gps", TELEMETRY_STATE["gps"])
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status": "OK", "message": "Live location updated"}')
                    return
                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'{"error": "Missing lat/lng"}')
                    return
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(f'{{"error": "{str(e)}"}}'.encode('utf-8'))
                return

        elif self.path == '/api/gps/clear':
            with STATE_LOCK:
                TELEMETRY_STATE["gps"]["lat"] = None
                TELEMETRY_STATE["gps"]["lng"] = None
                TELEMETRY_STATE["gps"]["speed_kmh"] = 0.0
                TELEMETRY_STATE["gps"]["heading_deg"] = 0.0
                TELEMETRY_STATE["gps"]["altitude_m"] = None
                TELEMETRY_STATE["gps"]["satellites"] = 0
                TELEMETRY_STATE["gps"]["fix_quality"] = "NOT_CONNECTED"
                TELEMETRY_STATE["gps"]["source"] = "NOT_CONNECTED"
                TELEMETRY_STATE["gps"]["accuracy"] = None
                TELEMETRY_STATE["gps"]["last_update"] = None
            broadcast_sse("gps", TELEMETRY_STATE["gps"])
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "OK", "message": "GPS cleared"}')
            return

        elif self.path == '/api/lora/packet':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            parsed = parse_lora_packet(body)
            if parsed and parsed.get("id"):
                nid = parsed["id"]
                with STATE_LOCK:
                    if nid not in TELEMETRY_STATE["lora_poles"]:
                        TELEMETRY_STATE["lora_poles"][nid] = {
                            "id": nid,
                            "name": f"Sensor Pole {nid}",
                            "lat": None,
                            "lng": None
                        }
                    TELEMETRY_STATE["lora_poles"][nid]["water_level"] = parsed["water_level"]
                    TELEMETRY_STATE["lora_poles"][nid]["hourly_rise_rate"] = parsed["hourly_rise_rate"]
                    TELEMETRY_STATE["lora_poles"][nid]["temp_c"] = parsed["temp_c"]
                    TELEMETRY_STATE["lora_poles"][nid]["battery_v"] = parsed["battery_v"]
                    if parsed.get("lat") and parsed.get("lng"):
                        TELEMETRY_STATE["lora_poles"][nid]["lat"] = parsed["lat"]
                        TELEMETRY_STATE["lora_poles"][nid]["lng"] = parsed["lng"]
                    TELEMETRY_STATE["lora_poles"][nid]["status"] = parsed.get("status", "ACTIVE_TRANSMISSION")
                    if "rssi" in parsed:
                        TELEMETRY_STATE["lora_poles"][nid]["rssi"] = parsed["rssi"]
                    if "snr" in parsed:
                        TELEMETRY_STATE["lora_poles"][nid]["snr"] = parsed["snr"]
                    TELEMETRY_STATE["lora_poles"][nid]["last_packet"] = time.time()
                    TELEMETRY_STATE["lora_poles"][nid]["source"] = "HTTP_INJECTION"
                broadcast_sse("lora", TELEMETRY_STATE["lora_poles"][nid])
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "OK", "message": "LoRa packet accepted"}')
                return
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error": "Invalid packet payload"}')

        elif self.path == '/api/ai/analyze':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                req_data = json.loads(body) if body.strip() else {}
            except Exception:
                req_data = {}

            with STATE_LOCK:
                curr_gps = TELEMETRY_STATE["gps"]
                curr_lora = TELEMETRY_STATE["lora_poles"]

            if ai_interface:
                custom_query = req_data.get("query") or req_data.get("question") or req_data.get("custom_query")
                payload = ai_interface.build_qwen_analysis_payload(curr_gps, curr_lora, req_data.get("sos_list"))
                tactical_resp = ai_interface.generate_tactical_response(payload, custom_query=custom_query)
                advisory_text = tactical_resp["text"] if isinstance(tactical_resp, dict) else tactical_resp
                options_list = tactical_resp.get("options", []) if isinstance(tactical_resp, dict) else []
                meta = qwen_manager.get_model_metadata() if (qwen_manager and hasattr(qwen_manager, "get_model_metadata")) else {}
                resp = {
                    "status": "SUCCESS",
                    "tactical_advisory": advisory_text,
                    "suggested_options": options_list,
                    "text": advisory_text,
                    "options": options_list,
                    "qwen_prompt": payload["qwen_prompt"],
                    "structured_context": payload["structured_context"],
                    "model": meta.get("model", "Rescue Sentinel AI 2.0 (Qwen 2.5 1.5B Custom GGUF Q4_K_M)"),
                    "tokenizer": meta.get("tokenizer_format", "gguf_embedded"),
                    "engine": tactical_resp.get("engine", "gguf_q4_k_m") if isinstance(tactical_resp, dict) else "gguf_q4_k_m"
                }
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(resp).encode('utf-8'))
            else:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "AI interface not available"}')

        elif self.path == '/api/ai/plan_route':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                req_data = json.loads(body) if body.strip() else {}
            except Exception:
                req_data = {}

            start_lat = req_data.get("start_lat")
            start_lng = req_data.get("start_lng")
            dest_lat = req_data.get("dest_lat")
            dest_lng = req_data.get("dest_lng")
            dest_name = req_data.get("dest_name", "Target Location")
            priority = req_data.get("priority", "Target")

            if tactical_planner and start_lat and start_lng and dest_lat and dest_lng:
                result = tactical_planner.plan_tactical_corridors(
                    float(start_lat), float(start_lng),
                    float(dest_lat), float(dest_lng),
                    dest_name=dest_name,
                    priority=priority,
                    qwen_manager=qwen_manager
                )
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            else:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"success": false, "error": "Missing coordinates or tactical planner unavailable"}')

        elif self.path == '/api/ai/route_directive':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                req_data = json.loads(body) if body.strip() else {}
            except Exception:
                req_data = {}

            start_lat = req_data.get("start_lat", 18.3225)
            start_lng = req_data.get("start_lng", 78.3395)
            dest_lat = req_data.get("dest_lat", 18.3205)
            dest_lng = req_data.get("dest_lng", 78.3375)
            dest_name = req_data.get("dest_name", "Target Location")
            priority = req_data.get("priority", "Target")
            routes = req_data.get("routes", [])
            has_alt = req_data.get("has_alternative", False)

            directive = ""
            if tactical_planner:
                directive = tactical_planner.generate_qwen_dispatch_directive(
                    float(start_lat), float(start_lng),
                    float(dest_lat), float(dest_lng),
                    dest_name, priority, routes, has_alt, qwen_manager
                )

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "directive": directive}).encode('utf-8'))

        elif self.path == '/api/ai/stream':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                req_data = json.loads(body) if body.strip() else {}
            except Exception:
                req_data = {}

            with STATE_LOCK:
                curr_gps = TELEMETRY_STATE["gps"]
                curr_lora = TELEMETRY_STATE["lora_poles"]

            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

            if not ai_interface:
                err_data = json.dumps({"type": "error", "message": "AI interface offline"})
                self.wfile.write(f"data: {err_data}\n\n".encode('utf-8'))
                return

            custom_query = req_data.get("query") or req_data.get("question") or req_data.get("custom_query")
            payload = ai_interface.build_qwen_analysis_payload(curr_gps, curr_lora, req_data.get("sos_list"))
            prompt, options, is_broadcast_ordered, target_grid = ai_interface.get_tactical_prompt_and_meta(payload, custom_query=custom_query)

            # Send initial metadata & options
            meta = qwen_manager.get_model_metadata() if (qwen_manager and hasattr(qwen_manager, "get_model_metadata")) else {}
            start_data = json.dumps({
                "type": "start",
                "options": options,
                "engine": meta.get("backend", "LlamaCpp"),
                "model": meta.get("model", "Rescue Sentinel AI 2.0 (Qwen 2.5 1.5B Custom GGUF Q4_K_M)"),
                "tokenizer": meta.get("tokenizer_format", "gguf_embedded")
            })
            self.wfile.write(f"data: {start_data}\n\n".encode('utf-8'))
            try:
                self.wfile.flush()
            except Exception:
                pass

            accumulated_text = ""
            for token in qwen_manager.generate_stream(prompt, max_new_tokens=500, temperature=0.3):
                accumulated_text += token
                tok_data = json.dumps({"type": "token", "token": token})
                try:
                    self.wfile.write(f"data: {tok_data}\n\n".encode('utf-8'))
                    self.wfile.flush()
                except Exception:
                    break

            if not is_broadcast_ordered:
                accumulated_text = re.sub(r'### (📢 CHANNEL 2: CITIZEN EVACUATION BROADCAST|CHANNEL 2)[\s\S]*?(?=(###|$))', '', accumulated_text).strip()

            done_data = json.dumps({
                "type": "done",
                "text": accumulated_text.strip(),
                "options": options
            })
            try:
                self.wfile.write(f"data: {done_data}\n\n".encode('utf-8'))
                self.wfile.flush()
            except Exception:
                pass

        elif self.path == '/api/ai/citizen':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                req_data = json.loads(body) if body.strip() else {}
            except Exception:
                req_data = {}

            with STATE_LOCK:
                curr_gps = TELEMETRY_STATE["gps"]
                curr_lora = TELEMETRY_STATE["lora_poles"]

            q = req_data.get("question") or req_data.get("query", "")
            if ai_interface:
                payload = ai_interface.build_qwen_analysis_payload(curr_gps, curr_lora)
                ans_data = ai_interface.generate_tactical_response(payload, custom_query=q)
                ans = ans_data["text"] if isinstance(ans_data, dict) else ans_data
            else:
                ans = "Active telemetry and AI interface offline. Verify that LoRa transceiver and GNSS module are plugged into the Raspberry Pi."

            resp = {"status": "SUCCESS", "answer": ans}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return

        elif self.path == '/api/terminal/exec':
            import subprocess
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"
            try:
                req_data = json.loads(body) if body.strip() else {}
            except Exception:
                req_data = {}

            cmd_str = (req_data.get("cmd") or "").strip()
            cwd = req_data.get("cwd") or os.path.dirname(os.path.abspath(__file__))
            if not os.path.isdir(cwd):
                cwd = os.path.dirname(os.path.abspath(__file__))

            out_text = ""
            err_text = ""
            exit_code = 0

            if cmd_str == "__SYSINFO__":
                # Built-in quick telemetry summary for FloodGuard Terminal
                q_meta = qwen_manager.get_model_metadata() if (qwen_manager and hasattr(qwen_manager, "get_model_metadata")) else {}
                with STATE_LOCK:
                    gps_s = dict(TELEMETRY_STATE["gps"])
                    poles_n = len(TELEMETRY_STATE["lora_poles"])
                out_text = (
                    f"Device   : {TELEMETRY_STATE['system'].get('device')}\n"
                    f"AI Engine: {q_meta.get('model_file', 'GGUF')} ({q_meta.get('status', 'idle')} via {q_meta.get('backend', 'none')})\n"
                    f"GNSS GPS : {gps_s.get('fix_quality')} ({gps_s.get('satellites', 0)} sats) | Lat={gps_s.get('lat')} Lng={gps_s.get('lng')}\n"
                    f"LoRa Bus : {poles_n} active pole(s) | Workdir: {cwd}\n"
                )
            elif cmd_str.startswith("cd ") or cmd_str == "cd":
                target = cmd_str[3:].strip() if len(cmd_str) > 2 else os.path.expanduser("~")
                target = os.path.expanduser(target.strip('"').strip("'"))
                new_dir = os.path.normpath(os.path.join(cwd, target) if not os.path.isabs(target) else target)
                if os.path.isdir(new_dir):
                    cwd = new_dir
                    out_text = ""
                else:
                    err_text = f"cd: no such directory: {target}\n"
                    exit_code = 1
            elif cmd_str:
                try:
                    proc = subprocess.run(
                        cmd_str,
                        shell=True,
                        cwd=cwd,
                        capture_output=True,
                        text=True,
                        timeout=30,
                        encoding="utf-8",
                        errors="replace",
                    )
                    out_text = proc.stdout or ""
                    err_text = proc.stderr or ""
                    exit_code = proc.returncode
                except subprocess.TimeoutExpired:
                    err_text = "Command timed out after 30s (use Native Terminal button for interactive TUI tools like htop/minicom).\n"
                    exit_code = 124
                except Exception as e:
                    err_text = f"Execution error: {e}\n"
                    exit_code = 1

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "cwd": cwd,
                "stdout": out_text,
                "stderr": err_text,
                "returncode": exit_code,
            }).encode('utf-8'))
            return

        elif self.path == '/api/system/terminal':
            import shutil
            import subprocess
            launched = False
            base_dir = os.path.dirname(os.path.abspath(__file__))
            try:
                if sys.platform.startswith('linux'):
                    env = dict(os.environ)
                    env.setdefault("DISPLAY", ":0")
                    for term_cmd in [
                        ["lxterminal", f"--working-directory={base_dir}"],
                        ["xfce4-terminal", f"--working-directory={base_dir}"],
                        ["mate-terminal", f"--working-directory={base_dir}"],
                        ["xterm", "-fa", "Monospace", "-fs", "11", "-bg", "#050811", "-fg", "#6ee7b7"],
                    ]:
                        if shutil.which(term_cmd[0]):
                            subprocess.Popen(term_cmd, cwd=base_dir, env=env,
                                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                             start_new_session=True)
                            launched = True
                            break
                elif sys.platform.startswith('win'):
                    subprocess.Popen(["cmd.exe", "/c", "start", "powershell.exe", "-NoExit"],
                                     cwd=base_dir, shell=False)
                    launched = True
            except Exception as e:
                print(f"⚠️ [SYSTEM] Terminal launch error: {e}")

            self.send_response(200 if launched else 500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": launched}).encode('utf-8'))
            return
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Silence routine access logs to keep terminal uncluttered
        return

# ---------------------------------------------------------------------------
# Main Launcher
# ---------------------------------------------------------------------------
def main():
    print("==================================================================")
    print(" 🚀 FloodGuard AI 2.0 — Raspberry Pi Hardware Telemetry Bridge")
    print(f" 📡 Local Server: http://127.0.0.1:{BRIDGE_PORT}")
    print(" 🛰️ GPS Stream:   http://127.0.0.1:8088/api/gps")
    print(" 📻 LoRa Stream:  http://127.0.0.1:8088/api/lora")
    print(" ⚡ Live SSE:     http://127.0.0.1:8088/api/stream")
    print("==================================================================")

    ensure_linux_serial_permissions()

    # Launch background threads
    t_hw = threading.Thread(target=hardware_listener_thread, daemon=True)
    t_hw.start()

    t_sim = threading.Thread(target=simulation_worker_thread, daemon=True)
    t_sim.start()

    ThreadingHTTPServer.allow_reuse_address = True
    try:
        server = ThreadingHTTPServer(('0.0.0.0', BRIDGE_PORT), HardwareBridgeHandler)
    except OSError as e:
        print(f"⚠️ [BRIDGE ERROR] Could not bind port {BRIDGE_PORT}: {e}")
        print("💡 Retrying in 1 second with address reuse enabled...")
        time.sleep(1.0)
        server = ThreadingHTTPServer(('0.0.0.0', BRIDGE_PORT), HardwareBridgeHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down Hardware Bridge...")
        server.server_close()

if __name__ == '__main__':
    main()
