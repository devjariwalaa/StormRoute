"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from "recharts";
import type { AnalyzedRoute } from "@/lib/types";
import { time } from "@/lib/format";
export default function DepartureChart({
  route,
  zone,
}: {
  route: AnalyzedRoute;
  zone: string;
}) {
  const data = route.departures.map((d, i) => ({
    label: time(d.departureTime, zone),
    risk: d.riskScore,
    kind:
      i === route.selectedIndex
        ? "Selected"
        : i === route.bestIndex
          ? "Lowest risk"
          : "Compared",
    severity: d.severity ?? "Unavailable",
  }));
  return (
    <div
      className="chart"
      role="img"
      aria-label="Departure risk comparison; exact values are available in the departure buttons below."
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 15, left: -25, bottom: 0 }}
        >
          <defs>
            <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#59d8b2" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#59d8b2" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#253248" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#9aa9be", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#9aa9be", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#111c2d",
              border: "1px solid #354159",
              borderRadius: 10,
              color: "#fff",
            }}
          />
          <Area
            type="linear"
            dataKey="risk"
            stroke="#59d8b2"
            strokeWidth={2}
            fill="url(#riskArea)"
            connectNulls={false}
          />
          {data.map((d, i) =>
            d.risk !== null &&
            (i === route.bestIndex || i === route.selectedIndex) ? (
              <ReferenceDot
                key={i}
                x={d.label}
                y={d.risk}
                r={5}
                fill={i === route.selectedIndex ? "#fff" : "#59d8b2"}
                stroke="#101827"
              />
            ) : null,
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
