/** Heuristic v1 parameters, not empirically calibrated safety thresholds. */
export const RISK_CONFIG = {
  severity: { moderate: 25, high: 50, severe: 75 },
  rainSaturationMm: 8,
  snowSaturationCm: 2,
  windStartKmh: 20,
  windRangeKmh: 60,
  gustStartKmh: 30,
  gustRangeKmh: 70,
  visibilityClearMeters: 10000,
  wetTemperatureStartC: 4,
  wetTemperatureRangeC: 8,
  dryTemperatureStartC: -15,
  dryTemperatureRangeC: 20,
  dryTemperatureMultiplier: 0.3,
  dominantHazardFloor: 75,
  aggregation: { average: 0.65, maximum: 0.25, highExposure: 10 },
} as const;
