import { sampleRoute } from "./geometry";
import { matchWeather } from "./weather";
import { aggregateRisk, calculateSegmentRisk } from "./risk";
import type {
  RouteData,
  Timeline,
  DepartureOption,
  AnalyzedRoute,
} from "./types";
export function candidateDepartures(
  selected: string,
  now = Date.now(),
): string[] {
  return [-6, -3, 0, 3, 6, 9]
    .map((h) => Date.parse(selected) + h * 3600000)
    .filter((t) => t >= now && t <= now + 7 * 86400000)
    .map((t) => new Date(t).toISOString());
}
export function evaluateDeparture(
  route: RouteData,
  departureTime: string,
  timelines: (Timeline | null)[],
): DepartureOption {
  const conditions = sampleRoute(route, departureTime).map((sample, i) => {
    const weather = matchWeather(timelines[i], sample.estimatedArrivalTime);
    return {
      sample,
      weather,
      risk: weather ? calculateSegmentRisk(weather) : null,
    };
  });
  const aggregate = aggregateRisk(conditions);
  return {
    departureTime,
    conditions,
    aggregate,
    riskScore: aggregate.overallScore,
    severity: aggregate.severity,
  };
}
export function bestDeparture(
  options: DepartureOption[],
  selected: string,
): number {
  return options.reduce((best, o, i) => {
    if (o.riskScore === null) return best;
    if (best < 0) return i;
    const b = options[best];
    return o.riskScore < b.riskScore! ||
      (o.riskScore === b.riskScore &&
        Math.abs(Date.parse(o.departureTime) - Date.parse(selected)) <
          Math.abs(Date.parse(b.departureTime) - Date.parse(selected)))
      ? i
      : best;
  }, -1);
}
export function recommendRoute(routes: AnalyzedRoute[]): number {
  const fastest = Math.min(...routes.map((r) => r.route.durationSeconds));
  let best = -1,
    utility = Infinity;
  routes.forEach((r, i) => {
    const score = r.departures[r.selectedIndex]?.riskScore;
    if (score === null || score === undefined) return;
    const u = score + 20 * (r.route.durationSeconds / fastest - 1);
    if (u < utility) {
      utility = u;
      best = i;
    }
  });
  return best;
}
