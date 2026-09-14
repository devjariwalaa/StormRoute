import { analyze } from "@/lib/analyze";
import { AppError } from "@/lib/validation";
export const runtime = "nodejs";
export const maxDuration = 60;
let active = 0;
export async function POST(request: Request) {
  if (active >= 2)
    return Response.json(
      { error: "Analysis capacity is busy. Please retry shortly." },
      { status: 429, headers: { "Retry-After": "10" } },
    );
  if (Number(request.headers.get("content-length")) > 2048)
    return Response.json({ error: "Request too large." }, { status: 413 });
  active++;
  try {
    const body = await request.text();
    if (body.length > 2048)
      return Response.json({ error: "Request too large." }, { status: 413 });
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return Response.json(
        { error: "Send a valid JSON trip request." },
        { status: 400 },
      );
    }
    return Response.json(
      await analyze(input, process.env.NODE_ENV === "development"),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Analysis could not be completed. Please try again.",
        code: e instanceof AppError ? e.code : "INTERNAL_ERROR",
      },
      { status: e instanceof AppError ? e.status : 500 },
    );
  } finally {
    active--;
  }
}
