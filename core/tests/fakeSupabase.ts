// An in-memory stand-in for the Supabase client, for core/'s unit tests (feature 023).
//
// It replaces the per-file `vi.mock('firebase/firestore', …)` stubs. Those stubs asserted HOW a repo
// called Firestore (setDoc, merge: true, writeBatch); after the port the honest thing to assert is
// what ends up IN THE TABLE — so this fake keeps real rows, applies the filters a query names, and
// records every write. Rows are stored as Postgres returns them: snake_case columns, timestamptz as
// ISO strings — which is what makes a repo's row-to-app conversion actually run under test.
//
// Deliberately NOT a database: no RLS, no triggers, no constraints. Those are tested against the
// real local stack in supabase/tests/. What is tested here is the repo layer's own logic.

type Row = Record<string, unknown>;
export interface WriteCall {
  table: string;
  op: 'insert' | 'update' | 'upsert' | 'delete';
  values?: Row | Row[];
  filters: [string, unknown][];
  options?: Record<string, unknown>;
}
export interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

export function createFakeSupabase() {
  const tables: Record<string, Row[]> = {};
  const writes: WriteCall[] = [];
  const rpcs: RpcCall[] = [];
  const rpcResults: Record<string, unknown> = {};
  let nextId = 1;
  let failNext: { message: string; code?: string } | null = null;
  const storageUploads: { path: string; options?: Record<string, unknown> }[] = [];
  let storageFailNext: { message: string } | null = null;

  function query(table: string) {
    let op: 'select' | WriteCall['op'] = 'select';
    let values: Row | Row[] | undefined;
    let options: Record<string, unknown> | undefined;
    const filters: [string, unknown][] = [];
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let single: 'single' | 'maybe' | null = null;
    let returning = false;

    const match = (r: Row) => filters.every(([c, v]) => r[c] === v);

    function run(): { data: unknown; error: { message: string; code?: string } | null } {
      if (failNext) {
        const error = failNext;
        failNext = null;
        return { data: null, error };
      }
      const rows = (tables[table] ??= []);
      let out: Row[] = [];
      if (op === 'select') {
        out = rows.filter(match);
      } else if (op === 'insert' || op === 'upsert') {
        const list = Array.isArray(values) ? values : [values!];
        writes.push({ table, op, values, filters: [...filters], options });
        for (const v of list) {
          const conflict = (options?.onConflict as string | undefined)?.split(',');
          const existing = op === 'upsert' && conflict ? rows.find((r) => conflict.every((c) => r[c] === v[c])) : undefined;
          if (existing) {
            Object.assign(existing, v);
            out.push(existing);
          } else {
            const row = { id: v.id ?? `gen-${nextId++}`, ...v };
            rows.push(row);
            out.push(row);
          }
        }
      } else if (op === 'update') {
        writes.push({ table, op, values, filters: [...filters] });
        out = rows.filter(match);
        for (const r of out) Object.assign(r, values);
      } else if (op === 'delete') {
        writes.push({ table, op, filters: [...filters] });
        out = rows.filter(match);
        tables[table] = rows.filter((r) => !match(r));
      }
      if (order) {
        const { col, asc } = order;
        out = [...out].sort((a, b) => (a[col]! < b[col]! ? -1 : a[col]! > b[col]! ? 1 : 0) * (asc ? 1 : -1));
      }
      if (limit !== null) out = out.slice(0, limit);
      if (op !== 'select' && !returning) return { data: null, error: null };
      if (single) {
        if (single === 'single' && out.length !== 1) return { data: null, error: { message: `expected 1 row, got ${out.length}` } };
        return { data: out[0] ?? null, error: null };
      }
      return { data: out.map((r) => ({ ...r })), error: null };
    }

    const builder = {
      select(_cols?: string) {
        if (op !== 'select') returning = true;
        return builder;
      },
      insert(v: Row | Row[]) { op = 'insert'; values = v; return builder; },
      upsert(v: Row | Row[], o?: Record<string, unknown>) { op = 'upsert'; values = v; options = o; return builder; },
      update(v: Row) { op = 'update'; values = v; return builder; },
      delete() { op = 'delete'; return builder; },
      eq(col: string, val: unknown) { filters.push([col, val]); return builder; },
      order(col: string, o?: { ascending?: boolean }) { order = { col, asc: o?.ascending !== false }; return builder; },
      limit(n: number) { limit = n; return builder; },
      single() { single = 'single'; return builder; },
      maybeSingle() { single = 'maybe'; return builder; },
      then<T>(resolve: (r: ReturnType<typeof run>) => T, reject?: (e: unknown) => T) {
        try {
          return Promise.resolve(run()).then(resolve, reject);
        } catch (e) {
          return Promise.reject(e).then(resolve, reject);
        }
      },
    };
    return builder;
  }

  // Realtime channels, recorded so a test can deliver a ping (`emit`) or a (re)join (`status`) to
  // the code under test. Mirrors realtime-js in the one way that matters to core/src/db/live.ts:
  // `channel(topic)` returns the SAME object for a topic that is already open.
  interface FakeChannel {
    topic: string;
    config: unknown;
    broadcast: ((msg: { event: string; payload: unknown }) => void)[];
    onStatus?: (status: string) => void;
    removed: boolean;
    on: (type: string, filter: unknown, cb: (msg: { event: string; payload: unknown }) => void) => FakeChannel;
    subscribe: (cb?: (status: string) => void) => FakeChannel;
  }
  const channels: FakeChannel[] = [];
  function channel(topic: string, params?: { config?: unknown }): FakeChannel {
    const open = channels.find((c) => c.topic === topic && !c.removed);
    if (open) return open;
    const c: FakeChannel = {
      topic,
      config: params?.config,
      broadcast: [],
      removed: false,
      on(type, _filter, cb) {
        if (type === 'broadcast') c.broadcast.push(cb);
        return c;
      },
      subscribe(cb) {
        c.onStatus = cb;
        return c;
      },
    };
    channels.push(c);
    return c;
  }

  const client = {
    from: (table: string) => query(table),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return Promise.resolve({ data: rpcResults[fn] ?? null, error: null });
    },
    channel,
    removeChannel: (c: FakeChannel) => {
      c.removed = true;
      return Promise.resolve('ok');
    },
    storage: {
      from: () => ({
        upload: async (path: string, _file: unknown, options?: Record<string, unknown>) => {
          storageUploads.push({ path, options });
          if (storageFailNext) {
            const error = storageFailNext;
            storageFailNext = null;
            return { error };
          }
          return { error: null };
        },
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      }),
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };

  return {
    client,
    tables,
    writes,
    rpcs,
    rpcResults,
    channels,
    /** Deliver a ping to every open channel on `topic`. */
    emit(topic: string, event: string) {
      for (const c of channels) if (c.topic === topic && !c.removed) for (const cb of c.broadcast) cb({ event, payload: {} });
    },
    /** Report a join status (e.g. 'SUBSCRIBED' after a reconnect) on `topic`. */
    status(topic: string, s: string) {
      for (const c of channels) if (c.topic === topic && !c.removed) c.onStatus?.(s);
    },
    seed(table: string, rows: Row[]) {
      tables[table] = rows.map((r) => ({ ...r }));
    },
    reset() {
      for (const k of Object.keys(tables)) delete tables[k];
      writes.length = 0;
      rpcs.length = 0;
      storageUploads.length = 0;
      storageFailNext = null;
      channels.length = 0;
      nextId = 1;
      failNext = null;
    },
    failNextWith(error: { message: string; code?: string }) {
      failNext = error;
    },
    storageUploads,
    storageFailNextWith(error: { message: string }) {
      storageFailNext = error;
    },
    /** The writes to one table, newest last. */
    writesTo(table: string) {
      return writes.filter((w) => w.table === table);
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

/** Lets pending microtasks (a subscribeLive's first read) settle. */
export const flush = () => new Promise((r) => setTimeout(r, 0));
