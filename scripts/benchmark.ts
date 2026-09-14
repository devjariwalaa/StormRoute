import { mkdir, writeFile } from "node:fs/promises";
import { analyze } from "../src/lib/analyze";
import { clearCaches } from "../src/lib/providers";
const pairs = [
  ["Ann Arbor, MI", "Chicago, IL"],
  ["Detroit, MI", "Cleveland, OH"],
  ["Chicago, IL", "Indianapolis, IN"],
  ["Ann Arbor, MI", "Columbus, OH"],
];
const results = [];
const departure = new Date(Date.now() + 86400000);
departure.setUTCMinutes(0, 0, 0);
for (const [origin, destination] of pairs) {
  clearCaches();
  const input = { origin, destination, departure: departure.toISOString() };
  const cold = await analyze(input, true);
  const warm = await analyze(input, true);
  if (
    cold.routes[0].departures[cold.routes[0].selectedIndex].riskScore === null
  )
    throw new Error(`Incomplete real weather coverage for ${origin}`);
  const r = cold.routes[0];
  results.push({
    route: `${origin} → ${destination}`,
    miles: Math.round(r.route.distanceMeters / 1609.344),
    samples: cold.diagnostics!.sampleCount,
    primarySamples: r.departures[0].conditions.length,
    coldMs: cold.diagnostics!.totalMs,
    warmMs: warm.diagnostics!.totalMs,
    latencyReductionPercent:
      Math.round(
        (1 - warm.diagnostics!.totalMs / cold.diagnostics!.totalMs) * 10000,
      ) / 100,
    warmCacheHits: warm.diagnostics!.cacheHits,
    coldWeatherRequests: cold.diagnostics!.weatherRequests,
    warmWeatherRequests: warm.diagnostics!.weatherRequests,
    departureWindows: r.departures.length,
    routes: cold.routes.length,
    stages: cold.diagnostics!.stages,
  });
  await mkdir("docs/measurements", { recursive: true });
  await writeFile(
    "docs/measurements/latest-analysis.json",
    JSON.stringify(cold, null, 2),
  );
}
console.table(
  results.map(({ stages, ...r }) => ({ ...r, stages: JSON.stringify(stages) })),
);
await writeFile(
  "docs/measurements/benchmark.json",
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      departure: departure.toISOString(),
      method:
        "Real upstream calls; each route clears application caches, then runs once cold and once warm in one process. Not a load test or statistical benchmark.",
      results,
    },
    null,
    2,
  ),
);
