import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var _sqlInstance: postgres.Sql<{}> | undefined;
}

/**
 * Returns the authoritative PostgreSQL client.
 * Serverless optimized:
 * - max: 3 connections per container (each container only executes single queries)
 * - idle_timeout: 5 seconds (releases connection to PgBouncer promptly when idle)
 * - connect_timeout: 10 seconds (fails fast under pooler starvation)
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
      max: 3,
      idle_timeout: 5,
      connect_timeout: 10,
      prepare: false, // CRITICAL: required for Supabase Transaction Pooler (PgBouncer port 6543)
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
 * Executes a query while measuring exact time spent waiting for a connection checkout
 * vs time spent executing the SQL query on PostgreSQL.
 */
export async function timedQuery<T>(
  fn: (sql: postgres.Sql<{}>) => Promise<T>
): Promise<TimedResult<T>> {
  const rootSql = getSql();
  const t0 = performance.now();
  const reserved = await rootSql.reserve();
  const connWaitMs = performance.now() - t0;

  const t1 = performance.now();
  try {
    const data = await fn(reserved as unknown as postgres.Sql<{}>);
    const sqlExecMs = performance.now() - t1;
    return { data, connWaitMs, sqlExecMs };
  } finally {
    reserved.release();
  }
}

export default getSql;
