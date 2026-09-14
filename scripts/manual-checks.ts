import { writeFile, mkdir } from "node:fs/promises";
const departure = new Date(Date.now() + 86400000).toISOString();
const cases = [
  {
    name: "Ann Arbor → Chicago",
    origin: "Ann Arbor, MI",
    destination: "Chicago, IL",
    status: 200,
  },
  {
    name: "Detroit → Cleveland",
    origin: "Detroit, MI",
    destination: "Cleveland, OH",
    status: 200,
  },
  {
    name: "Chicago → Indianapolis",
    origin: "Chicago, IL",
    destination: "Indianapolis, IN",
    status: 200,
  },
  {
    name: "Short route",
    origin: "Ann Arbor, MI",
    destination: "Ypsilanti, MI",
    status: 200,
  },
  {
    name: "Invalid city",
    origin: "Qzxvnonexistentcity, MI",
    destination: "Chicago, IL",
    status: 400,
  },
  {
    name: "Same origin/destination",
    origin: "Chicago, IL",
    destination: "Chicago, IL",
    status: 400,
  },
  {
    name: "Outside forecast",
    origin: "Ann Arbor, MI",
    destination: "Chicago, IL",
    status: 400,
    departure: new Date(Date.now() + 20 * 86400000).toISOString(),
  },
];
const results = [];
for (const c of cases) {
  const r = await fetch("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: c.origin,
      destination: c.destination,
      departure: c.departure ?? departure,
    }),
  });
  const body = await r.json();
  if (r.status !== c.status)
    throw new Error(`${c.name}: ${r.status} ${JSON.stringify(body)}`);
  if (
    r.status === 200 &&
    body.routes[0].departures[body.routes[0].selectedIndex].riskScore === null
  )
    throw new Error(`${c.name}: incomplete forecast`);
  if (body.diagnostics) throw new Error("Production diagnostics leak");
  results.push({
    name: c.name,
    status: r.status,
    passed: true,
    routes: body.routes?.length,
    error: body.error,
  });
}
const health = await fetch("http://localhost:3000/api/health");
if (!health.ok) throw Error("Health failed");
await mkdir("docs/measurements", { recursive: true });
await writeFile(
  "docs/measurements/manual-checks.json",
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      results,
      health: await health.json(),
    },
    null,
    2,
  ),
);
console.table(results);
