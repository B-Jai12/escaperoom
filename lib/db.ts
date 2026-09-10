import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var _sqlInstance: postgres.Sql<{}> | undefined;
}

/**
 * Returns the authoritative PostgreSQL client.
 * Highly optimized for serverless bursts:
 * - max: 10 (accommodates concurrent requests sharing a container without pool starvation)
 * - idle_timeout: 30s (preserves warm connections across 3-5s player sync loops)
 * - connect_timeout: 15s (prevents premature timeouts during pooler cold-starts)
 * - prepare: false (strictly required for Supabase Transaction Pooler PgBouncer port 6543)
 */
export function getSql(): postgres.Sql<{}> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.trim()) {
    throw new Error(
      "DATABASE_NOT_CONFIGURED: DATABASE_URL environment variable is missing. " +
      "The application requires Supabase PostgreSQL for authoritative state."
    );
  }

  if (!globalThis._sqlInstance) {
    globalThis._sqlInstance = postgres(connectionString, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 15,
      prepare: false,
      ssl: { rejectUnauthorized: false },
    });
  }

  return globalThis._sqlInstance;
}

export type TimedResult<T> = {
  data: T;
  connWaitMs: number;
  sqlExecMs: number;
};

/**
 * Executes a query with high-precision timing.
 * Leverages postgres.js non-blocking connection pipelining without exclusive socket locks.
 */
export async function timedQuery<T>(
  fn: (sql: postgres.Sql<{}>) => Promise<T>
): Promise<TimedResult<T>> {
  const rootSql = getSql();
  const t0 = performance.now();
  const data = await fn(rootSql);
  const sqlExecMs = performance.now() - t0;

  return { data, connWaitMs: 0, sqlExecMs };
}

export default getSql;
