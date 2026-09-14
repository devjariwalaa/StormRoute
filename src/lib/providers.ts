import { z } from "zod";
import { RequestBudget } from "./budget";
import { TTLCache, SerialGate, mapLimit } from "./cache";
import { AppError, fetchJson } from "./validation";
import type {
  Location,
  RouteData,
  Coordinate,
  Timeline,
  Diagnostics,
} from "./types";
const geoCache = new TTLCache<Location>(86400000);
const routeCache = new TTLCache<RouteData[]>(3600000);
const weatherCache = new TTLCache<Timeline[]>(600000, 80);
const routingGate = new SerialGate(1100);
const weatherGate = new SerialGate(1500);
const providerBudget = new RequestBudget();
export function clearCaches() {
  geoCache.clear();
  routeCache.clear();
  weatherCache.clear();
}
const locationSchema = z.object({
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().optional(),
  admin1: z.string().optional(),
  timezone: z.string().default("UTC"),
});
export async function geocode(
  query: string,
  d: Diagnostics,
): Promise<Location> {
  return geoCache.resolve(
    query.trim().toLowerCase(),
    async () => {
      providerBudget.take(1);
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.search = new URLSearchParams({
        name: query,
        count: "5",
        language: "en",
      }).toString();
      const parsed = z
        .object({ results: z.array(locationSchema).optional() })
        .safeParse(await fetchJson(url));
      if (!parsed.success)
        throw new AppError(
          "GEOCODING_FORMAT",
          "The location provider returned invalid data.",
        );
      const results = parsed.data.results ?? [];
      if (!results.length)
        throw new AppError(
          "LOCATION_NOT_FOUND",
          `No city found for “${query}”. Try a city and full state or country name.`,
          400,
        );
      if (results.length > 1 && !query.includes(","))
        throw new AppError(
          "AMBIGUOUS_LOCATION",
          `Please add a state or country to “${query}” (for example, ${results[0].name}, ${results[0].admin1 ?? results[0].country}).`,
          400,
        );
      return results[0];
    },
    d,
  );
}
const coord = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const routingSchema = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number().positive(),
        duration: z.number().positive(),
        geometry: z.object({ coordinates: z.array(coord).min(2) }),
        legs: z.array(z.object({ summary: z.string() })).optional(),
      }),
    )
    .optional(),
});
export async function getRoutes(
  a: Location,
  b: Location,
  d: Diagnostics,
): Promise<RouteData[]> {
  const key = JSON.stringify([
    a.longitude,
    a.latitude,
    b.longitude,
    b.latitude,
  ]);
  return routeCache.resolve(
    key,
    () =>
      routingGate.run(async () => {
        const base =
          process.env.ROUTING_BASE_URL ??
          "https://routing.openstreetmap.de/routed-car";
        const url = new URL(
          `${base}/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}`,
        );
        url.search = new URLSearchParams({
          overview: "full",
          geometries: "geojson",
          alternatives: "true",
          steps: "false",
        }).toString();
        const response = routingSchema.safeParse(await fetchJson(url));
        if (
          !response.success ||
          response.data.code !== "Ok" ||
          !response.data.routes?.length
        )
          throw new AppError(
            "NO_ROUTE",
            "No driving route was available between these cities.",
            422,
          );
        return response.data.routes
          .sort((a, b) => a.duration - b.duration)
          .filter((r, _, all) => r.duration <= all[0].duration * 1.35)
          .slice(0, 3)
          .map((r, i) => ({
            id: `route-${i}`,
            name:
              r.legs
                ?.map((l) => l.summary)
                .filter(Boolean)
                .join(" / ") ||
              (i === 0 ? "Fastest route" : `Alternative ${i}`),
            distanceMeters: r.distance,
            durationSeconds: r.duration,
            geometry: r.geometry.coordinates,
          }));
      }),
    d,
  );
}
const fields = {
  temperature: "temperature_2m",
  apparentTemperature: "apparent_temperature",
  precipitationProbability: "precipitation_probability",
  precipitation: "precipitation",
  rain: "rain",
  snowfall: "snowfall",
  weatherCode: "weather_code",
  visibility: "visibility",
  windSpeed: "wind_speed_10m",
  windGusts: "wind_gusts_10m",
} as const;
const snapshotSchema = z.object({
  temperature: z.number().min(-100).max(70),
  apparentTemperature: z.number().min(-130).max(90),
  precipitationProbability: z.number().min(0).max(100),
  precipitation: z.number().nonnegative(),
  rain: z.number().nonnegative(),
  snowfall: z.number().nonnegative(),
  weatherCode: z.number().int().min(0).max(99),
  visibility: z.number().nonnegative(),
  windSpeed: z.number().nonnegative(),
  windGusts: z.number().nonnegative(),
});
const weatherSchema = z.object({
  hourly: z.record(z.string(), z.array(z.number().nullable())),
});
export async function getWeather(
  points: Coordinate[],
  d: Diagnostics,
): Promise<(Timeline | null)[]> {
  const batches: Array<Coordinate[]> = [];
  for (let i = 0; i < points.length; i += 12)
    batches.push(points.slice(i, i + 12));
  const groups = await mapLimit(batches, 2, async (batch) => {
    const key = JSON.stringify([new Date().toISOString().slice(0, 10), batch]);
    try {
      return await weatherCache.resolve(
        key,
        () =>
          weatherGate
            .run(async () => undefined)
            .then(async () => {
              const url = new URL("https://api.open-meteo.com/v1/forecast");
              url.search = new URLSearchParams({
                latitude: batch.map((p) => p[1].toFixed(4)).join(","),
                longitude: batch.map((p) => p[0].toFixed(4)).join(","),
                hourly: Object.values(fields).join(","),
                timezone: "GMT",
                timeformat: "unixtime",
                forecast_days: "8",
                wind_speed_unit: "kmh",
                temperature_unit: "celsius",
                precipitation_unit: "mm",
              }).toString();
              providerBudget.take(batch.length);
              d.weatherRequests++;
              const raw = await fetchJson(url);
              const parsed = z
                .array(weatherSchema)
                .safeParse(Array.isArray(raw) ? raw : [raw]);
              if (!parsed.success || parsed.data.length !== batch.length)
                throw new AppError(
                  "WEATHER_FORMAT",
                  "Invalid forecast response.",
                );
              return parsed.data.map(({ hourly }) => {
                const times = hourly.time;
                if (
                  !times?.length ||
                  times.some(
                    (t, i) => t === null || (i > 0 && t <= times[i - 1]!),
                  )
                )
                  throw new AppError(
                    "WEATHER_FORMAT",
                    "Invalid forecast timeline.",
                  );
                const values = times.map((_, i) => {
                  const entries = Object.entries(fields).map(
                    ([key, field]) => [key, hourly[field]?.[i]] as const,
                  );
                  if (
                    entries.some(
                      ([, v]) =>
                        v === null || v === undefined || !Number.isFinite(v),
                    )
                  )
                    return null;
                  const snapshot = snapshotSchema.safeParse(
                    Object.fromEntries(entries),
                  );
                  return snapshot.success ? snapshot.data : null;
                });
                return {
                  times: times.map((t) => t! * 1000),
                  values,
                  fetchedAt: new Date().toISOString(),
                };
              });
            }),
        d,
      );
    } catch {
      return batch.map(() => null);
    }
  });
  return groups.flat();
}
