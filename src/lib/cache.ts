export class TTLCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  private pending = new Map<string, Promise<T>>();
  constructor(
    private ttl: number,
    private capacity = 300,
    private clock = Date.now,
  ) {}
  get(key: string): T | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= this.clock()) {
      this.entries.delete(key);
      return undefined;
    }
    return e.value;
  }
  set(key: string, value: T) {
    if (!this.entries.has(key) && this.entries.size >= this.capacity)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expiresAt: this.clock() + this.ttl });
  }
  async resolve(
    key: string,
    loader: () => Promise<T>,
    stats: { cacheHits: number; cacheMisses: number },
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      stats.cacheHits++;
      return cached;
    }
    const flight = this.pending.get(key);
    if (flight) {
      stats.cacheHits++;
      return flight;
    }
    stats.cacheMisses++;
    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
  clear() {
    this.entries.clear();
  }
}
export class SerialGate {
  private tail: Promise<unknown> = Promise.resolve();
  private last = 0;
  constructor(private gap: number) {}
  run<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.tail.then(async () => {
      await new Promise((r) =>
        setTimeout(r, Math.max(0, this.last + this.gap - Date.now())),
      );
      this.last = Date.now();
      return fn();
    });
    this.tail = task.catch(() => {});
    return task;
  }
}
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Concurrency must be a positive integer.");
  const result: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        result[i] = await fn(items[i], i);
      }
    }),
  );
  return result;
}
