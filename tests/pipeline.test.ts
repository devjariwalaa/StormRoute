import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RouteData, Timeline, WeatherSnapshot } from "../src/lib/types";
vi.mock("../src/lib/providers", () => ({
  geocode: vi.fn(),
  getRoutes: vi.fn(),
  getWeather: vi.fn(),
}));
import { geocode, getRoutes, getWeather } from "../src/lib/providers";
import { analyze } from "../src/lib/analyze";
const weather: WeatherSnapshot = {
  temperature: 20,
  apparentTemperature: 20,
  precipitationProbability: 0,
  precipitation: 0,
  rain: 0,
  snowfall: 0,
  weatherCode: 0,
  visibility: 20000,
  windSpeed: 0,
  windGusts: 0,
};
const route: RouteData = {
  id: "fixture",
  name: "Synthetic test route",
  distanceMeters: 10000,
  durationSeconds: 600,
  geometry: [
    [-83, 42],
    [-83.1, 42.1],
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(geocode).mockImplementation(async (q) => ({
    name: q,
    latitude: q === "Origin, MI" ? 42 : 43,
    longitude: -83,
    timezone: "America/Detroit",
  }));
  vi.mocked(getRoutes).mockResolvedValue([route]);
  vi.mocked(getWeather).mockImplementation(async (points) => {
    const start = Math.floor(Date.now() / 3600000) * 3600000;
    const t: Timeline = {
      times: Array.from({ length: 192 }, (_, i) => start + i * 3600000),
      values: Array.from({ length: 192 }, () => weather),
      fetchedAt: new Date(start).toISOString(),
    };
    return points.map(() => t);
  });
});
const input = () => ({
  origin: "Origin, MI",
  destination: "Destination, MI",
  departure: new Date(Date.now() + 86400000).toISOString(),
});
describe("pipeline orchestration", () => {
  it("evaluates six windows with one route and weather load", async () => {
    const a = await analyze(input(), true);
    expect(a.routes[0].departures).toHaveLength(6);
    expect(a.routes[0].departures.every((d) => d.riskScore === 0)).toBe(true);
    expect(getRoutes).toHaveBeenCalledTimes(1);
    expect(getWeather).toHaveBeenCalledTimes(1);
    expect(a.diagnostics?.sampleCount).toBe(3);
    expect(a.weatherFetchedAt).not.toBeNull();
  });
  it("canonicalizes timestamp offsets without duplicate selected windows", async () => {
    const v = input();
    v.departure = v.departure.replace(".000Z", "Z");
    const a = await analyze(v);
    expect(a.routes[0].departures).toHaveLength(6);
    expect(
      new Set(a.routes[0].departures.map((d) => Date.parse(d.departureTime)))
        .size,
    ).toBe(6);
  });
  it("hides diagnostics by default", async () =>
    expect((await analyze(input())).diagnostics).toBeUndefined());
  it("cannot recommend completely missing forecasts", async () => {
    vi.mocked(getWeather).mockResolvedValue([null, null, null]);
    const a = await analyze(input());
    expect(a.recommendedRouteIndex).toBe(-1);
    expect(a.routes[0].bestIndex).toBe(-1);
    expect(a.warnings.length).toBeGreaterThan(0);
    expect(a.recommendation).toContain("insufficient");
  });
  it("rejects geographically identical resolved cities", async () => {
    vi.mocked(geocode).mockResolvedValue({
      name: "Same",
      latitude: 42,
      longitude: -83,
      timezone: "UTC",
    });
    await expect(analyze(input())).rejects.toMatchObject({
      code: "SAME_LOCATION",
    });
    expect(getRoutes).not.toHaveBeenCalled();
  });
});
