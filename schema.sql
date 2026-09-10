-- ============================================================
-- THE CODEBREAKER'S GAUNTLET - AUTHORITATIVE POSTGRESQL SCHEMA
-- ============================================================

-- 1. Events Table (Single authoritative event record)
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
  event_name VARCHAR(100) NOT NULL DEFAULT 'The Codebreaker''s Gauntlet',
  event_status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'not_started', 'active', 'complete'
  event_start_time BIGINT NOT NULL,                  -- Authoritative Unix millisecond timestamp
  round_duration_sec INT NOT NULL DEFAULT 2700,      -- 45 min (2700 sec)
  total_rounds INT NOT NULL DEFAULT 3,               -- 3 rounds (135 min total)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS teams (
  team_name VARCHAR(24) PRIMARY KEY,                 -- Normalized uppercase
  session_id VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,                        -- Unix ms timestamp
  last_sync BIGINT NOT NULL,                         -- Unix ms timestamp
  current_round SMALLINT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- 3. Round States Table
CREATE TABLE IF NOT EXISTS round_states (
  id SERIAL PRIMARY KEY,
  team_name VARCHAR(24) NOT NULL REFERENCES teams(team_name) ON DELETE CASCADE,
  round_number SMALLINT NOT NULL CHECK (round_number IN (1, 2, 3)),
  status VARCHAR(20) NOT NULL DEFAULT 'active',      -- 'active', 'complete', 'timeup'
  started_at BIGINT,                                 -- Official round start ms
  finished_at BIGINT,                                -- Authoritative completion ms
  master_key_at BIGINT,                              -- Authoritative master key ms
  master_key BOOLEAN NOT NULL DEFAULT FALSE,
  master_key_attempts INT NOT NULL DEFAULT 0,
  elapsed_ms BIGINT,                                 -- Millisecond precision: finished_at - official_start
  UNIQUE(team_name, round_number)
);

-- 4. Door States Table
CREATE TABLE IF NOT EXISTS door_states (
  id SERIAL PRIMARY KEY,
  team_name VARCHAR(24) NOT NULL REFERENCES teams(team_name) ON DELETE CASCADE,
  door_number SMALLINT NOT NULL CHECK (door_number BETWEEN 1 AND 18),
  round_number SMALLINT NOT NULL CHECK (round_number IN (1, 2, 3)),
  index_in_round SMALLINT NOT NULL CHECK (index_in_round BETWEEN 0 AND 5),
  solved BOOLEAN NOT NULL DEFAULT FALSE,
  fragment VARCHAR(20) NOT NULL DEFAULT '',
  attempts INT NOT NULL DEFAULT 0,
  solved_at BIGINT,                                  -- Authoritative ms timestamp
  UNIQUE(team_name, door_number)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_round_states_leaderboard 
  ON round_states(round_number, status, elapsed_ms ASC, finished_at ASC);

CREATE INDEX IF NOT EXISTS idx_door_states_lookup 
  ON door_states(team_name, round_number, door_number);

CREATE INDEX IF NOT EXISTS idx_teams_created 
  ON teams(created_at ASC);

-- Insert initial default event row if not already present
INSERT INTO events (id, event_name, event_status, event_start_time, round_duration_sec, total_rounds)
VALUES (
  'default', 
  'The Codebreaker''s Gauntlet', 
  'active', 
  CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT), 
  2700, 
  3
)
ON CONFLICT (id) DO NOTHING;
