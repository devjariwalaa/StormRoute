import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  clearCaches,
  geocode,
  getRoutes,
  getWeather,
} from "../src/lib/providers";
import { fetchJson } from "../src/lib/validation";
import { analyze } from "../src/lib/analyze";
import type { Diagnostics, Location } from "../src/lib/types";
const stats = (): Diagnostics => ({
  stages: {},
  cacheHits: 0,
  cacheMisses: 0,
  weatherRequests: 0,
  geometryPoints: 0,
  sampleCount: 0,
  totalMs: 0,
});
const a: Location = {
  name: "Test City",
  latitude: 42,
  longitude: -83,
  timezone: "America/Detroit",
};
const b: Location = {
  name: "Other City",
  latitude: 41,
  longitude: -87,
  timezone: "America/Chicago",
};
beforeEach(() => clearCaches());
afterEach(() => {
  vi.unstubAllGlobals();
});
const respond = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
describe("provider failures and boundaries", () => {
  it("returns typed provider HTTP failures", async () => {
    respond({}, 429);
    await expect(
      fetchJson(new URL("https://api.open-meteo.com/")),
    ).rejects.toMatchObject({ code: "PROVIDER_HTTP" });
  });
  it("handles network timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")),
    );
    await expect(
      fetchJson(new URL("https://api.open-meteo.com/")),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });
  it("rejects malformed geocoding data", async () => {
    respond({ results: [{ name: "Broken", latitude: "wrong" }] });
    await expect(geocode("Broken, MI", stats())).rejects.toMatchObject({
      code: "GEOCODING_FORMAT",
    });
  });
  it("returns a useful missing-city error", async () => {
    respond({});
    await expect(geocode("Missing, MI", stats())).rejects.toMatchObject({
      code: "LOCATION_NOT_FOUND",
      status: 400,
    });
  });
  it("requires clarification for unqualified ambiguous cities", async () => {
    respond({ results: [a, b] });
    await expect(geocode("Springfield", stats())).rejects.toMatchObject({
      code: "AMBIGUOUS_LOCATION",
    });
  });
  it("encodes geocoding input inside a fixed URL", async () => {
    respond({ results: [a] });
    await geocode("Test, MI&url=https://evil.example", stats());
    const url = vi.mocked(fetch).mock.calls[0][0] as URL;
    expect(url.hostname).toBe("geocoding-api.open-meteo.com");
    expect(url.searchParams.get("url")).toBeNull();
  });
  it("rejects empty routing geometry", async () => {
    respond({
      code: "Ok",
      routes: [{ distance: 100, duration: 100, geometry: { coordinates: [] } }],
    });
    await expect(getRoutes(a, b, stats())).rejects.toMatchObject({
      code: "NO_ROUTE",
    });
  });
  it("preserves only genuine practical alternatives", async () => {
    respond({
      code: "Ok",
      routes: [100, 110, 200].map((duration) => ({
        distance: 1000,
        duration,
        geometry: {
          coordinates: [
            [-83, 42],
            [-87, 41],
          ],
        },
      })),
    });
    const r = await getRoutes(a, b, stats());
    expect(r).toHaveLength(2);
    expect(r[1].durationSeconds).toBe(110);
  });
  it("degrades a failed weather batch to unavailable", async () => {
    respond({}, 503);
    expect(await getWeather([[-83, 42]], stats())).toEqual([null]);
  });
  it("rejects out-of-order weather timestamps", async () => {
    respond({ hourly: { time: [2, 1] } });
    expect(await getWeather([[-83, 42]], stats())).toEqual([null]);
  });
  it("preserves missing fields instead of inventing zero", async () => {
    respond({ hourly: { time: [1000], temperature_2m: [null] } });
    const r = await getWeather([[-83, 42]], stats());
    expect(r[0]?.values).toEqual([null]);
  });
  it("validates before calling any provider", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(analyze({})).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
