import getSql from "./db";

declare global {
  // eslint-disable-next-line no-var
  var _schemaInitialized: Promise<void> | undefined;
}

/**
 * Ensures all required PostgreSQL tables, constraints, indexes, and initial event row exist.
 * Runs once per serverless instance lifecycle with cached promise.
 * Resolves the "relation events does not exist" error automatically on first request.
 */
export async function ensureSchema(): Promise<void> {
  if (globalThis._schemaInitialized) {
    return globalThis._schemaInitialized;
  }

  globalThis._schemaInitialized = (async () => {
    const sql = getSql();

    // 1. Events Table
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
        event_name VARCHAR(100) NOT NULL DEFAULT 'The Codebreaker''s Gauntlet',
        event_status VARCHAR(20) NOT NULL DEFAULT 'not_started',
        event_start_time BIGINT NOT NULL,
        round_duration_sec INT NOT NULL DEFAULT 2700,
        total_rounds INT NOT NULL DEFAULT 3,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    // 2. Teams Table
    await sql`
      CREATE TABLE IF NOT EXISTS teams (
        team_name VARCHAR(24) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        created_at BIGINT NOT NULL,
        last_sync BIGINT NOT NULL,
        current_round SMALLINT NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
      );
    `;

    // 3. Round States Table
    await sql`
      CREATE TABLE IF NOT EXISTS round_states (
        id SERIAL PRIMARY KEY,
        team_name VARCHAR(24) NOT NULL REFERENCES teams(team_name) ON DELETE CASCADE,
        round_number SMALLINT NOT NULL CHECK (round_number IN (1, 2, 3)),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        started_at BIGINT,
        finished_at BIGINT,
        master_key_at BIGINT,
        master_key BOOLEAN NOT NULL DEFAULT FALSE,
        master_key_attempts INT NOT NULL DEFAULT 0,
        elapsed_ms BIGINT,
        UNIQUE(team_name, round_number)
      );
    `;

    // 4. Door States Table
    await sql`
      CREATE TABLE IF NOT EXISTS door_states (
        id SERIAL PRIMARY KEY,
        team_name VARCHAR(24) NOT NULL REFERENCES teams(team_name) ON DELETE CASCADE,
        door_number SMALLINT NOT NULL CHECK (door_number BETWEEN 1 AND 18),
        round_number SMALLINT NOT NULL CHECK (round_number IN (1, 2, 3)),
        index_in_round SMALLINT NOT NULL CHECK (index_in_round BETWEEN 0 AND 5),
        solved BOOLEAN NOT NULL DEFAULT FALSE,
        fragment VARCHAR(20) NOT NULL DEFAULT '',
        attempts INT NOT NULL DEFAULT 0,
        solved_at BIGINT,
        UNIQUE(team_name, door_number)
      );
    `;

    // Indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_round_states_leaderboard 
        ON round_states(round_number, status, elapsed_ms ASC, finished_at ASC);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_door_states_lookup 
        ON door_states(team_name, round_number, door_number);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_teams_created 
        ON teams(created_at ASC);
    `;

    // Initial default event row: starts in 'not_started' state until organizer starts it
    const initialTime = Date.now();
    await sql`
      INSERT INTO events (id, event_name, event_status, event_start_time, round_duration_sec, total_rounds)
      VALUES ('default', 'The Codebreaker''s Gauntlet', 'not_started', ${initialTime}, 2700, 3)
      ON CONFLICT (id) DO NOTHING;
    `;
  })().catch((err) => {
    globalThis._schemaInitialized = undefined;
    throw err;
  });

  return globalThis._schemaInitialized;
}

export default ensureSchema;
