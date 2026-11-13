import { getCurrentWeather } from "../tools/weather.js";
import { getSensorData, getSensorThresholds } from "../tools/sensors.js";
import { calculateFloodRisk } from "../tools/flood-risk.js";
import { getLocationGrid } from "../tools/location.js";
import { getShelterCapacity, getEmergencyContacts } from "../tools/emergency.js";

export async function getCitizenDataContext(params: any): Promise<string> {
  const lat = params?.lat;
  const lng = params?.lng;

  let locationDetails = "Location coordinates not supplied by browser.";
  let resolvedRisk = "Unable to calculate flood risk without GPS coordinates.";
  let rainfallVal = 0.0;

  // 1. Resolve Grid Location
  if (lat !== undefined && lng !== undefined) {
    try {
      const grid = getLocationGrid(Number(lat), Number(lng));
      if (grid) {
        locationDetails = `Coordinates: ${lat}, ${lng} | Matched Grid ID: ${grid.properties?.id} | Sector Name: ${grid.properties?.name || "Unknown"} | Altitude: ${grid.properties?.altitude}m`;
      } else {
        locationDetails = `Coordinates: ${lat}, ${lng} | Did not match any project geographical grid.`;
      }
    } catch (e: any) {
      locationDetails = `Error resolving location: ${e.message || e}`;
    }
  }

  // 2. Weather Info — note source state
  let weatherStr = "";
  try {
    const weather = await getCurrentWeather("Kamareddy", false); // Live only; no simulation
    if (weather.source === "unavailable") {
      weatherStr = `[SOURCE: UNAVAILABLE] Weather service is currently offline.`;
      rainfallVal = 0.0;
    } else {
      weatherStr = `[SOURCE: ${weather.source.toUpperCase()}] City: ${weather.city} | Temp: ${weather.temp_c}C | Humidity: ${weather.humidity}% | Rainfall: ${weather.rainfall_mm}mm | Condition: ${weather.weather_desc}`;
      rainfallVal = weather.rainfall_mm || 0.0;
    }
  } catch (e: any) {
    weatherStr = `[SOURCE: UNAVAILABLE] Weather service error: ${e.message || e}`;
  }

  // 3. Flood Risk — uses real or zero rainfall value from weather
  if (lat !== undefined && lng !== undefined) {
    try {
      const risk = calculateFloodRisk(Number(lat), Number(lng), rainfallVal);
      resolvedRisk = `Risk Level: ${risk.level} | Alert: ${risk.message} | Flooded Grid count: ${risk.flooded_grids?.length || 0}`;
    } catch (e: any) {
      resolvedRisk = `Flood risk calculation service failure: ${e.message || e}`;
    }
  }

  // 4. IoT Telemetry — hardware not yet connected; default source is "unavailable"
  let sensorStr = "";
  try {
    const sensors = getSensorData(false); // false = no simulation
    const thresholds = getSensorThresholds();
    if (sensors.source === "unavailable") {
      sensorStr = `[SOURCE: UNAVAILABLE] IoT water level sensors are not yet connected to the AI backend.`;
    } else {
      sensorStr = `[SOURCE: ${sensors.source.toUpperCase()}] Water Level: ${sensors.water_level_m}m (Danger threshold: ${thresholds.water_level.danger_m}m) | Flow Rate: ${sensors.flow_rate_mps}m/s | Status: ${sensors.status}`;
    }
  } catch (e: any) {
    sensorStr = `[SOURCE: UNAVAILABLE] Sensor telemetry error: ${e.message || e}`;
  }

  // 5. Evacuation Shelters
  let sheltersStr = "";
  try {
    const shelters = getShelterCapacity();
    const shelterLines = shelters.map(s => `- ${s.name}: ${s.available_spots} free spots (occupancy: ${s.occupancy}/${s.capacity})`);
    sheltersStr = shelterLines.join("\n");
  } catch (e: any) {
    sheltersStr = `[SOURCE: UNAVAILABLE] Emergency shelter list offline: ${e.message || e}`;
  }

  // 6. Emergency Contacts
  const contacts = getEmergencyContacts();
  const contactsStr = Object.entries(contacts).map(([k, v]) => `${k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}: ${v}`).join(", ");

  return `
- USER GPS LOCATION: ${locationDetails}
- WEATHER DATA: ${weatherStr}
- CALCULATED FLOOD RISK: ${resolvedRisk}
- IOT SENSOR TELEMETRY: ${sensorStr}
- EMERGENCY HELPLINES: ${contactsStr}
- SAFE EVACUATION SHELTERS:
${sheltersStr}
`;
}
