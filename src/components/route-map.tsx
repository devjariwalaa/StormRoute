"use client";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import type { AnalyzedRoute, DepartureOption } from "@/lib/types";
import { segmentGeometry } from "@/lib/geometry";
import { colors, time, fahrenheit, miles } from "@/lib/format";
function View({
  route,
  focus,
}: {
  route: AnalyzedRoute;
  focus: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      route.route.geometry.map((p) => [p[1], p[0]] as [number, number]),
      { padding: [40, 40] },
    );
  }, [map, route]);
  useEffect(() => {
    if (focus !== null) {
      const c = route.departures[0].conditions[focus]?.sample.coordinate;
      if (c) map.flyTo([c[1], c[0]], 10, { duration: 0.8 });
    }
  }, [focus, map, route]);
  return null;
}
export default function RouteMap({
  route,
  option,
  focus,
  zone,
}: {
  route: AnalyzedRoute;
  option: DepartureOption;
  focus: number | null;
  zone: string;
}) {
  const segments = useMemo(
    () =>
      option.conditions.map((c, i, all) => {
        const left =
          i === 0 ? 0 : (all[i - 1].sample.progress + c.sample.progress) / 2;
        const right =
          i === all.length - 1
            ? 1
            : (c.sample.progress + all[i + 1].sample.progress) / 2;
        return {
          positions: segmentGeometry(route.route, left, right).map(
            (p) => [p[1], p[0]] as [number, number],
          ),
          color: colors[c.risk?.severity ?? "unknown"],
        };
      }),
    [route, option],
  );
  return (
    <MapContainer
      center={[42, -85]}
      zoom={6}
      className="route-map"
      scrollWheelZoom={false}
    >
      <TileLayer
        url={
          process.env.NEXT_PUBLIC_TILE_URL ??
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        }
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <View route={route} focus={focus} />
      <Polyline
        positions={route.route.geometry.map((p) => [p[1], p[0]])}
        pathOptions={{ color: "#101e31", weight: 10 }}
      />
      {segments.map((s, i) => (
        <Polyline
          key={i}
          positions={s.positions}
          pathOptions={{ color: s.color, weight: 5, opacity: 1 }}
        />
      ))}
      {option.conditions.map((c, i) => (
        <CircleMarker
          key={i}
          center={[c.sample.coordinate[1], c.sample.coordinate[0]]}
          radius={i === 0 || i === option.conditions.length - 1 ? 8 : 5}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: colors[c.risk?.severity ?? "unknown"],
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>
              {i === 0
                ? "Origin"
                : i === option.conditions.length - 1
                  ? "Destination"
                  : `Mile ${miles(c.sample.distanceFromStartMeters)}`}
            </strong>
            <p>ETA {time(c.sample.estimatedArrivalTime, zone)}</p>
            <b>
              {c.risk
                ? `${c.risk.score}/100 · ${c.risk.severity.toUpperCase()}`
                : "Forecast unavailable"}
            </b>
            {c.weather && (
              <p>
                {fahrenheit(c.weather.temperature)}°F · Rain{" "}
                {c.weather.precipitation.toFixed(1)} mm/h
                <br />
                Wind {Math.round(c.weather.windSpeed / 1.609)} mph · Gusts{" "}
                {Math.round(c.weather.windGusts / 1.609)} mph
                <br />
                Visibility {(c.weather.visibility / 1609).toFixed(1)} mi
              </p>
            )}
            {c.risk?.factors.slice(0, 3).map((f) => (
              <div key={f.type}>{f.message}</div>
            ))}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
