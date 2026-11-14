// Instants cross ONE boundary (feature 023): the database stores `timestamptz`, the app has always
// handled epoch milliseconds (`createdAt: number` across shared/src/types.ts). Converting here, and
// only here, is what keeps every screen's date arithmetic unchanged.

/** timestamptz (ISO string from PostgREST) → epoch ms. `null` → `undefined`, never 0. */
export function ms(v: string | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Date.parse(v);
  if (Number.isNaN(n)) throw new Error(`not an instant: ${v}`);
  return n;
}

/** epoch ms → ISO for a timestamptz column. `undefined` stays `undefined` (absent stays absent). */
export function iso(v: number | undefined): string | undefined {
  return v === undefined ? undefined : new Date(v).toISOString();
}

export const nowIso = () => new Date().toISOString();

/** Drops `undefined` keys, so an omitted field is OMITTED from a write rather than written as null. */
export function defined<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as Partial<T>;
}
