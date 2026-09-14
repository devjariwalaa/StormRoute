export type Coordinate = [number, number]; // longitude, latitude
export type Severity = "low" | "moderate" | "high" | "severe";
export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone: string;
}
export interface RouteData {
  id: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: Coordinate[];
}
export interface RouteSample {
  coordinate: Coordinate;
  distanceFromStartMeters: number;
  progress: number;
  estimatedArrivalTime: string;
}
export interface WeatherSnapshot {
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  weatherCode: number;
  visibility: number;
  windSpeed: number;
  windGusts: number;
}
export interface Timeline {
  times: number[];
  values: (WeatherSnapshot | null)[];
  fetchedAt: string;
}
export interface Factor {
  type: string;
  contribution: number;
  message: string;
}
export interface SegmentRisk {
  score: number;
  severity: Severity;
  factors: Factor[];
}
export interface RouteCondition {
  sample: RouteSample;
  weather: WeatherSnapshot | null;
  risk: SegmentRisk | null;
}
export interface Aggregate {
  overallScore: number | null;
  severity: Severity | null;
  averageScore: number | null;
  maximumScore: number | null;
  highRiskExposurePercent: number;
  severeRiskExposurePercent: number;
  coveragePercent: number;
  highestRiskSegment: number;
}
export interface DepartureOption {
  departureTime: string;
  riskScore: number | null;
  severity: Severity | null;
  conditions: RouteCondition[];
  aggregate: Aggregate;
}
export interface AnalyzedRoute {
  route: RouteData;
  departures: DepartureOption[];
  selectedIndex: number;
  bestIndex: number;
}
export interface Diagnostics {
  stages: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
  weatherRequests: number;
  geometryPoints: number;
  sampleCount: number;
  totalMs: number;
}
export interface Analysis {
  origin: Location;
  destination: Location;
  routes: AnalyzedRoute[];
  recommendedRouteIndex: number;
  recommendation: string;
  warnings: string[];
  generatedAt: string;
  weatherFetchedAt: string | null;
  diagnostics?: Diagnostics;
}
