# StormRoute: interview notes

## The problem

A destination forecast says little about a multi-hour drive. Weather changes across space and time. StormRoute asks where the driver will be when each forecast applies, then compares departure windows and actual alternative roads.

## The architecture in one minute

A Next.js route handler validates a trip, resolves cities, asks OSRM for road geometry, samples that geometry by distance, estimates arrival times, batches Open-Meteo forecasts, aligns each ETA to an hourly forecast, computes deterministic risk, and compares departure/route options. React receives normalized results and visualizes them. Pure functions are independent from HTTP and React.

## Why Next.js?

One strict TypeScript codebase holds server adapters and the interface, without exposing provider calls across components. Route handlers work locally and on Vercel. The tradeoff is that serverless caches and rate limits are per instance, so a scaled deployment needs shared coordination or a different hosting/provider arrangement.

## How routing works

OSRM uses OpenStreetMap's road network to return a real driving route and optional alternatives. I normalize distance, duration, geometry, and names behind a domain interface. Only returned alternatives under the detour cap are evaluated. This is a replaceable external routing engine; I did not implement shortest-path search from raw OSM data.

## How sampling works

I compute cumulative haversine distances along the full polyline. For each target distance, binary search identifies the containing edge, then interpolation locates the point inside it. Selecting every Nth vertex would over-sample curvy areas and under-sample long straight roads. Sampling is capped at 24 points per route to bound upstream usage.

## ETA and weather matching

Progress along the route times the provider duration gives an approximate ETA. Each ETA selects the nearest hourly forecast, with a 30-minute tolerance and no extrapolation. Internal time is UTC; display uses the origin timezone. I canonicalize input timestamps so equivalent offsets do not create duplicate departure candidates. I do not claim live traffic or per-edge ETA precision.

## Batching and concurrency

The weather provider accepts multiple coordinates. Each batch has up to 12 points, two workers, and globally paced starts within the process. One timeline serves every departure candidate. Origin/destination geocoding also runs concurrently. In-flight cache coalescing prevents duplicate requests for identical keys.

## Risk scoring

Six continuous components measure precipitation, snow, wind, visibility, temperature, and storm context. The model avoids summing correlated wind and gust signals and avoids scoring snowfall twice as rain. A dominant-hazard floor ensures extreme isolated conditions remain visible. The route combines distance-weighted average, maximum, and high-risk exposure. The model is explainable but uncalibrated: its scores are not collision probabilities.

## Departure optimization

I compare up to six nearby times on already-fetched road geometry and hourly timelines. The driver position stays fixed at each sample but ETA shifts, producing different weather matches. Complete candidates are ranked by modeled risk; ties prefer the requested time. Alternative routes use a documented risk-plus-travel-time utility at the requested departure.

## Caching

Geocoding lives for 24 hours, routes one hour, forecasts ten minutes. Bounded maps prevent unlimited memory growth. Expired entries miss; identical active loads share a promise; rejected promises do not poison the cache. Warm benchmark times measure application-cache reuse in one process, not an internet request or a statistically established production speedup.

## Hardest engineering problem

The central challenge is maintaining truthful correspondence across road geometry, sample index, ETA, provider batch order, forecast hours, and UI geometry while evaluating several departures and routes. An index mismatch could produce convincing but geographically incorrect weather. Domain interfaces, explicit coordinate order, UTC instants, length checks, and missing-data handling make that alignment inspectable.

## Tradeoffs

- Proportional ETAs are explainable but ignore segment speeds and traffic.
- Nearest-hour matching respects source resolution but is stepwise.
- A sample cap bounds API usage but misses smaller hazards on long trips.
- In-memory caches are inexpensive and fast but reset on restart and do not coordinate instances.
- A deterministic heuristic is auditable and free, but needs validation against observations and outcomes.
- Public APIs make a $0 demo possible but have usage limits and no availability guarantee.

## Failure modes

Invalid/ambiguous cities return actionable messages. Same-location trips are rejected after both text validation and geographic checks. Routing or malformed geometry fails the request. Weather failures mark affected locations missing; incomplete candidates cannot win. Timed-out calls abort rather than hanging. Quotas/capacity return limits instead of issuing unbounded requests. The health endpoint only reports application liveness.

## Scaling

First establish traffic and upstream quota needs. Then use a suitable routing service or an operated OSRM instance, a shared bounded cache/rate limiter, request-level cancellation, and observability. A database is not needed for the current stateless trip calculation. It becomes justified if saved trips, user preferences, or historical analysis are added.

## What I would improve

Per-edge OSRM duration interpolation; forecast uncertainty; official alerts and road closures; separate models for vehicle types; a geographically representative validation corpus; distributed quota enforcement before broad promotion; richer mixed-precipitation handling; historical replay using actual archive data. These are future work, not implemented claims.

## Demo sequence

Run Ann Arbor, MI → Chicago, IL for tomorrow. Explain the real road geometry, click another departure, show the ETA/weather timeline change without a new server request, inspect a sample popup, compare any provider-returned alternative, then open the risk-model documentation and measured benchmark JSON. Finish by demonstrating a missing city error and explaining why incomplete forecasts cannot receive a low score.

## Resume honesty

Use the exact current measurements in `measurements/benchmark.json` and `verified-summary.md`. Say “modeled weather risk,” not “reduced accidents.” The 1,500 generated weather inputs are an invariant test, not 1,500 separate tests. Distinguish function timing from end-to-end HTTP/UI latency. Do not claim deployment, traffic, or production reliability beyond the recorded verification.
