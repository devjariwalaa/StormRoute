import { describe, it, expect, vi } from "vitest";
import {
  haversine,
  cumulativeDistances,
  interpolate,
  pointAt,
  sampleRoute,
  segmentGeometry,
} from "../src/lib/geometry";
import {
  clamp,
  severity,
  calculateSegmentRisk,
  aggregateRisk,
  scorePrecipitationRisk,
  scoreSnowRisk,
  scoreWindRisk,
  scoreVisibilityRisk,
  scoreTemperatureRisk,
  scoreWeatherCodeRisk,
} from "../src/lib/risk";
import { TTLCache, mapLimit } from "../src/lib/cache";
import { matchWeather } from "../src/lib/weather";
import {
  candidateDepartures,
  evaluateDeparture,
  bestDeparture,
  recommendRoute,
} from "../src/lib/optimization";
import { tripSchema } from "../src/lib/validation";
import type {
  WeatherSnapshot,
  RouteData,
  Timeline,
  RouteCondition,
} from "../src/lib/types";
const clear: WeatherSnapshot = {
  temperature: 20,
  apparentTemperature: 20,
  precipitationProbability: 0,
  precipitation: 0,
  rain: 0,
  snowfall: 0,
  weatherCode: 0,
  visibility: 24000,
  windSpeed: 5,
  windGusts: 10,
};
const route: RouteData = {
  id: "test",
  name: "Synthetic test fixture",
  geometry: [
    [0, 0],
    [0.1, 0],
    [1, 0],
  ],
  distanceMeters: 111195,
  durationSeconds: 3600,
};
const departure = "2030-01-01T12:00:00.000Z";
describe("geographic geometry", () => {
  it("measures an equatorial degree in meters", () =>
    expect(haversine([0, 0], [1, 0])).toBeCloseTo(111195, -1));
  it("returns zero for identical points", () =>
    expect(haversine([4, 5], [4, 5])).toBe(0));
  it("is symmetric", () =>
    expect(haversine([-83, 42], [-87, 41])).toBe(
      haversine([-87, 41], [-83, 42]),
    ));
  it("remains finite at antipodes", () =>
    expect(haversine([0, 0], [180, 0])).toBeCloseTo(Math.PI * 6371008.8));
  it("interpolates coordinates", () =>
    expect(interpolate([0, 0], [2, 4], 0.5)).toEqual([1, 2]));
  it("takes the short antimeridian crossing", () =>
    expect(Math.abs(interpolate([179, 0], [-179, 0], 0.5)[0])).toBe(180));
  it("clamps interpolation", () =>
    expect(interpolate([0, 0], [1, 1], 2)).toEqual([1, 1]));
  it("rejects empty geometry", () =>
    expect(() => cumulativeDistances([])).toThrow());
  it("rejects zero length geometry", () =>
    expect(() =>
      cumulativeDistances([
        [1, 1],
        [1, 1],
      ]),
    ).toThrow());
  it("samples by distance instead of vertex index", () => {
    const s = sampleRoute(route, departure);
    expect(s[1].coordinate[0]).toBeCloseTo(1 / 3);
  });
  it("includes origin and destination", () => {
    const s = sampleRoute(route, departure);
    expect(s[0].coordinate).toEqual([0, 0]);
    expect(s.at(-1)!.coordinate).toEqual([1, 0]);
  });
  it("maps ETA to total route duration", () =>
    expect(sampleRoute(route, departure).at(-1)!.estimatedArrivalTime).toBe(
      "2030-01-01T13:00:00.000Z",
    ));
  it("keeps progress and distances monotonic", () => {
    const s = sampleRoute(route, departure);
    s.forEach((v, i) => {
      expect(v.progress).toBeGreaterThanOrEqual(0);
      expect(v.progress).toBeLessThanOrEqual(1);
      if (i)
        expect(v.distanceFromStartMeters).toBeGreaterThanOrEqual(
          s[i - 1].distanceFromStartMeters,
        );
    });
  });
  it("caps long route sampling at 24", () =>
    expect(
      sampleRoute(
        {
          ...route,
          geometry: [
            [0, 0],
            [150, 0],
          ],
        },
        departure,
      ),
    ).toHaveLength(24));
  it("supports duplicate vertices", () =>
    expect(
      pointAt(
        [
          [0, 0],
          [0, 0],
          [1, 0],
        ],
        [0, 0, 111195],
        0,
      ),
    ).toEqual([0, 0]));
  it("preserves road vertices inside a segment", () =>
    expect(segmentGeometry(route, 0, 0.5)).toContainEqual([0.1, 0]));
});
describe("risk components and invariants", () => {
  it("normalizes out-of-range values", () =>
    expect([-2, 0, 0.5, 1, 5, NaN].map(clamp)).toEqual([0, 0, 0.5, 1, 1, 0]));
  it("uses exact severity boundaries", () =>
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(severity)).toEqual([
      "low",
      "low",
      "moderate",
      "moderate",
      "high",
      "high",
      "severe",
      "severe",
    ]));
  it("scores clear conditions as zero", () =>
    expect(calculateSegmentRisk(clear).score).toBe(0));
  it("rain increases continuously", () =>
    expect(
      scorePrecipitationRisk({ ...clear, precipitation: 4 }),
    ).toBeGreaterThan(scorePrecipitationRisk({ ...clear, precipitation: 1 })));
  it("probability changes rain contribution", () =>
    expect(
      scorePrecipitationRisk({
        ...clear,
        precipitation: 4,
        precipitationProbability: 100,
      }),
    ).toBeGreaterThan(
      scorePrecipitationRisk({
        ...clear,
        precipitation: 4,
        precipitationProbability: 0,
      }),
    ));
  it("snow saturates", () =>
    expect(scoreSnowRisk({ ...clear, snowfall: 8 })).toBe(1));
  it("wind responds to gusts independently", () =>
    expect(scoreWindRisk({ ...clear, windGusts: 100 })).toBe(1));
  it("visibility worsens nonlinearly", () => {
    expect(scoreVisibilityRisk({ ...clear, visibility: 2500 })).toBe(0.5);
    expect(scoreVisibilityRisk({ ...clear, visibility: 100 })).toBe(0.9);
  });
  it("wet freezing conditions raise temperature risk", () =>
    expect(
      scoreTemperatureRisk({ ...clear, temperature: -4, precipitation: 1 }),
    ).toBe(1));
  it("dry mild conditions have no icing score", () =>
    expect(scoreTemperatureRisk({ ...clear, temperature: 0 })).toBe(0));
  it("storm code adds context", () =>
    expect(scoreWeatherCodeRisk({ ...clear, weatherCode: 95 })).toBe(1));
  it("rain codes do not double count rain", () =>
    expect(scoreWeatherCodeRisk({ ...clear, weatherCode: 63 })).toBe(0));
  it("returns ordered, traceable components", () => {
    const r = calculateSegmentRisk({
      ...clear,
      windGusts: 100,
      precipitation: 4,
    });
    expect(r.factors[0].type).toBe("wind");
    expect(r.factors.every((f) => f.contribution > 0)).toBe(true);
  });
  it("keeps thousands of deterministic varied scores bounded", () => {
    for (let i = 0; i < 1500; i++) {
      const r = calculateSegmentRisk({
        ...clear,
        temperature: (i % 80) - 40,
        precipitation: i % 20,
        snowfall: i % 5,
        windSpeed: i % 150,
        windGusts: i % 200,
        visibility: (i * 137) % 30000,
        weatherCode: i % 100,
      });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});
function conditions(
  scores: (number | null)[],
  progress?: number[],
): RouteCondition[] {
  return scores.map((s, i) => ({
    sample: {
      coordinate: [i, 0],
      distanceFromStartMeters: i * 100,
      progress: progress?.[i] ?? i / (scores.length - 1),
      estimatedArrivalTime: departure,
    },
    weather: s === null ? null : clear,
    risk: s === null ? null : { score: s, severity: severity(s), factors: [] },
  }));
}
describe("route aggregation", () => {
  it("rejects empty samples", () => expect(() => aggregateRisk([])).toThrow());
  it("weights exposure by represented distance", () => {
    const a = aggregateRisk(conditions([0, 100, 0], [0, 0.1, 1]));
    expect(a.averageScore).toBeCloseTo(50);
    expect(a.highRiskExposurePercent).toBeCloseTo(50);
  });
  it("protects against a hidden local peak", () => {
    const a = aggregateRisk(conditions([0, 100, 0]));
    expect(a.overallScore).toBeGreaterThan(a.averageScore!);
  });
  it("reports high and severe exposure separately", () => {
    const a = aggregateRisk(conditions([60, 80, 0]));
    expect(a.highRiskExposurePercent).toBe(75);
    expect(a.severeRiskExposurePercent).toBe(50);
  });
  it("does not score incomplete coverage", () =>
    expect(aggregateRisk(conditions([0, null, 0])).overallScore).toBeNull());
  it("does not turn all missing weather into zero", () => {
    const a = aggregateRisk(conditions([null, null]));
    expect(a.coveragePercent).toBe(0);
    expect(a.maximumScore).toBeNull();
  });
  it("keeps route scores bounded", () =>
    expect(aggregateRisk(conditions([100, 100])).overallScore).toBe(100));
});
const timeline: Timeline = {
  times: [Date.parse(departure), Date.parse(departure) + 3600000],
  values: [clear, { ...clear, temperature: 30 }],
  fetchedAt: departure,
};
describe("temporal matching and optimization", () => {
  it("matches exact hours", () =>
    expect(matchWeather(timeline, departure)).toEqual(clear));
  it("matches the nearest hour", () =>
    expect(matchWeather(timeline, "2030-01-01T12:40:00Z")?.temperature).toBe(
      30,
    ));
  it("does not extrapolate beyond forecast", () =>
    expect(matchWeather(timeline, "2030-01-01T13:01:00Z")).toBeNull());
  it("preserves missing hourly fields", () =>
    expect(
      matchWeather({ ...timeline, values: [null, clear] }, departure),
    ).toBeNull());
  it("rejects a timeline gap", () =>
    expect(
      matchWeather(
        {
          ...timeline,
          times: [Date.parse(departure), Date.parse(departure) + 10800000],
        },
        "2030-01-01T13:20:00Z",
      ),
    ).toBeNull());
  it("filters past candidates", () =>
    expect(candidateDepartures(departure, Date.parse(departure))).toHaveLength(
      4,
    ));
  it("creates six windows when all are future", () =>
    expect(
      candidateDepartures(departure, Date.parse(departure) - 86400000),
    ).toHaveLength(6));
  it("recomputes ETA per departure without changing geometry", () => {
    const a = evaluateDeparture(route, departure, Array(4).fill(timeline));
    expect(a.conditions[0].sample.coordinate).toEqual(route.geometry[0]);
    expect(a.riskScore).toBe(0);
  });
  it("prefers selected departure on equal risk", () => {
    const a = evaluateDeparture(route, departure, Array(4).fill(timeline));
    expect(
      bestDeparture(
        [{ ...a, departureTime: "2030-01-01T09:00:00Z" }, a],
        departure,
      ),
    ).toBe(1);
  });
  it("excludes incomplete options from optimization", () => {
    const a = evaluateDeparture(route, departure, Array(4).fill(null));
    expect(bestDeparture([a], departure)).toBe(-1);
  });
  it("selects lower risk alternatives when worthwhile", () => {
    const a = evaluateDeparture(route, departure, Array(4).fill(timeline));
    const mk = (riskScore: number, durationSeconds: number) => ({
      route: { ...route, durationSeconds },
      departures: [{ ...a, riskScore }],
      selectedIndex: 0,
      bestIndex: 0,
    });
    expect(recommendRoute([mk(60, 3600), mk(20, 4000)])).toBe(1);
  });
});
describe("cache and controlled concurrency", () => {
  it("expires at TTL boundary", () => {
    let now = 0;
    const c = new TTLCache<number>(100, 10, () => now);
    c.set("x", 5);
    now = 99;
    expect(c.get("x")).toBe(5);
    now = 100;
    expect(c.get("x")).toBeUndefined();
  });
  it("records hits and misses", async () => {
    const c = new TTLCache<number>(10000),
      d = { cacheHits: 0, cacheMisses: 0 };
    await c.resolve("x", async () => 3, d);
    await c.resolve("x", async () => 4, d);
    expect(d).toEqual({ cacheHits: 1, cacheMisses: 1 });
  });
  it("deduplicates in-flight work", async () => {
    const c = new TTLCache<number>(1000),
      d = { cacheHits: 0, cacheMisses: 0 };
    const fn = vi.fn(async () => 3);
    expect(
      await Promise.all([c.resolve("x", fn, d), c.resolve("x", fn, d)]),
    ).toEqual([3, 3]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not cache rejected loads", async () => {
    const c = new TTLCache<number>(1000),
      d = { cacheHits: 0, cacheMisses: 0 };
    await expect(
      c.resolve(
        "x",
        async () => {
          throw Error("offline");
        },
        d,
      ),
    ).rejects.toThrow();
    expect(await c.resolve("x", async () => 9, d)).toBe(9);
  });
  it("evicts when bounded capacity is reached", () => {
    const c = new TTLCache<number>(10000, 1);
    c.set("a", 1);
    c.set("b", 2);
    expect(c.get("a")).toBeUndefined();
  });
  it("limits simultaneous tasks and preserves order", async () => {
    let active = 0,
      max = 0;
    const r = await mapLimit([1, 2, 3, 4, 5], 2, async (v) => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return v * 2;
    });
    expect(max).toBe(2);
    expect(r).toEqual([2, 4, 6, 8, 10]);
  });
});
describe("server input validation", () => {
  const valid = () => ({
    origin: "Ann Arbor, MI",
    destination: "Chicago, IL",
    departure: new Date(Date.now() + 86400000).toISOString(),
  });
  it("accepts a future trip", () =>
    expect(tripSchema.safeParse(valid()).success).toBe(true));
  it("rejects identical cities", () =>
    expect(
      tripSchema.safeParse({ ...valid(), destination: "ann arbor, mi" })
        .success,
    ).toBe(false));
  it("rejects a past departure", () =>
    expect(
      tripSchema.safeParse({ ...valid(), departure: "2020-01-01T00:00:00Z" })
        .success,
    ).toBe(false));
  it("rejects outside forecast horizon", () =>
    expect(
      tripSchema.safeParse({
        ...valid(),
        departure: new Date(Date.now() + 10 * 86400000).toISOString(),
      }).success,
    ).toBe(false));
  it("rejects empty city", () =>
    expect(tripSchema.safeParse({ ...valid(), origin: "" }).success).toBe(
      false,
    ));
  it("requires explicit timezone offset", () =>
    expect(
      tripSchema.safeParse({ ...valid(), departure: "2030-01-01T12:00:00" })
        .success,
    ).toBe(false));
});

describe("hazard dominance", () => {
  it("keeps an extreme isolated hazard severe", () =>
    expect(calculateSegmentRisk({ ...clear, visibility: 0 }).severity).toBe(
      "severe",
    ));
  it("does not count snow water equivalent as rain", () =>
    expect(
      scorePrecipitationRisk({
        ...clear,
        precipitation: 8,
        snowfall: 2,
        rain: 0,
      }),
    ).toBe(0));
  it("rejects invalid concurrency limits", async () => {
    await expect(mapLimit([1], 0, async (x) => x)).rejects.toThrow();
  });
});

import { RequestBudget } from "../src/lib/budget";
describe("provider usage budget", () => {
  it("rejects a minute quota overrun", () => {
    const b = new RequestBudget(() => 0);
    b.take(450);
    expect(() => b.take(1)).toThrow("budget");
  });
  it("releases expired minute usage", () => {
    let now = 0;
    const b = new RequestBudget(() => now);
    b.take(450);
    now = 60000;
    expect(() => b.take(450)).not.toThrow();
  });
});
