import json
import os
import math
from typing import Any, Dict, Optional

from shapely.geometry import Point, shape

_CACHE: Optional[Dict[str, Any]] = None
_PATH: Optional[str] = None


def _default_path() -> str:
    base = os.path.abspath(os.path.dirname(__file__))
    primary = os.path.join(base, "..", "data", "kmr_grids_ai.geojson")
    if os.path.exists(primary):
        return primary
    fallback = os.path.join(base, "..", "data", "kamareddy_grids.geojson")
    if os.path.exists(fallback):
        return fallback
    return os.path.join(base, "kmr_grids_ai.geojson")


def load_geojson() -> Optional[Dict[str, Any]]:
    global _CACHE, _PATH
    if _CACHE is not None:
        return _CACHE

    path = _default_path()
    if not os.path.exists(path):
        return None

    with open(path, "r", encoding="utf-8") as f:
        _CACHE = json.load(f)
        _PATH = path
    return _CACHE


def find_feature(latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
    data = load_geojson()
    if not data:
        return None

    point = Point(longitude, latitude)
    features = data.get("features", [])

    # Try point-in-polygon first
    for feature in features:
        try:
            geom = shape(feature.get("geometry", {}))
            if geom.contains(point):
                return feature
        except Exception:
            continue

    # If no polygon contains, find nearest centroid
    best = None
    best_dist = None
    for feature in features:
        try:
            geom = shape(feature.get("geometry", {}))
            c = geom.centroid
            d = math.hypot(c.x - longitude, c.y - latitude)
            if best_dist is None or d < best_dist:
                best_dist = d
                best = feature
        except Exception:
            continue

    return best
