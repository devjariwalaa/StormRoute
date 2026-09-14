import { z } from "zod";
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
export const tripSchema = z
  .object({
    origin: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(120),
    departure: z.string().datetime({ offset: true }),
  })
  .superRefine((v, ctx) => {
    if (v.origin.toLowerCase() === v.destination.toLowerCase())
      ctx.addIssue({
        code: "custom",
        message: "Choose different origin and destination cities.",
      });
    const t = Date.parse(v.departure);
    if (t < Date.now() - 60000 || t > Date.now() + 6 * 86400000)
      ctx.addIssue({
        code: "custom",
        message: "Choose a departure from now through the next six days.",
      });
  });
export async function fetchJson(url: URL): Promise<unknown> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent":
          "StormRoute/1.0 (non-commercial educational route analysis)",
      },
      cache: "no-store",
    });
    if (!r.ok)
      throw new AppError(
        "PROVIDER_HTTP",
        `Data provider is unavailable (${r.status}). Please try again later.`,
      );
    return await r.json();
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      "PROVIDER_TIMEOUT",
      "A data provider did not respond. Please try again shortly.",
    );
  }
}
