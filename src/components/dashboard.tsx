"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  Clock3,
  Route,
  ShieldCheck,
  Wind,
  CloudRain,
  ChevronDown,
} from "lucide-react";
import type { Analysis } from "@/lib/types";
import { colors, duration, miles, time, fahrenheit } from "@/lib/format";
import DepartureChart from "./departure-chart";
const RouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">Loading interactive map…</div>
  ),
});
export default function Dashboard({ data }: { data: Analysis }) {
  const [routeIndex, setRouteIndex] = useState(0);
  const [departureIndex, setDepartureIndex] = useState(
    data.routes[0].selectedIndex,
  );
  const [focus, setFocus] = useState<number | null>(null);
  const route = data.routes[routeIndex];
  const option = route.departures[departureIndex];
  const selected = route.departures[route.selectedIndex];
  const best = route.departures[route.bestIndex];
  const score = option.riskScore;
  const color = colors[option.severity ?? "unknown"];
  const difference =
    best?.riskScore !== null && selected.riskScore !== null && best
      ? selected.riskScore - best.riskScore!
      : null;
  const ranked = option.conditions
    .map((c, i) => ({ ...c, index: i }))
    .filter((c) => c.risk)
    .sort((a, b) => b.risk!.score - a.risk!.score)
    .slice(0, 3);
  const contributions: Record<string, number> = {};
  option.conditions.forEach((c, i, all) => {
    const weight =
      (i === all.length - 1
        ? 1
        : (c.sample.progress + all[i + 1].sample.progress) / 2) -
      (i === 0 ? 0 : (all[i - 1].sample.progress + c.sample.progress) / 2);
    c.risk?.factors.forEach(
      (f) =>
        (contributions[f.type] =
          (contributions[f.type] ?? 0) + f.contribution * weight),
    );
  });
  const total = Object.values(contributions).reduce((a, b) => a + b, 0);
  return (
    <section className="dashboard" aria-label="Trip analysis">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR TRIP, IN PERSPECTIVE</p>
          <h2>
            {data.origin.name} <span className="muted">→</span>{" "}
            {data.destination.name}
          </h2>
          <p className="muted">
            {miles(route.route.distanceMeters)} miles{" "}
            <span className="dot">·</span>{" "}
            {duration(route.route.durationSeconds)} driving{" "}
            <span className="dot">·</span> {route.route.name}
          </p>
        </div>
        <span className="status">
          <span /> Forecast analyzed{" "}
          {time(data.generatedAt, data.origin.timezone)}
        </span>
      </div>
      <div className="metrics">
        <article className="card gauge-card">
          <div
            className="gauge"
            style={{
              background: `conic-gradient(from 225deg, ${color} 0deg ${(score ?? 0) * 2.7}deg, #263146 ${(score ?? 0) * 2.7}deg 270deg, transparent 270deg)`,
            }}
          >
            <div>
              <strong>{score ?? "—"}</strong>
              <small>/ 100</small>
            </div>
          </div>
          <div>
            <p className="eyebrow">MODELED ROUTE RISK</p>
            <b style={{ color }}>
              {option.severity?.toUpperCase() ?? "INCOMPLETE DATA"}
            </b>
            <p className="small muted">
              Viewing {time(option.departureTime, data.origin.timezone)}
            </p>
          </div>
        </article>
        <article className="card metric">
          <Clock3 size={18} />
          <p className="eyebrow">LOWEST-RISK DEPARTURE</p>
          <strong>
            {best
              ? time(best.departureTime, data.origin.timezone)
              : "Unavailable"}
          </strong>
          <p className="small muted">
            Within {route.departures.length} analyzed windows
          </p>
        </article>
        <article className="card metric">
          <ShieldCheck size={18} />
          <p className="eyebrow">POTENTIAL IMPROVEMENT</p>
          <strong>
            {difference ?? "—"} <span>points</span>
          </strong>
          <p className="small muted">
            {difference !== null && selected.riskScore
              ? `${Math.round((difference / selected.riskScore) * 100)}% lower modeled risk`
              : "Compared with selected departure"}
          </p>
        </article>
      </div>
      <div className="recommendation">
        <ShieldCheck size={22} />
        <p>{data.recommendation}</p>
        <ArrowUpRight size={20} />
      </div>
      {data.warnings.map((w) => (
        <p className="warning" key={w}>
          {w}
        </p>
      ))}
      <div className="main-grid">
        <article className="card map-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">WEATHER MEETS THE ROAD</p>
              <h3>Your route forecast</h3>
            </div>
            <span className="small muted">
              {option.conditions.length} sample locations
            </span>
          </div>
          <RouteMap
            route={route}
            option={option}
            focus={focus}
            zone={data.origin.timezone}
          />
          <div className="map-footer">
            {Object.entries(colors).map(([label, c]) => (
              <span key={label}>
                <i style={{ background: c }} />
                {label}
              </span>
            ))}
            <a
              href="https://www.openstreetmap.org/fixthemap"
              target="_blank"
              rel="noreferrer"
            >
              Fix the map ↗
            </a>
          </div>
        </article>
        <article className="card comparison">
          <p className="eyebrow">A BETTER WINDOW</p>
          <h3>Compare departures</h3>
          <p className="small muted">Same road. Different conditions.</p>
          <DepartureChart route={route} zone={data.origin.timezone} />
          <div className="departure-options">
            {route.departures.map((d, i) => (
              <button
                key={d.departureTime}
                aria-pressed={departureIndex === i}
                onClick={() => setDepartureIndex(i)}
                className={departureIndex === i ? "active" : ""}
              >
                <span>
                  {time(d.departureTime, data.origin.timezone)}
                  <small>
                    {i === route.selectedIndex
                      ? "Your selection"
                      : i === route.bestIndex
                        ? "Lowest modeled risk"
                        : "Alternative window"}
                  </small>
                </span>
                <b style={{ color: colors[d.severity ?? "unknown"] }}>
                  {d.riskScore ?? "—"}
                </b>
              </button>
            ))}
          </div>
        </article>
      </div>
      <div className="lower-grid">
        <article className="card timeline-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">MILE BY MILE</p>
              <h3>Weather along your drive</h3>
            </div>
            <CloudRain size={21} />
          </div>
          <div className="timeline">
            {option.conditions.map((c, i) => (
              <button
                key={i}
                onClick={() => setFocus(i)}
                className="timeline-row"
              >
                <span
                  className="timeline-dot"
                  style={{ background: colors[c.risk?.severity ?? "unknown"] }}
                />
                <span>
                  <strong>
                    {i === 0
                      ? data.origin.name
                      : i === option.conditions.length - 1
                        ? data.destination.name
                        : `Mile ${miles(c.sample.distanceFromStartMeters)}`}
                  </strong>
                  <small>
                    {time(c.sample.estimatedArrivalTime, data.origin.timezone)}
                  </small>
                </span>
                <span className="weather-reading">
                  {c.weather ? `${fahrenheit(c.weather.temperature)}°F` : "—"}
                  <small>
                    {c.risk?.factors[0]?.message ??
                      (c.weather
                        ? "Minimal modeled weather hazards"
                        : "Forecast unavailable")}
                  </small>
                </span>
                <b style={{ color: colors[c.risk?.severity ?? "unknown"] }}>
                  {c.risk?.score ?? "—"}
                </b>
              </button>
            ))}
          </div>
        </article>
        <div className="stack">
          <article className="card breakdown">
            <p className="eyebrow">BEHIND THE SCORE</p>
            <h3>Risk drivers</h3>
            {total ? (
              Object.entries(contributions)
                .sort((a, b) => b[1] - a[1])
                .map(([name, value]) => (
                  <div className="driver" key={name}>
                    <div>
                      <span>{name}</span>
                      <b>{Math.round((value / total) * 100)}%</b>
                    </div>
                    <div className="track">
                      <span style={{ width: `${(value / total) * 100}%` }} />
                    </div>
                  </div>
                ))
            ) : (
              <p className="muted">
                {score === null
                  ? "Insufficient weather data."
                  : "No material modeled hazards."}
              </p>
            )}
            <p className="small muted">
              Distance-weighted component shares before the dominant-hazard
              adjustment.
            </p>
          </article>
          <article className="card exposure">
            <Wind size={20} />
            <h3>Exposure at a glance</h3>
            <div>
              <span>Peak sample risk</span>
              <b>{option.aggregate.maximumScore ?? "—"}/100</b>
            </div>
            <div>
              <span>High or severe exposure</span>
              <b>{option.aggregate.highRiskExposurePercent.toFixed(1)}%</b>
            </div>
            <div>
              <span>Severe exposure</span>
              <b>{option.aggregate.severeRiskExposurePercent.toFixed(1)}%</b>
            </div>
            <div>
              <span>Forecast coverage</span>
              <b>{option.aggregate.coveragePercent.toFixed(0)}%</b>
            </div>
          </article>
        </div>
      </div>
      <article className="card high-risk">
        <p className="eyebrow">PAY ATTENTION HERE</p>
        <h3>Highest modeled risk locations</h3>
        <div className="risk-locations">
          {ranked.map((c) => (
            <button key={c.index} onClick={() => setFocus(c.index)}>
              <span
                className="risk-number"
                style={{ color: colors[c.risk!.severity] }}
              >
                {c.risk!.score}
              </span>
              <span>
                <strong>Mile {miles(c.sample.distanceFromStartMeters)}</strong>
                <small>
                  {time(c.sample.estimatedArrivalTime, data.origin.timezone)} ·{" "}
                  {c.risk!.severity}
                </small>
                <small>
                  {c.risk!.factors[0]?.message ?? "Minimal modeled hazards"}
                </small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </article>
      <details className="card details" open={data.routes.length > 1}>
        <summary>
          <Route size={19} /> Route alternatives & trip details{" "}
          <ChevronDown size={18} />
        </summary>
        <div className="alternatives">
          {data.routes.map((r, i) => (
            <button
              key={r.route.id}
              className={routeIndex === i ? "active" : ""}
              onClick={() => {
                setRouteIndex(i);
                setDepartureIndex(r.selectedIndex);
                setFocus(null);
              }}
            >
              <strong>{r.route.name}</strong>
              <span>
                {duration(r.route.durationSeconds)} ·{" "}
                {miles(r.route.distanceMeters)} mi
              </span>
              <span>
                Selected-departure risk:{" "}
                {r.departures[r.selectedIndex].riskScore ?? "Unavailable"}
              </span>
              <small>
                {i === data.recommendedRouteIndex
                  ? "Recommended balance of weather risk and duration"
                  : i === 0
                    ? "Fastest driving route"
                    : "Provider-returned alternative"}
              </small>
            </button>
          ))}
        </div>
        <p className="small muted">
          All result times use {data.origin.timezone}. ETAs assume steady
          progress without stops or live traffic. Oldest forecast fetch{" "}
          {data.weatherFetchedAt
            ? time(data.weatherFetchedAt, data.origin.timezone)
            : "unavailable"}
          . Sampling is capped at 24 points per route; small hazards between
          samples may be missed.
        </p>
      </details>
      {data.diagnostics && (
        <details className="card details">
          <summary>
            Development diagnostics <ChevronDown size={16} />
          </summary>
          <pre>{JSON.stringify(data.diagnostics, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
