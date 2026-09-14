# StormRoute | Next.js, React, TypeScript, Tailwind CSS, Zod, Leaflet, Recharts, Vitest

## Verified engineering

- Implemented real geocoding, OSRM road geometry and alternatives, distance-based sampling, ETA-aware hourly weather matching, deterministic risk scoring, and departure comparison.
- Built bounded TTL caches with in-flight coalescing, multi-location weather batching, controlled concurrency, request pacing, timeouts, and partial-forecast handling.
- Implemented an interactive risk-colored map, linked departure/timeline views, weighted exposure metrics, and component explanations.

## Verified metrics

- 82 passing tests in 3 files; 98.5% domain-line coverage (329/334), 94.02% branch coverage. UI coverage is not included.
- 12 TypeScript files in src/lib: analyze.ts, budget.ts, cache.ts, format.ts, geometry.ts, optimization.ts, providers.ts, risk-config.ts, risk.ts, types.ts, validation.ts, weather.ts. This count includes types, configuration, and formatting; it is not a claim of 12 independent algorithms.
- Four real benchmark trips completed. Ann Arbor → Chicago: 240 miles, 11 primary-route samples, 23 samples across 2 routes, and 6 departure windows per route.
- Ann Arbor → Chicago: 2994.02 ms cold, 2.73 ms immediate warm analysis; 99.91% reduction in this one measured pair. Weather HTTP requests: 2 cold, 0 warm.
- Seven local production HTTP scenarios passed; lint and production build passed. Desktop/mobile browser checks and departure switching passed with no captured browser errors.
- No live deployment claimed: the upload requires explicit approval after automatic approval review blocked it.

## Potential 3 resume bullets

- Built a full-stack weather-aware routing engine in Next.js and TypeScript, aligning distance-sampled road geometry with driver ETAs and hourly forecasts to compare six departure windows and genuine route alternatives.
- Designed an explainable weather-risk model with six normalized factors, dominant-hazard handling, and distance-weighted exposure; verified domain behavior with 82 tests and 98.5% line coverage.
- Implemented batched forecasts, bounded concurrency, and coalescing TTL caches; measured Ann Arbor–Chicago analysis at 2994 ms cold versus 2.73 ms warm in a single-process benchmark, eliminating weather HTTP requests on the immediate repeat.

## Measurement boundaries

Measured 2026-09-14T00:21:45.219Z. Single cold/warm runs, not a statistical load test. Cache clearing affects application caches only. The timing excludes browser/network response latency. Risk reductions are heuristic-score reductions, never accident-risk reductions. Full raw measurements and stage timings are in measurements/benchmark.json.
