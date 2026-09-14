import { RISK_CONFIG as config } from "./risk-config";
import type {
  WeatherSnapshot,
  SegmentRisk,
  Severity,
  RouteCondition,
  Aggregate,
} from "./types";
export const clamp = (x: number) =>
  Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
export const severity = (s: number): Severity =>
  s < config.severity.moderate
    ? "low"
    : s < config.severity.high
      ? "moderate"
      : s < config.severity.severe
        ? "high"
        : "severe";
export const scorePrecipitationRisk = (w: WeatherSnapshot) =>
  clamp((w.snowfall > 0 ? w.rain : w.precipitation) / config.rainSaturationMm) *
  (0.6 + 0.4 * clamp(w.precipitationProbability / 100));
export const scoreSnowRisk = (w: WeatherSnapshot) =>
  clamp(w.snowfall / config.snowSaturationCm);
export const scoreWindRisk = (w: WeatherSnapshot) =>
  Math.max(
    clamp((w.windSpeed - config.windStartKmh) / config.windRangeKmh),
    clamp((w.windGusts - config.gustStartKmh) / config.gustRangeKmh),
  );
export const scoreVisibilityRisk = (w: WeatherSnapshot) =>
  clamp(
    1 - Math.sqrt(Math.max(0, w.visibility) / config.visibilityClearMeters),
  );
export const scoreTemperatureRisk = (w: WeatherSnapshot) =>
  w.precipitation > 0 || w.snowfall > 0
    ? clamp(
        (config.wetTemperatureStartC - w.temperature) /
          config.wetTemperatureRangeC,
      )
    : clamp(
        (config.dryTemperatureStartC - w.temperature) /
          config.dryTemperatureRangeC,
      ) * config.dryTemperatureMultiplier;
export const scoreWeatherCodeRisk = (w: WeatherSnapshot) =>
  [95, 96, 99].includes(w.weatherCode)
    ? 1
    : [66, 67].includes(w.weatherCode)
      ? 0.9
      : [56, 57].includes(w.weatherCode)
        ? 0.6
        : 0;
export const COMPONENTS = [
  ["rain", 20, scorePrecipitationRisk, "Precipitation along the road"],
  ["snow", 25, scoreSnowRisk, "Snowfall may affect traction"],
  ["wind", 20, scoreWindRisk, "Elevated wind or gusts"],
  ["visibility", 20, scoreVisibilityRisk, "Reduced visibility"],
  [
    "temperature",
    10,
    scoreTemperatureRisk,
    "Cold temperatures with potential icing",
  ],
  [
    "storm",
    5,
    scoreWeatherCodeRisk,
    "Thunderstorm or freezing precipitation signal",
  ],
] as const;
export function calculateSegmentRisk(w: WeatherSnapshot): SegmentRisk {
  const factors = COMPONENTS.map(([type, weight, fn, message]) => ({
    type,
    contribution: weight * fn(w),
    message,
  }));
  const sum = factors.reduce((s, f) => s + f.contribution, 0); // A dominant hazard must remain visible even when other hazards are absent.
  const dominant =
    Math.max(...COMPONENTS.map(([, , fn]) => fn(w))) *
    config.dominantHazardFloor;
  const score = Math.round(Math.min(100, Math.max(sum, dominant)));
  return {
    score,
    severity: severity(score),
    factors: factors
      .filter((f) => f.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution),
  };
}
export function aggregateRisk(conditions: RouteCondition[]): Aggregate {
  if (conditions.length < 2)
    throw new Error("At least two route samples required.");
  let covered = 0,
    weighted = 0,
    high = 0,
    severe = 0,
    max = 0,
    index = -1;
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    const left =
      i === 0 ? 0 : (conditions[i - 1].sample.progress + c.sample.progress) / 2;
    const right =
      i === conditions.length - 1
        ? 1
        : (c.sample.progress + conditions[i + 1].sample.progress) / 2;
    const weight = right - left;
    if (c.risk) {
      covered += weight;
      weighted += c.risk.score * weight;
      if (c.risk.score >= config.severity.high) high += weight;
      if (c.risk.score >= config.severity.severe) severe += weight;
      if (index < 0 || c.risk.score > max) {
        max = c.risk.score;
        index = i;
      }
    }
  }
  const avg = covered ? weighted / covered : null;
  const overall =
    covered > 0.999 && avg !== null
      ? Math.round(
          Math.min(
            100,
            config.aggregation.average * avg +
              config.aggregation.maximum * max +
              config.aggregation.highExposure * high,
          ),
        )
      : null;
  return {
    overallScore: overall,
    severity: overall === null ? null : severity(overall),
    averageScore: avg,
    maximumScore: covered ? max : null,
    highRiskExposurePercent: high * 100,
    severeRiskExposurePercent: severe * 100,
    coveragePercent: covered * 100,
    highestRiskSegment: index,
  };
}
