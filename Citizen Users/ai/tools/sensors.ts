// NOTE: These thresholds are provisional and require project hardware configuration validation.
export const THRESHOLDS = {
  water_level: {
    warning_m: 1.5,
    danger_m: 2.5,
    status: "REQUIRES_CONFIGURATION"
  },
  flow_rate: {
    warning_mps: 2.0,
    danger_mps: 4.0,
    status: "REQUIRES_CONFIGURATION"
  }
};

export function getSensorData(allowSimulation: boolean = false): any {
  if (allowSimulation) {
    return {
      source: "simulated",
      water_level_m: 1.82,
      flow_rate_mps: 2.1,
      rain_gauge_mm: 45.0,
      battery_percentage: 94,
      status: "active"
    };
  }

  // Telemetry hardware sensors are not yet connected, return unavailable by default
  return {
    source: "unavailable",
    water_level_m: null,
    flow_rate_mps: null,
    rain_gauge_mm: null,
    battery_percentage: null,
    status: "offline"
  };
}

export function getSensorThresholds(): any {
  return THRESHOLDS;
}
