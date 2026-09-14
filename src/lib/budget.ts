import { AppError } from "./validation";
/** Conservative, process-local weighted request budgets; not a distributed quota. */
export class RequestBudget {
  private events: { at: number; credits: number }[] = [];
  constructor(private clock = Date.now) {}
  take(credits: number) {
    const now = this.clock();
    this.events = this.events.filter((e) => now - e.at < 86400000);
    for (const [window, limit] of [
      [60000, 450],
      [3600000, 4500],
      [86400000, 9000],
    ]) {
      const used = this.events.reduce(
        (sum, e) => sum + (now - e.at < window ? e.credits : 0),
        0,
      );
      if (used + credits > limit)
        throw new AppError(
          "PROVIDER_BUDGET",
          "The shared forecast request budget is temporarily exhausted. Please try later.",
          429,
        );
    }
    this.events.push({ at: now, credits });
  }
}
