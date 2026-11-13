"""
=============================================================================
FloodGuard AI 2.0 — High-Precision Offline Google Hybrid Satellite Downloader
=============================================================================
Downloads pre-baked high-resolution Google Hybrid tiles (Satellite imagery +
highways + road networks + bilingual English/Telugu labels + hospitals/POIs).

Coverage Strategy (~1.25 GB Smart Tactical Pack):
1. Full Kamareddy District & Regional Overview: Zoom 6 - 15 (100% border-to-border)
2. Kamareddy Urban Core (Town, Station, Ashok Nagar): Zoom 16 - 19 (Rooftop clarity)
3. Kamareddy Regional Basin (Adloor, Tekriyal, Sarampally): Zoom 16 - 18
4. Banswada & Nizamsagar Reservoir Catchment: Zoom 16 - 18
5. Yellareddy & Pocharam River Crossings: Zoom 16 - 18
6. Bhiknoor & Domakonda Corridors: Zoom 16 - 18

Tiles stored locally at: Rescue Users/tiles/{z}/{x}/{y}.jpg
=============================================================================
"""

import os
import sys
import math
import time
import random
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TILES_DIR = os.path.join(BASE_DIR, "tiles")

# Google Hybrid tile template with subdomains mt0, mt1, mt2, mt3
GOOGLE_HYBRID_TEMPLATE = "https://mt{sub}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
]

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def get_tiles_for_bbox(lat_min, lat_max, lon_min, lon_max, zoom_min, zoom_max):
    tiles = set()
    for z in range(zoom_min, zoom_max + 1):
        x1, y2 = deg2num(lat_min, lon_min, z)
        x2, y1 = deg2num(lat_max, lon_max, z)
        xmin, xmax = min(x1, x2), max(x1, x2)
        ymin, ymax = min(y1, y2), max(y1, y2)
        for x in range(xmin, xmax + 1):
            for y in range(ymin, ymax + 1):
                tiles.add((z, x, y))
    return tiles

def download_single_tile(tile):
    z, x, y = tile
    out_dir = os.path.join(TILES_DIR, str(z), str(x))
    out_file = os.path.join(out_dir, f"{y}.jpg")

    # Fast resume check: skip if tile exists and is non-empty
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        return True, "skipped", os.path.getsize(out_file)

    os.makedirs(out_dir, exist_ok=True)
    sub = random.choice([0, 1, 2, 3])
    url = GOOGLE_HYBRID_TEMPLATE.format(sub=sub, z=z, y=y, x=x)

    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://maps.google.com/"
    }

    req = urllib.request.Request(url, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=9) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if len(data) > 1000:
                        with open(out_file, "wb") as f:
                            f.write(data)
                        return True, "downloaded", len(data)
        except Exception:
            time.sleep(0.35 * (attempt + 1))

    return False, "failed", 0

def build_tile_queue():
    queue = set()
    print("📍 Building strategic rescue coverage tile queue...")

    # 1. Full Kamareddy District & Regional Overview (Zoom 6 - 15)
    print("  • Queueing Full District Regional Overview (Zoom 6 - 15)...")
    queue.update(get_tiles_for_bbox(17.95, 18.70, 77.80, 78.65, 6, 15))

    # 2. Kamareddy Urban Core (Town Center, Ashok Nagar, Station) (Zoom 19)
    print("  • Queueing Kamareddy Urban Core Ultra-High-Res (Zoom 19)...")
    queue.update(get_tiles_for_bbox(18.30, 18.35, 78.31, 78.36, 19, 19))

    # 3. Kamareddy Tactical Operations Basin (Adloor, Tekriyal, Sarampally) (Zoom 16 - 18)
    print("  • Queueing Kamareddy Tactical Operations Basin (Zoom 16 - 18)...")
    queue.update(get_tiles_for_bbox(18.23, 18.42, 78.25, 78.43, 16, 18))

    # 4. Banswada & Nizamsagar Catchment Basin (Zoom 16 - 18)
    print("  • Queueing Banswada & Nizamsagar Reservoir Corridor (Zoom 16 - 18)...")
    queue.update(get_tiles_for_bbox(18.33, 18.41, 77.86, 77.98, 16, 18))

    # 5. Yellareddy Town & River Crossings (Zoom 16 - 18)
    print("  • Queueing Yellareddy Town & Confluence (Zoom 16 - 18)...")
    queue.update(get_tiles_for_bbox(18.17, 18.24, 78.03, 78.11, 16, 18))

    # 6. Bhiknoor & Domakonda Logistics Corridors (Zoom 16 - 18)
    print("  • Queueing Bhiknoor & Domakonda Highway Corridors (Zoom 16 - 18)...")
    queue.update(get_tiles_for_bbox(18.20, 18.27, 78.40, 78.47, 16, 18))

    return sorted(list(queue))

def main():
    print("=" * 70)
    print("🛰️  FLOODGUARD RESCUE — OFFLINE GOOGLE HYBRID SATELLITE TILE PACK")
    print(f"Target Directory: {TILES_DIR}")
    print("=" * 70)

    all_tiles = build_tile_queue()
    total_tiles = len(all_tiles)
    est_mb = (total_tiles * 25) / 1024
    print(f"\n📊 Total Unique Tiles Queued: {total_tiles:,} (~{est_mb:.1f} MB / {est_mb/1024:.2f} GB)")
    print("⚡ Starting multi-threaded parallel downloader (16 workers)...")
    print("=" * 70)

    start_time = time.time()
    completed = 0
    downloaded = 0
    skipped = 0
    failed = 0
    total_bytes = 0

    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {executor.submit(download_single_tile, t): t for t in all_tiles}
        for future in as_completed(futures):
            success, status, size = future.result()
            completed += 1
            total_bytes += size

            if status == "downloaded":
                downloaded += 1
            elif status == "skipped":
                skipped += 1
            elif status == "failed":
                failed += 1

            if completed % 250 == 0 or completed == total_tiles:
                elapsed = time.time() - start_time
                rate = completed / max(elapsed, 0.001)
                pct = (completed / total_tiles) * 100
                mb_downloaded = total_bytes / (1024 * 1024)
                remaining_tiles = total_tiles - completed
                eta_sec = remaining_tiles / max(rate, 1)
                eta_min = eta_sec / 60
                print(f"[{completed:5d}/{total_tiles}] ({pct:5.1f}%) | "
                      f"New: {downloaded:5d} | Skipped: {skipped:5d} | Failed: {failed:2d} | "
                      f"{mb_downloaded:6.1f} MB | {rate:4.1f} tiles/s | ETA: {eta_min:4.1f} min")

    elapsed_total = time.time() - start_time
    print("\n" + "=" * 70)
    print(f"✅ SATELLITE TILES READY in {elapsed_total:.1f}s ({elapsed_total/60:.1f} min)!")
    print(f"Downloaded: {downloaded:,} new | Skipped: {skipped:,} existing | Failed: {failed}")
    print(f"Total Local Tiles Directory: {TILES_DIR}")
    print("======================================================================")

if __name__ == "__main__":
    main()
