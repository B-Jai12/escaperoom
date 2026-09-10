import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var _sqlInstance: postgres.Sql<{}> | undefined;
}

/**
 * Returns the authoritative PostgreSQL client.
 * Serverless optimized: max: 5 connections per lambda container to safely execute
 * pipelined Promise.all queries without connection starvation or pooling deadlocks.
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
      max: 5,
      idle_timeout: 15,
      connect_timeout: 20,
      prepare: false, // CRITICAL: required for Supabase Transaction Pooler (PgBouncer port 6543)
      ssl: { rejectUnauthorized: false }, // required for cloud-hosted PostgreSQL poolers
    });
  }

  return globalThis._sqlInstance;
}

export default getSql;
