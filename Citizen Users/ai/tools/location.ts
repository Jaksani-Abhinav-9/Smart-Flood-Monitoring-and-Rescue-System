import fs from "fs";
import { GEOJSON_GRID_PATH } from "../core/config.js";

let _geojsonCache: any = null;

export function loadGrids(): any {
  if (_geojsonCache) return _geojsonCache;
  if (!fs.existsSync(GEOJSON_GRID_PATH)) return null;
  try {
    const raw = fs.readFileSync(GEOJSON_GRID_PATH, "utf-8");
    _geojsonCache = JSON.parse(raw);
    return _geojsonCache;
  } catch (e) {
    return null;
  }
}

// Pure JS Ray-casting point-in-polygon algorithm
function isPointInPolygon(point: [number, number], vs: number[][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getLocationGrid(latitude: number, longitude: number): any {
  const data = loadGrids();
  if (!data || !data.features) return null;

  const point: [number, number] = [longitude, latitude]; // GeoJSON format: [lng, lat]
  const features = data.features;

  // 1. Polygon containment check
  for (const feature of features) {
    try {
      const geometry = feature.geometry;
      if (geometry.type === "Polygon") {
        const coords = geometry.coordinates[0];
        if (isPointInPolygon(point, coords)) {
          return feature;
        }
      }
    } catch (e) {
      continue;
    }
  }

  // 2. Centroid distance proximity fallback
  let bestFeature: any = null;
  let bestDist = Infinity;

  for (const feature of features) {
    try {
      const geometry = feature.geometry;
      let cx = 0, cy = 0;
      if (geometry.type === "Polygon") {
        const coords = geometry.coordinates[0];
        coords.forEach((coord: number[]) => {
          cx += coord[0];
          cy += coord[1];
        });
        cx /= coords.length;
        cy /= coords.length;

        const dist = Math.hypot(cx - longitude, cy - latitude);
        if (dist < bestDist) {
          bestDist = dist;
          bestFeature = feature;
        }
      }
    } catch (e) {
      continue;
    }
  }

  return bestFeature;
}
