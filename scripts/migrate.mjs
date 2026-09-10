import postgres from "postgres";
import fs from "fs";
import path from "path";

// Load .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function run() {
  console.log("--> Starting database migration...");
  
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
  console.log("  ? Table events verified.");

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
  console.log("  ? Table teams verified.");

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
  console.log("  ? Table round_states verified.");

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
  console.log("  ? Table door_states verified.");

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
  console.log("  ? Indexes verified.");

  const initialTime = Date.now();
  await sql`
    INSERT INTO events (id, event_name, event_status, event_start_time, round_duration_sec, total_rounds)
    VALUES ('default', 'The Codebreaker''s Gauntlet', 'not_started', ${initialTime}, 2700, 3)
    ON CONFLICT (id) DO NOTHING;
  `;
  console.log("  ? Default event row verified.");

  await sql.end();
  console.log("--> Migration completed successfully.");
}

run().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
