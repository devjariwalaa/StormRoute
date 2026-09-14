"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Route,
  CloudSun,
  Clock3,
  ShieldCheck,
  Navigation,
  ArrowDownUp,
  LoaderCircle,
} from "lucide-react";
import type { Analysis } from "@/lib/types";
import Dashboard from "./dashboard";
function localInput() {
  const d = new Date(Date.now() + 24 * 3600000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const stages = [
  "Finding your driving route",
  "Sampling distance and arrival times",
  "Fetching forecasts along the road",
  "Evaluating modeled weather risk",
  "Comparing departure windows",
];
export default function StormRoute() {
  const [origin, setOrigin] = useState("Ann Arbor, MI");
  const [destination, setDestination] = useState("Chicago, IL");
  const [departure, setDeparture] = useState("");
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(0);
  useEffect(() => {
    // The browser timezone is unavailable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeparture(localInput());
  }, []);
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(
      () => setStage((s) => Math.min(s + 1, stages.length - 1)),
      2200,
    );
    return () => clearInterval(id);
  }, [loading]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStage(0);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          departure: new Date(departure).toISOString(),
        }),
        signal: AbortSignal.timeout(90000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Analysis unavailable.");
      setData(result);
      setTimeout(
        () =>
          document
            .getElementById("results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to analyze this trip.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <header className="site-header">
        <a href="#" className="brand">
          <span className="brand-icon">
            <Navigation size={20} fill="currentColor" />
          </span>
          StormRoute<span className="beta">BETA</span>
        </a>
        <nav>
          <a href={data ? "#about" : "#how-it-works"}>How it works</a>
          <a href="#about">
            About the model <ArrowUpRight size={13} />
          </a>
          <span className="nav-label">
            <span /> Real forecasts. Clearer decisions.
          </span>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-tag">
              <span /> WEATHER-AWARE ROAD TRIPS
            </div>
            <h1>
              Know the weather
              <br />
              before it reaches
              <br />
              <span>the road.</span>
            </h1>
            <p>
              Analyze weather across your entire drive
              <br className="desktop-break" /> and find a safer time to leave.
            </p>
            <div className="hero-features">
              <span>
                <Route size={15} /> Real driving routes
              </span>
              <span>
                <Clock3 size={15} /> Arrival-aware forecasts
              </span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="radar-ring r1" />
            <div className="radar-ring r2" />
            <div className="radar-ring r3" />
            <svg viewBox="0 0 580 380">
              <defs>
                <pattern
                  id="grid"
                  width="48"
                  height="48"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 48 0 L 0 0 0 48"
                    fill="none"
                    stroke="#26364a"
                    strokeWidth=".6"
                  />
                </pattern>
              </defs>
              <rect width="580" height="380" fill="url(#grid)" />
              <g fill="none" stroke="#2a3a4c" strokeWidth="2">
                <path d="M0 250L160 250L240 190L420 190L580 120M100 0L180 130L180 300L240 380M0 85L290 85L440 250L580 250M380 0L350 130L490 380" />
                <path d="M0 290L140 290L280 210L430 210L580 150M70 0L140 150L140 380" />
              </g>
              <path
                d="M96 287C159 291 183 260 206 225S284 210 303 171S355 117 393 114L469 88"
                fill="none"
                stroke="#102e31"
                strokeWidth="17"
              />
              <path
                d="M96 287C159 291 183 260 206 225S284 210 303 171S355 117 393 114L469 88"
                fill="none"
                stroke="#59d8b2"
                strokeWidth="4"
                strokeDasharray="5 3"
              />
              <circle
                cx="96"
                cy="287"
                r="8"
                fill="#59d8b2"
                stroke="#fff"
                strokeWidth="3"
              />
              <circle
                cx="469"
                cy="88"
                r="8"
                fill="#59d8b2"
                stroke="#fff"
                strokeWidth="3"
              />
            </svg>
            <div className="art-label start">
              YOUR START <span>A</span>
            </div>
            <div className="art-label end">
              YOUR DESTINATION <span>B</span>
            </div>
            <div className="floating-note">
              <CloudSun size={24} />
              <div>
                Forecast the journey.<small>Not just the destination.</small>
              </div>
            </div>
            <small className="illustration-label">
              Conceptual route illustration · analyze a trip for live data
            </small>
          </div>
        </section>
        <section className="planner card">
          <div className="planner-top">
            <h2>Every good trip starts with a little foresight.</h2>
            <span className="small muted">Plan your next 6 days</span>
          </div>
          <form onSubmit={submit}>
            <label>
              <span>FROM</span>
              <div className="input-shell">
                <span className="input-dot" />
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="City, state or country"
                />
              </div>
            </label>
            <button
              type="button"
              className="swap"
              aria-label="Swap origin and destination"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              <ArrowDownUp size={17} />
            </button>
            <label>
              <span>TO</span>
              <div className="input-shell">
                <span className="input-square" />
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="City, state or country"
                />
              </div>
            </label>
            <label className="date-label">
              <span>DEPARTURE · YOUR DEVICE TIME</span>
              <input
                aria-label="Departure date and time in your device timezone"
                required
                type="datetime-local"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
              />
            </label>
            <button className="analyze-button" disabled={loading}>
              {loading ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Route size={18} />
              )}{" "}
              {loading ? "Analyzing…" : "Analyze Route"}{" "}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>
          <div className="examples">
            <span>Try a drive</span>
            {[
              ["Ann Arbor, MI", "Chicago, IL"],
              ["Detroit, MI", "Cleveland, OH"],
              ["Chicago, IL", "Indianapolis, IN"],
            ].map(([a, b]) => (
              <button
                key={a + b}
                onClick={() => {
                  setOrigin(a);
                  setDestination(b);
                }}
              >
                {a.split(",")[0]} <span>→</span> {b.split(",")[0]}
              </button>
            ))}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {loading && (
            <div className="loading-state" role="status" aria-live="polite">
              <div className="loading-bar">
                <span style={{ width: `${15 + stage * 18}%` }} />
              </div>
              <strong>{stages[stage]}…</strong>
              <small>
                Analysis is running. These are the pipeline steps, not live
                server progress.
              </small>
            </div>
          )}
        </section>
        <div id="results" aria-live="polite">
          {data && <Dashboard key={data.generatedAt} data={data} />}
        </div>
        {!data && (
          <section id="how-it-works" className="how-it-works">
            <div className="section-heading">
              <div>
                <p className="eyebrow">A FORECAST THAT MOVES WITH YOU</p>
                <h2>The whole drive. A clearer picture.</h2>
              </div>
              <p className="muted">From your first mile to your final turn.</p>
            </div>
            <div className="feature-grid">
              <article>
                <span className="feature-icon">
                  <Route size={23} />
                </span>
                <small>01 / TRACE THE DRIVE</small>
                <h3>Weather on your route</h3>
                <p>
                  Real road geometry, sampled by distance. See conditions where
                  you’ll actually be driving.
                </p>
              </article>
              <article>
                <span className="feature-icon">
                  <Clock3 size={23} />
                </span>
                <small>02 / MATCH THE MOMENT</small>
                <h3>Right place. Right time.</h3>
                <p>
                  Forecasts aligned to your estimated arrival, so the weather
                  moves with your journey.
                </p>
              </article>
              <article>
                <span className="feature-icon">
                  <ShieldCheck size={23} />
                </span>
                <small>03 / COMPARE YOUR OPTIONS</small>
                <h3>A better time to leave</h3>
                <p>
                  Compare nearby departure windows and practical routes for
                  lower modeled weather risk.
                </p>
              </article>
            </div>
          </section>
        )}
        <section className="model-note" id="about">
          <ShieldCheck size={20} />
          <div>
            <strong>Intelligence for planning. Judgment for the road.</strong>
            <p>
              StormRoute uses an independent, deterministic weather-risk
              heuristic. It is informational, not an official safety or
              navigation advisory. Check local alerts, road closures, and
              conditions before traveling. Your city queries and route sample
              coordinates are sent to the data providers to perform analysis.
            </p>
          </div>
          <span>NO AI REQUIRED</span>
        </section>
      </main>
      <footer>
        <a href="#" className="brand">
          <Navigation size={18} />
          StormRoute
        </a>
        <p>
          Forecasts & geocoding:{" "}
          <a href="https://open-meteo.com/">Open-Meteo</a> /{" "}
          <a href="https://www.geonames.org/">GeoNames</a> · Routing:{" "}
          <a href="https://routing.openstreetmap.de/about.html">
            OSRM / FOSSGIS
          </a>{" "}
          · Map data:{" "}
          <a href="https://www.openstreetmap.org/copyright">
            OpenStreetMap contributors
          </a>
        </p>
        <span>Built for the journey.</span>
      </footer>
    </>
  );
}
