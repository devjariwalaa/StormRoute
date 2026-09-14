export function GET() {
  return Response.json({
    status: "ok",
    service: "StormRoute",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    scope:
      "Application liveness; upstream availability is checked during analysis.",
  });
}
