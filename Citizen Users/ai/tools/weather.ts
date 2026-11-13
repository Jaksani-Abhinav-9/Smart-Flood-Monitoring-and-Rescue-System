import { WEATHER_API_KEY } from "../core/config.js";

export async function getCurrentWeather(city: string = "Kamareddy", allowSimulation: boolean = false): Promise<any> {
  if (!WEATHER_API_KEY || WEATHER_API_KEY === "013fd1536ae9f06ce5fe564ec2b5dd98") {
    if (allowSimulation) {
      return getSimulatedWeather(city);
    }
    return {
      source: "unavailable",
      temp_c: null,
      humidity: null,
      rainfall_mm: 0.0,
      weather_desc: "weather service offline",
      city
    };
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      const data = await resp.json();
      const rainInfo = data.rain || {};
      const rainfallMm = rainInfo["1h"] || rainInfo["3h"] || 0.0;

      return {
        source: "live",
        temp_c: data.main.temp,
        humidity: data.main.humidity,
        rainfall_mm: parseFloat(rainfallMm),
        weather_desc: data.weather[0].description,
        city: city
      };
    } else {
      if (allowSimulation) return getSimulatedWeather(city);
      return {
        source: "unavailable",
        temp_c: null,
        humidity: null,
        rainfall_mm: 0.0,
        weather_desc: "weather API service query failed",
        city
      };
    }
  } catch (e) {
    if (allowSimulation) return getSimulatedWeather(city);
    return {
      source: "unavailable",
      temp_c: null,
      humidity: null,
      rainfall_mm: 0.0,
      weather_desc: "weather service offline",
      city
    };
  }
}

function getSimulatedWeather(city: string): any {
  return {
    source: "simulated",
    temp_c: 26.8,
    humidity: 88,
    rainfall_mm: 45.0,
    weather_desc: "heavy thunderstorm activity (simulated)",
    city: city
  };
}
