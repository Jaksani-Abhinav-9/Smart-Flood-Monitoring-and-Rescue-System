import { getLocationGrid, loadGrids } from "./location.js";

export function calculateFloodRisk(lat: number, lng: number, rainfallMm: number): any {
  const gridsData = loadGrids();
  if (!gridsData || !gridsData.features) {
    return {
      level: "UNKNOWN",
      message: "Altitude grids geographical data is missing.",
      flooded_grids: []
    };
  }

  const features = gridsData.features;
  const userFeature = getLocationGrid(lat, lng);

  // Find lowest altitude grid
  let lowestAltitude = Infinity;
  let lowestGrid: any = null;

  for (const f of features) {
    const alt = f.properties?.altitude;
    if (alt !== undefined && alt < lowestAltitude) {
      lowestAltitude = alt;
      lowestGrid = f;
    }
  }

  if (!lowestGrid) {
    return {
      level: "SAFE",
      message: "No altitude landmarks resolved.",
      flooded_grids: []
    };
  }

  // Replicate altitude algorithm from docs/backend/floodLogic.js
  const spreadFactor = rainfallMm < 30 ? 0.3 : (rainfallMm < 70 ? 0.6 : 1.0);
  const flooded: string[] = [];
  const visited = new Set<string>();

  function spread(gridId: string, depth: number) {
    if (!gridId || visited.has(gridId)) return;
    visited.add(gridId);

    const gridFeat = features.find((f: any) => f.properties?.id === gridId);
    if (!gridFeat) return;

    const altitude = gridFeat.properties?.altitude ?? 999.0;
    const waterLevel = lowestAltitude + (rainfallMm * spreadFactor) - (depth * 2.0);

    if (waterLevel >= altitude) {
      flooded.push(gridId);
      const neighbors = gridFeat.properties?.neighbors || [];
      for (const n of neighbors) {
        spread(n, depth + 1);
      }
    }
  }

  const lowestId = lowestGrid.properties?.id;
  if (lowestId) {
    spread(lowestId, 0);
  }

  let level = "SAFE";
  let message = "No flood risk currently at your location.";

  if (userFeature) {
    const userId = userFeature.properties?.id;
    if (userId && flooded.includes(userId)) {
      level = "EMERGENCY";
      message = "⚠ EMERGENCY: Flood water has reached your grid altitude!";
    } else if (flooded.length > 0) {
      const userNeighbors = userFeature.properties?.neighbors || [];
      const isNeighborFlooded = userNeighbors.some((n: string) => flooded.includes(n));
      if (isNeighborFlooded) {
        level = "DANGER";
        message = "WARNING: Flood spreading in adjacent grids.";
      } else {
        level = "WARNING";
        message = "Flood active in low-lying sectors.";
      }
    }
  } else {
    if (flooded.length > 0) {
      level = "WARNING";
      message = "Flood active in low-lying sectors.";
    }
  }

  return {
    level,
    message,
    flooded_grids: flooded,
    spread_factor: spreadFactor,
    lowest_altitude_m: lowestAltitude,
    user_altitude_m: userFeature ? userFeature.properties?.altitude : null
  };
}
