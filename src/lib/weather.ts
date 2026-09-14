import type { Timeline, WeatherSnapshot } from "./types";
// Nearest hourly forecast, with an explicit half-hour tolerance and no extrapolation.
export function matchWeather(
  timeline: Timeline | null,
  eta: string,
): WeatherSnapshot | null {
  if (!timeline || !timeline.times.length) return null;
  const target = Date.parse(eta);
  if (
    !Number.isFinite(target) ||
    target < timeline.times[0] ||
    target > timeline.times.at(-1)!
  )
    return null;
  let lo = 0,
    hi = timeline.times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timeline.times[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const index =
    lo > 0 && target - timeline.times[lo - 1] < timeline.times[lo] - target
      ? lo - 1
      : lo;
  return Math.abs(timeline.times[index] - target) <= 1800000
    ? (timeline.values[index] ?? null)
    : null;
}
