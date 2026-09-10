import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var _sqlInstance: postgres.Sql<{}> | undefined;
}

/**
 * Returns the authoritative PostgreSQL client.
 * Configured with prepare: false for Supabase Transaction Pooler compatibility (port 6543).
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
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // CRITICAL: required for Supabase Transaction Pooler (PgBouncer port 6543)
      ssl: { rejectUnauthorized: false }, // required for cloud-hosted PostgreSQL poolers
    });
  }

  return globalThis._sqlInstance;
}

export default getSql;
