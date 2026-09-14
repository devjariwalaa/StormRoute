import { tripSchema, AppError } from "./validation";
import { geocode, getRoutes, getWeather } from "./providers";
import { haversine, sampleRoute } from "./geometry";
import {
  candidateDepartures,
  evaluateDeparture,
  bestDeparture,
  recommendRoute,
} from "./optimization";
import type { Analysis, Diagnostics, AnalyzedRoute } from "./types";
export async function analyze(
  input: unknown,
  includeDiagnostics = false,
): Promise<Analysis> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      "INVALID_INPUT",
      parsed.error.issues.map((i) => i.message).join(" "),
      400,
    );
  const trip = {
    ...parsed.data,
    departure: new Date(parsed.data.departure).toISOString(),
  };
  const start = performance.now();
  const d: Diagnostics = {
    stages: {},
    cacheHits: 0,
    cacheMisses: 0,
    weatherRequests: 0,
    geometryPoints: 0,
    sampleCount: 0,
    totalMs: 0,
  };
  const stage = async <T>(name: string, fn: () => T | Promise<T>) => {
    const t = performance.now();
    const result = await fn();
    d.stages[name] = Math.round((performance.now() - t) * 100) / 100;
    return result;
  };
  const [origin, destination] = await stage("geocoding", () =>
    Promise.all([geocode(trip.origin, d), geocode(trip.destination, d)]),
  );
  if (
    haversine(
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ) < 500
  )
    throw new AppError(
      "SAME_LOCATION",
      "Choose cities at least 500 meters apart.",
      400,
    );
  const routes = await stage("routing", () =>
    getRoutes(origin, destination, d),
  );
  if (routes[0].durationSeconds > 36 * 3600)
    throw new AppError(
      "ROUTE_TOO_LONG",
      "Please choose a drive shorter than 36 hours for reliable forecast coverage.",
      422,
    );
  const samples = await stage("sampling", () =>
    routes.map((r) => sampleRoute(r, trip.departure)),
  );
  d.geometryPoints = routes.reduce((n, r) => n + r.geometry.length, 0);
  d.sampleCount = samples.reduce((n, s) => n + s.length, 0);
  const weather = await stage("weather", () =>
    getWeather(
      samples.flat().map((s) => s.coordinate),
      d,
    ),
  );
  let offset = 0;
  const timelines = samples.map((s) => {
    const group = weather.slice(offset, offset + s.length);
    offset += s.length;
    return group;
  });
  const selected = await stage("risk", () =>
    routes.map((r, i) => evaluateDeparture(r, trip.departure, timelines[i])),
  );
  const analyzed = await stage("optimization", () =>
    routes.map((route, i): AnalyzedRoute => {
      const candidates = candidateDepartures(trip.departure);
      if (!candidates.includes(trip.departure)) candidates.push(trip.departure);
      candidates.sort();
      const departures = candidates.map((t) =>
        t === trip.departure
          ? selected[i]
          : evaluateDeparture(route, t, timelines[i]),
      );
      return {
        route,
        departures,
        selectedIndex: departures.findIndex(
          (o) => o.departureTime === trip.departure,
        ),
        bestIndex: bestDeparture(departures, trip.departure),
      };
    }),
  );
  const recommendedRouteIndex = recommendRoute(analyzed);
  const warnings: string[] = [];
  if (weather.some((t) => !t))
    warnings.push(
      "Some forecast locations are unavailable. Incomplete routes are excluded from recommendations.",
    );
  if (analyzed.some((r) => r.departures.some((o) => o.riskScore === null)))
    warnings.push(
      "Some departure windows lack complete forecast coverage and cannot be scored.",
    );
  if (routes.length === 1)
    warnings.push(
      "The routing provider returned one practical route; no alternatives were invented.",
    );
  const r = analyzed[recommendedRouteIndex >= 0 ? recommendedRouteIndex : 0];
  const best = r.departures[r.bestIndex];
  const selection = r.departures[r.selectedIndex];
  const label = best
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: origin.timezone,
        timeZoneName: "short",
      }).format(new Date(best.departureTime))
    : "";
  const recommendation = best
    ? `Leaving ${label} on ${r.route.name} has the lowest modeled weather risk among this route’s analyzed windows${selection.riskScore !== null ? `, ${selection.riskScore - best.riskScore!} points below your selected departure` : ""}. Routes are compared at your selected departure, with a modest travel-time penalty.`
    : "Forecast coverage is insufficient for a departure recommendation. Try again later.";
  d.totalMs = Math.round((performance.now() - start) * 100) / 100;
  return {
    origin,
    destination,
    routes: analyzed,
    recommendedRouteIndex,
    recommendation,
    warnings,
    generatedAt: new Date().toISOString(),
    weatherFetchedAt:
      weather
        .filter((t) => t !== null)
        .map((t) => t.fetchedAt)
        .sort()[0] ?? null,
    ...(includeDiagnostics ? { diagnostics: d } : {}),
  };
}
