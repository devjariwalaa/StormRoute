import type { Coordinate, RouteData, RouteSample } from "./types";
const R = 6371008.8;
export function haversine(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dlat = (b[1] - a[1]) * rad,
    dlon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function cumulativeDistances(points: Coordinate[]): number[] {
  if (points.length < 2)
    throw new Error("Route must contain at least two coordinates.");
  const out = [0];
  for (let i = 1; i < points.length; i++)
    out.push(out[i - 1] + haversine(points[i - 1], points[i]));
  if (out.at(-1) === 0) throw new Error("Route has no length.");
  return out;
}
export function interpolate(
  a: Coordinate,
  b: Coordinate,
  t: number,
): Coordinate {
  const f = Math.max(0, Math.min(1, t));
  const delta = ((b[0] - a[0] + 540) % 360) - 180;
  return [((a[0] + delta * f + 540) % 360) - 180, a[1] + (b[1] - a[1]) * f];
}
export function pointAt(
  points: Coordinate[],
  cumulative: number[],
  distance: number,
): Coordinate {
  const d = Math.max(0, Math.min(cumulative.at(-1)!, distance));
  let lo = 1,
    hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const span = cumulative[lo] - cumulative[lo - 1];
  return interpolate(
    points[lo - 1],
    points[lo],
    span ? (d - cumulative[lo - 1]) / span : 0,
  );
}
export function sampleRoute(
  route: RouteData,
  departure: string,
): RouteSample[] {
  const cum = cumulativeDistances(route.geometry),
    total = cum.at(-1)!;
  const intervals = Math.min(23, Math.max(2, Math.ceil(total / 40000)));
  return Array.from({ length: intervals + 1 }, (_, i) => {
    const progress = i / intervals;
    return {
      coordinate: pointAt(route.geometry, cum, total * progress),
      distanceFromStartMeters: route.distanceMeters * progress,
      progress,
      estimatedArrivalTime: new Date(
        Date.parse(departure) + route.durationSeconds * 1000 * progress,
      ).toISOString(),
    };
  });
}
export function segmentGeometry(
  route: RouteData,
  start: number,
  end: number,
): Coordinate[] {
  const cum = cumulativeDistances(route.geometry),
    total = cum.at(-1)!;
  return [
    pointAt(route.geometry, cum, start * total),
    ...route.geometry.filter(
      (_, i) => cum[i] > start * total && cum[i] < end * total,
    ),
    pointAt(route.geometry, cum, end * total),
  ];
}
