import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Load dotenv
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_DIR = path.dirname(__dirname); // ai/
export const PROJECT_ROOT = path.dirname(BASE_DIR); // Citizen Users/

export const PORT = process.env.PORT || "5000";
export const MODEL_PATH = process.env.MODEL_PATH || path.join(BASE_DIR, "models", "qwen3-4b.gguf");
export const MODEL_CONTEXT_SIZE = parseInt(process.env.MODEL_CONTEXT_SIZE || "2048", 10);
export const MODEL_THREADS = parseInt(process.env.MODEL_THREADS || "4", 10);
export const FIREBASE_CREDENTIALS_PATH = process.env.FIREBASE_CREDENTIALS_PATH || "";

export let WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";

// Read weather key from backend .env config if not set in process environment
const dotenvPaths = [
  path.join(BASE_DIR, ".env"),
  path.join(BASE_DIR, "..", "backend", ".env"),
  path.join(PROJECT_ROOT, "backend", ".env")
];

for (const dPath of dotenvPaths) {
  if (!WEATHER_API_KEY && fs.existsSync(dPath)) {
    try {
      const content = fs.readFileSync(dPath, "utf-8");
      const match = content.match(/OPENWEATHER_API_KEY\s*=\s*(.*)/);
      if (match && match[1]) {
        WEATHER_API_KEY = match[1].trim();
        break;
      }
    } catch (e) {
      // Ignore fallback errors
    }
  }
}

// Find grids GeoJSON
let geojsonPath = path.join(BASE_DIR, "..", "data", "kmr_grids_ai.geojson");
if (!fs.existsSync(geojsonPath)) {
  geojsonPath = path.join(BASE_DIR, "..", "data", "kamareddy_grids.geojson");
}
if (!fs.existsSync(geojsonPath)) {
  geojsonPath = path.join(PROJECT_ROOT, "data", "kmr_grids_ai.geojson");
}
export const GEOJSON_GRID_PATH = geojsonPath;
