# Risk model v1

This is an original deterministic **informational heuristic**, not a calibrated collision probability, official road advisory, or assurance of safe driving. Parameters are engineering assumptions for a transparent portfolio model; they were not derived from crash outcomes. Always check official alerts, visibility, road closures, and local conditions.

## Units and normalization

Internal units: °C; precipitation/rain in mm per hour; snowfall in cm per hour; wind/gusts in km/h; visibility in meters. `clamp(x)` bounds continuous terms to [0,1]. The provider adapter treats missing required weather fields as unavailable.

| Component    | Normalized function                                                                           | Weight |
| ------------ | --------------------------------------------------------------------------------------------- | -----: |
| Rain         | `clamp(liquid / 8) × (0.6 + 0.4 × clamp(probability / 100))`                                  |     20 |
| Snow         | `clamp(snowfall / 2)`                                                                         |     25 |
| Wind         | `max(clamp((wind−20)/60), clamp((gust−30)/70))`                                               |     20 |
| Visibility   | `clamp(1−sqrt(max(0,visibility)/10000))`                                                      |     20 |
| Temperature  | When wet: `clamp((4−temperature)/8)`; when dry: `0.3 × clamp((−15−temperature)/20)`           |     10 |
| Weather code | Thunderstorms 95/96/99: 1; freezing rain 66/67: 0.9; freezing drizzle 56/57: 0.6; otherwise 0 |      5 |

`liquid` uses total precipitation when no snowfall is forecast, covering rain plus showers. During snowfall it uses the rain field to avoid counting snow's water equivalent again as rain. This can underrepresent concurrent showers during mixed precipitation. Wind uses the larger of sustained/gust contributions rather than adding correlated signals. Ordinary rain/snow codes contribute zero because amounts already capture those signals. Temperature represents an interaction with wet conditions, not road-surface temperature or measured ice.

## Segment score

For normalized components `r_i` and weights `w_i`:

```
weighted = Σ(w_i × r_i)
dominant = 75 × max(r_i)
segmentScore = round(min(100, max(weighted, dominant)))
```

The dominant-hazard floor prevents an isolated extreme visibility, snow, wind, or storm signal from being diluted by unrelated clear conditions. The weight sum is 100. Every valid segment score stays within [0,100]. An isolated saturated component therefore reaches at least 75, while multiple simultaneous hazards can reach 100.

Each factor exposes `weight × normalizedValue`, its name, and a deterministic explanation. The UI's component percentages are distance-weighted shares of these base contributions **before** the dominant-hazard floor. They are explicitly not a claim that the adjusted final score is the sum of the displayed percentages.

Severity boundaries are low 0–24, moderate 25–49, high 50–74, severe 75–100. These are descriptive buckets for this model only.

## Route exposure and aggregation

Each sample represents the road between the midpoints to its adjacent samples. Origin and destination represent half intervals. Let `p_i` be the resulting share of the entire route, `s_i` its score, and `H` the share scoring at least 50.

```
average = Σ(p_i × s_i) / coveredShare
maximum = max(s_i)
routeScore = round(min(100, 0.65 × average + 0.25 × maximum + 10 × H))
```

The final score is available only with complete coverage. High-risk exposure includes severe portions; severe-risk exposure counts only scores ≥75. The highest-risk location is also returned. A brief local peak influences the score more than a plain mean, but route severity need not equal maximum sample severity. All-75 conditions, for example, produce a route score of 78 after the exposure term. This is a designed nonlinear index, not a physical unit.

With missing observations, the known-data average and maximum may still be shown, but the final route score is null. Coverage and exposure use the whole-route denominator. Optimization excludes incomplete candidates instead of rewarding missing data.

## Departure and route comparison

Offsets: −6, −3, 0, +3, +6, +9 hours. Past or out-of-window departures are filtered. Complete forecast matching is still required for every sample, including arrival. Equal-risk departure ties favor the time nearest the requested departure.

Routes are compared at the selected departure by:

```
utility = routeRisk + 20 × (duration / fastestDuration − 1)
```

The lower utility wins. A route 20% slower incurs four modeled-risk-equivalent utility points. This is a documented product preference, not an empirically validated optimum. Only routes within 35% of fastest and returned by the provider are candidates. Departure optimization then reports the best time for the chosen route. This is not a claim of a globally optimal route/departure search.

Absolute modeled improvement is selected score minus best score. Relative improvement divides by selected score, only when it is nonzero. Never interpret that percentage as a crash-risk reduction.

## Important limitations

Hourly forecasts and sparse samples can miss short storms, fog banks, bridges, elevation transitions, local ice, and road treatment. No ground-truth validation has been performed. Coarse proportional ETAs omit speed variation, traffic, stops, and driver behavior. Vehicle type, tires, skill, fatigue, official alerts, flooding depths, and road closures are not inputs. Forecast uncertainty grows with lead time, and a small difference between low scores should not be overinterpreted.

## Testing

Tests cover component monotonicity and saturation, severity edges, nonlinear visibility, wet/dry temperature behavior, correlated-signal handling, dominant extreme hazards, distance weighting, incomplete coverage, local peaks, tie-breaking, and 1,500 deterministic varied weather inputs within a single invariant test. Synthetic fixtures are only tests; they are never presented as real route weather.
