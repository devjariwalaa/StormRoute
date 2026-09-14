export const miles = (m: number) => Math.round(m / 1609.344);
export const duration = (s: number) =>
  `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
export const time = (iso: string, zone?: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(iso));
export const fahrenheit = (c: number) => Math.round((c * 9) / 5 + 32);
export const colors = {
  low: "#59d8b2",
  moderate: "#f0c56c",
  high: "#f09365",
  severe: "#ef6c89",
  unknown: "#8995aa",
};
