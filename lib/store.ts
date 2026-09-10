import getSql from "./db";
import {
  getEventConfig,
  calculateActiveRound,
  getOfficialRoundStartTime,
  ROUND_DURATION_SEC,
} from "./eventClock";

export type DoorState = {
  doorNumber: number; // 1 to 18
  indexInRound: number; // 0 to 5
  solved: boolean;
  fragment: string;
  attempts: number;
  solvedAt: number | null;
};

export type RoundState = {
  round: 1 | 2 | 3;
  doors: DoorState[];
  masterKey: boolean;
  masterKeyAttempts: number;
  startedAt: number | null;
  finishedAt: number | null;
  masterKeyAt: number | null;
  status: "active" | "complete" | "timeup";
  elapsedMs: number | null;
  elapsedSec: number | null; // For legacy backwards compatibility
};

export type TeamState = {
  team: string;
  sessionId: string;
  created: number;
  lastSync: number;
  currentRound: 1 | 2 | 3;
  rounds: {
    1: RoundState;
    2: RoundState;
    3: RoundState;
  };
  // Convenience properties mirroring active round for backwards compatibility
  round: number;
  doors: DoorState[];
  masterKey: boolean;
  masterKeyAttempts: number;
  startedAt: number | null;
  finishedAt: number | null;
  masterKeyAt: number | null;
  status: "active" | "complete" | "timeup";
};

export type LeaderboardEntry = {
  rank: number;
  team: string;
  round: 1 | 2 | 3;
  elapsedMs: number;
  elapsedSec: number;
  formattedTime: string;
  finishedAt: number;
  solvedDoors: number;
  totalAttempts: number;
  masterKeyAttempts: number;
};

const norm = (s: string) => s.trim().toUpperCase().slice(0, 24);

export function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const remMs = ms % 1000;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(remMs).padStart(3, "0")}`;
}

export function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function syncLegacyFields(t: TeamState, activeRound: 1 | 2 | 3 = 1) {
  t.currentRound = activeRound;
  t.round = activeRound;
  const curRoundState = t.rounds[activeRound] || t.rounds[1];
  t.doors = curRoundState.doors;
  t.masterKey = curRoundState.masterKey;
  t.masterKeyAttempts = curRoundState.masterKeyAttempts;
  t.startedAt = curRoundState.startedAt;
  t.finishedAt = curRoundState.finishedAt;
  t.masterKeyAt = curRoundState.masterKeyAt;
  t.status = curRoundState.status;
}

/**
 * Get team by name from PostgreSQL.
 */
export async function getTeam(name: string): Promise<TeamState | null> {
  const key = norm(name);
  if (!key) return null;
  const sql = getSql();

  const [teamRow] = await sql<Array<{
    team_name: string;
    session_id: string;
    created_at: string | number;
    last_sync: string | number;
    current_round: number;
    status: string;
  }>>`
    SELECT team_name, session_id, created_at, last_sync, current_round, status 
    FROM teams 
    WHERE team_name = ${key} 
    LIMIT 1
  `;

  if (!teamRow) return null;

  const roundRows = await sql<Array<{
    round_number: number;
    status: string;
    started_at: string | number | null;
    finished_at: string | number | null;
    master_key_at: string | number | null;
    master_key: boolean;
    master_key_attempts: number;
    elapsed_ms: string | number | null;
  }>>`
    SELECT round_number, status, started_at, finished_at, master_key_at, master_key, master_key_attempts, elapsed_ms
    FROM round_states
    WHERE team_name = ${key}
    ORDER BY round_number ASC
  `;

  const doorRows = await sql<Array<{
    door_number: number;
    round_number: number;
    index_in_round: number;
    solved: boolean;
    fragment: string;
    attempts: number;
    solved_at: string | number | null;
  }>>`
    SELECT door_number, round_number, index_in_round, solved, fragment, attempts, solved_at
    FROM door_states
    WHERE team_name = ${key}
    ORDER BY door_number ASC
  `;

  const doorsByRound: Record<number, DoorState[]> = { 1: [], 2: [], 3: [] };
  for (const d of doorRows) {
    if (doorsByRound[d.round_number]) {
      doorsByRound[d.round_number].push({
        doorNumber: d.door_number,
        indexInRound: d.index_in_round,
        solved: d.solved,
        fragment: d.fragment || "",
        attempts: d.attempts,
        solvedAt: d.solved_at ? Number(d.solved_at) : null,
      });
    }
  }

  const rounds: Record<number, RoundState> = {};
  for (const rNum of [1, 2, 3] as const) {
    const rMatch = roundRows.find((r) => r.round_number === rNum);
    const ms = rMatch?.elapsed_ms ? Number(rMatch.elapsed_ms) : null;
    rounds[rNum] = {
      round: rNum,
      doors: doorsByRound[rNum] || [],
      masterKey: rMatch?.master_key ?? false,
      masterKeyAttempts: rMatch?.master_key_attempts ?? 0,
      startedAt: rMatch?.started_at ? Number(rMatch.started_at) : null,
      finishedAt: rMatch?.finished_at ? Number(rMatch.finished_at) : null,
      masterKeyAt: rMatch?.master_key_at ? Number(rMatch.master_key_at) : null,
      status: (rMatch?.status as any) || "active",
      elapsedMs: ms,
      elapsedSec: ms ? Math.floor(ms / 1000) : null,
    };
  }

  const { eventStartTime } = await getEventConfig();
  const activeRound = (calculateActiveRound(eventStartTime) || 1) as 1 | 2 | 3;

  const teamObj: TeamState = {
    team: teamRow.team_name,
    sessionId: teamRow.session_id,
    created: Number(teamRow.created_at),
    lastSync: Number(teamRow.last_sync),
    currentRound: activeRound,
    rounds: { 1: rounds[1], 2: rounds[2], 3: rounds[3] },
    round: activeRound,
    doors: rounds[activeRound]?.doors || [],
    masterKey: rounds[activeRound]?.masterKey || false,
    masterKeyAttempts: rounds[activeRound]?.masterKeyAttempts || 0,
    startedAt: rounds[activeRound]?.startedAt || null,
    finishedAt: rounds[activeRound]?.finishedAt || null,
    masterKeyAt: rounds[activeRound]?.masterKeyAt || null,
    status: rounds[activeRound]?.status || "active",
  };

  syncLegacyFields(teamObj, activeRound);
  return teamObj;
}

/**
 * Find or create a team and initialize all rounds and doors in PostgreSQL.
 * HIGH-CONCURRENCY BATCHED: Multi-row inserts reduce 22 round-trips to just 3 statements.
 */
export async function getOrCreateTeam(name: string): Promise<{ team: TeamState; created: boolean }> {
  const key = norm(name);
  if (!key) throw new Error("team required");
  const sql = getSql();

  const existing = await getTeam(key);
  if (existing) {
    const now = Date.now();
    await sql`UPDATE teams SET last_sync = ${now} WHERE team_name = ${key}`;
    existing.lastSync = now;
    return { team: existing, created: false };
  }

  const now = Date.now();
  const sessionId = (Math.random().toString(36).slice(2) + Date.now().toString(36)).toUpperCase();

  // 1. Create team row
  await sql`
    INSERT INTO teams (team_name, session_id, created_at, last_sync, current_round, status)
    VALUES (${key}, ${sessionId}, ${now}, ${now}, 1, 'active')
    ON CONFLICT (team_name) DO UPDATE SET last_sync = ${now}
  `;

  // 2. Multi-row batched insert for all 3 rounds in a single query
  await sql`
    INSERT INTO round_states (team_name, round_number, status, started_at, finished_at, master_key_at, master_key, master_key_attempts, elapsed_ms)
    VALUES 
      (${key}, 1, 'active', NULL, NULL, NULL, FALSE, 0, NULL),
      (${key}, 2, 'active', NULL, NULL, NULL, FALSE, 0, NULL),
      (${key}, 3, 'active', NULL, NULL, NULL, FALSE, 0, NULL)
    ON CONFLICT (team_name, round_number) DO NOTHING
  `;

  // 3. Multi-row batched insert for all 18 doors in a single query
  await sql`
    INSERT INTO door_states (team_name, door_number, round_number, index_in_round, solved, fragment, attempts, solved_at)
    VALUES 
      (${key}, 1, 1, 0, FALSE, '', 0, NULL),
      (${key}, 2, 1, 1, FALSE, '', 0, NULL),
      (${key}, 3, 1, 2, FALSE, '', 0, NULL),
      (${key}, 4, 1, 3, FALSE, '', 0, NULL),
      (${key}, 5, 1, 4, FALSE, '', 0, NULL),
      (${key}, 6, 1, 5, FALSE, '', 0, NULL),
      (${key}, 7, 2, 0, FALSE, '', 0, NULL),
      (${key}, 8, 2, 1, FALSE, '', 0, NULL),
      (${key}, 9, 2, 2, FALSE, '', 0, NULL),
      (${key}, 10, 2, 3, FALSE, '', 0, NULL),
      (${key}, 11, 2, 4, FALSE, '', 0, NULL),
      (${key}, 12, 2, 5, FALSE, '', 0, NULL),
      (${key}, 13, 3, 0, FALSE, '', 0, NULL),
      (${key}, 14, 3, 1, FALSE, '', 0, NULL),
      (${key}, 15, 3, 2, FALSE, '', 0, NULL),
      (${key}, 16, 3, 3, FALSE, '', 0, NULL),
      (${key}, 17, 3, 4, FALSE, '', 0, NULL),
      (${key}, 18, 3, 5, FALSE, '', 0, NULL)
    ON CONFLICT (team_name, door_number) DO NOTHING
  `;

  // Instant in-memory construction: avoids redundant SELECT round-trips
  const initDoors = (roundNum: 1 | 2 | 3): DoorState[] =>
    Array.from({ length: 6 }, (_, i) => ({
      doorNumber: (roundNum - 1) * 6 + i + 1,
      indexInRound: i,
      solved: false,
      fragment: "",
      attempts: 0,
      solvedAt: null,
    }));

  const initRound = (roundNum: 1 | 2 | 3): RoundState => ({
    round: roundNum,
    doors: initDoors(roundNum),
    masterKey: false,
    masterKeyAttempts: 0,
    startedAt: null,
    finishedAt: null,
    masterKeyAt: null,
    status: "active",
    elapsedMs: null,
    elapsedSec: null,
  });

  const teamObj: TeamState = {
    team: key,
    sessionId,
    created: now,
    lastSync: now,
    currentRound: 1,
    rounds: { 1: initRound(1), 2: initRound(2), 3: initRound(3) },
    round: 1,
    doors: initDoors(1),
    masterKey: false,
    masterKeyAttempts: 0,
    startedAt: null,
    finishedAt: null,
    masterKeyAt: null,
    status: "active",
  };

  syncLegacyFields(teamObj, 1);
  return { team: teamObj, created: true };
}

/**
 * Official round start on team join/re-entry
 */
export async function startRound(name: string): Promise<TeamState> {
  const key = norm(name);
  const sql = getSql();
  const { eventStartTime } = await getEventConfig();
  const activeRound = (calculateActiveRound(eventStartTime) || 1) as 1 | 2 | 3;
  const officialStart = getOfficialRoundStartTime(activeRound, eventStartTime);

  await sql`
    UPDATE round_states 
    SET started_at = ${officialStart} 
    WHERE team_name = ${key} AND round_number = ${activeRound} AND started_at IS NULL
  `;

  await sql`UPDATE teams SET last_sync = ${Date.now()} WHERE team_name = ${key}`;

  const updated = await getTeam(key);
  if (!updated) throw new Error("team not found");
  return updated;
}

/**
 * List all teams (for admin dashboard).
 * HIGH-CONCURRENCY OPTIMIZED: Fetches all teams, rounds, and doors in 3 bulk queries.
 */
export async function listTeams(): Promise<TeamState[]> {
  const sql = getSql();
  const teamRows = await sql<Array<{
    team_name: string;
    session_id: string;
    created_at: string | number;
    last_sync: string | number;
    current_round: number;
    status: string;
  }>>`SELECT team_name, session_id, created_at, last_sync, current_round, status FROM teams ORDER BY created_at ASC`;

  const roundRows = await sql<Array<{
    team_name: string;
    round_number: number;
    status: string;
    started_at: string | number | null;
    finished_at: string | number | null;
    master_key_at: string | number | null;
    master_key: boolean;
    master_key_attempts: number;
    elapsed_ms: string | number | null;
  }>>`SELECT team_name, round_number, status, started_at, finished_at, master_key_at, master_key, master_key_attempts, elapsed_ms FROM round_states ORDER BY round_number ASC`;

  const doorRows = await sql<Array<{
    team_name: string;
    door_number: number;
    round_number: number;
    index_in_round: number;
    solved: boolean;
    fragment: string;
    attempts: number;
    solved_at: string | number | null;
  }>>`SELECT team_name, door_number, round_number, index_in_round, solved, fragment, attempts, solved_at FROM door_states ORDER BY door_number ASC`;

  const config = await getEventConfig();
  const activeRound = (calculateActiveRound(config.eventStartTime) || 1) as 1 | 2 | 3;

  const doorsByTeam: Record<string, Record<number, DoorState[]>> = {};
  for (const d of doorRows) {
    if (!doorsByTeam[d.team_name]) doorsByTeam[d.team_name] = { 1: [], 2: [], 3: [] };
    if (doorsByTeam[d.team_name][d.round_number]) {
      doorsByTeam[d.team_name][d.round_number].push({
        doorNumber: d.door_number,
        indexInRound: d.index_in_round,
        solved: d.solved,
        fragment: d.fragment || "",
        attempts: d.attempts,
        solvedAt: d.solved_at ? Number(d.solved_at) : null,
      });
    }
  }

  const roundsByTeam: Record<string, Record<number, any>> = {};
  for (const r of roundRows) {
    if (!roundsByTeam[r.team_name]) roundsByTeam[r.team_name] = {};
    roundsByTeam[r.team_name][r.round_number] = r;
  }

  const results: TeamState[] = [];
  for (const tRow of teamRows) {
    const key = tRow.team_name;
    const teamDoors = doorsByTeam[key] || { 1: [], 2: [], 3: [] };
    const teamRounds = roundsByTeam[key] || {};

    const rounds: Record<number, RoundState> = {};
    for (const rNum of [1, 2, 3] as const) {
      const rMatch = teamRounds[rNum];
      const ms = rMatch?.elapsed_ms ? Number(rMatch.elapsed_ms) : null;
      rounds[rNum] = {
        round: rNum,
        doors: teamDoors[rNum] || [],
        masterKey: rMatch?.master_key ?? false,
        masterKeyAttempts: rMatch?.master_key_attempts ?? 0,
        startedAt: rMatch?.started_at ? Number(rMatch.started_at) : null,
        finishedAt: rMatch?.finished_at ? Number(rMatch.finished_at) : null,
        masterKeyAt: rMatch?.master_key_at ? Number(rMatch.master_key_at) : null,
        status: (rMatch?.status as any) || "active",
        elapsedMs: ms,
        elapsedSec: ms ? Math.floor(ms / 1000) : null,
      };
    }

    const teamObj: TeamState = {
      team: tRow.team_name,
      sessionId: tRow.session_id,
      created: Number(tRow.created_at),
      lastSync: Number(tRow.last_sync),
      currentRound: activeRound,
      rounds: { 1: rounds[1], 2: rounds[2], 3: rounds[3] },
      round: activeRound,
      doors: rounds[activeRound]?.doors || [],
      masterKey: rounds[activeRound]?.masterKey || false,
      masterKeyAttempts: rounds[activeRound]?.masterKeyAttempts || 0,
      startedAt: rounds[activeRound]?.startedAt || null,
      finishedAt: rounds[activeRound]?.finishedAt || null,
      masterKeyAt: rounds[activeRound]?.masterKeyAt || null,
      status: rounds[activeRound]?.status || "active",
    };
    syncLegacyFields(teamObj, activeRound);
    results.push(teamObj);
  }

  return results;
}

/**
 * Solve a door with atomic duplicate submission protection and database round gating.
 * doorArg: accepts 1-indexed doorNumber (1..18), 0-indexed overall (0..17), or 0..5 in current round.
 */
export async function solveDoor(
  name: string,
  doorArg: number,
  fragment: string
): Promise<{ team: TeamState; newlySolved: boolean; error?: string } | null> {
  const key = norm(name);
  const sql = getSql();

  // 1. Authoritative round check directly against DB
  const { eventStartTime } = await getEventConfig();
  const activeRound = calculateActiveRound(eventStartTime);
  if (!activeRound) {
    const t = await getTeam(key);
    return t ? { team: t, newlySolved: false, error: "Event is closed. No rounds active." } : null;
  }

  // Determine target round and doorNumber
  let targetRound: 1 | 2 | 3;
  let doorNumber: number;

  if (doorArg >= 1 && doorArg <= 18) {
    doorNumber = doorArg;
    targetRound = (Math.floor((doorArg - 1) / 6) + 1) as 1 | 2 | 3;
  } else if (doorArg >= 0 && doorArg < 18) {
    doorNumber = doorArg + 1;
    targetRound = (Math.floor(doorArg / 6) + 1) as 1 | 2 | 3;
  } else {
    targetRound = activeRound;
    doorNumber = (activeRound - 1) * 6 + doorArg + 1;
  }

  // Round gating
  if (targetRound !== activeRound) {
    const t = await getTeam(key);
    return t ? {
      team: t,
      newlySolved: false,
      error: `Round ${targetRound} is not active. Submissions only permitted for Round ${activeRound}.`,
    } : null;
  }

  const now = Date.now();

  // 2. Atomic update with unique conditional check
  // Only updates if solved is currently FALSE
  const updatedRows = await sql<Array<{ id: number }>>`
    UPDATE door_states
    SET solved = TRUE, fragment = ${fragment}, solved_at = ${now}
    WHERE team_name = ${key} AND door_number = ${doorNumber} AND solved = FALSE
    RETURNING id
  `;

  await sql`UPDATE teams SET last_sync = ${now} WHERE team_name = ${key}`;

  const t = await getTeam(key);
  if (!t) return null;

  const newlySolved = updatedRows.length > 0;
  return { team: t, newlySolved };
}

/**
 * Record a wrong attempt for a door
 */
export async function recordAttempt(name: string, doorArg: number): Promise<TeamState | null> {
  const key = norm(name);
  const sql = getSql();

  const { eventStartTime } = await getEventConfig();
  const activeRound = (calculateActiveRound(eventStartTime) || 1) as 1 | 2 | 3;

  let doorNumber = doorArg;
  if (doorArg >= 1 && doorArg <= 18) {
    doorNumber = doorArg;
  } else if (doorArg >= 0 && doorArg < 18) {
    doorNumber = doorArg + 1;
  } else {
    doorNumber = (activeRound - 1) * 6 + doorArg + 1;
  }

  await sql`
    UPDATE door_states
    SET attempts = attempts + 1
    WHERE team_name = ${key} AND door_number = ${doorNumber}
  `;

  await sql`UPDATE teams SET last_sync = ${Date.now()} WHERE team_name = ${key}`;

  return getTeam(key);
}

/**
 * Validate and set Master Key with millisecond precision elapsed_ms.
 * Enforces database round gating and atomic round completion.
 */
export async function setMasterKey(
  name: string,
  accepted: boolean,
  roundArg?: number
): Promise<{ team: TeamState; accepted: boolean; error?: string } | null> {
  const key = norm(name);
  const sql = getSql();

  const { eventStartTime } = await getEventConfig();
  const activeRound = calculateActiveRound(eventStartTime);
  if (!activeRound) {
    const t = await getTeam(key);
    return t ? { team: t, accepted: false, error: "Event is closed. No rounds active." } : null;
  }

  const targetRound = (roundArg && (roundArg === 1 || roundArg === 2 || roundArg === 3)) ? roundArg : activeRound;

  if (targetRound !== activeRound) {
    const t = await getTeam(key);
    return t ? {
      team: t,
      accepted: false,
      error: `Round ${targetRound} is not active. Submissions only permitted for Round ${activeRound}.`,
    } : null;
  }

  const now = Date.now();

  if (accepted) {
    const officialStart = getOfficialRoundStartTime(targetRound, eventStartTime);
    const elapsedMs = Math.max(0, now - officialStart);

    // Atomic completion update: only marks complete if not already completed
    await sql`
      UPDATE round_states
      SET master_key = TRUE,
          master_key_attempts = master_key_attempts + 1,
          master_key_at = ${now},
          finished_at = COALESCE(finished_at, ${now}),
          status = 'complete',
          elapsed_ms = COALESCE(elapsed_ms, ${elapsedMs})
      WHERE team_name = ${key} AND round_number = ${targetRound}
    `;
  } else {
    await sql`
      UPDATE round_states
      SET master_key_attempts = master_key_attempts + 1
      WHERE team_name = ${key} AND round_number = ${targetRound}
    `;
  }

  await sql`UPDATE teams SET last_sync = ${now} WHERE team_name = ${key}`;

  const t = await getTeam(key);
  if (!t) return null;
  return { team: t, accepted };
}

/**
 * Set status for a round (complete | timeup)
 */
export async function setRoundStatus(
  name: string,
  status: "complete" | "timeup",
  roundArg?: number
): Promise<TeamState | null> {
  const key = norm(name);
  const sql = getSql();

  const { eventStartTime } = await getEventConfig();
  const activeRound = (calculateActiveRound(eventStartTime) || 1) as 1 | 2 | 3;
  const targetRound = (roundArg && (roundArg === 1 || roundArg === 2 || roundArg === 3)) ? roundArg : activeRound;

  const now = Date.now();
  const officialStart = getOfficialRoundStartTime(targetRound, eventStartTime);
  const elapsedMs = status === "complete" ? Math.max(0, now - officialStart) : null;

  await sql`
    UPDATE round_states
    SET status = ${status},
        finished_at = ${now},
        elapsed_ms = COALESCE(elapsed_ms, ${elapsedMs})
    WHERE team_name = ${key} AND round_number = ${targetRound}
  `;

  await sql`UPDATE teams SET last_sync = ${now} WHERE team_name = ${key}`;

  return getTeam(key);
}

/**
 * Fetch public leaderboard from PostgreSQL.
 * TOP 10 ONLY + optional current team rank query.
 * Ranked strictly by elapsed_ms ASC, finished_at ASC.
 */
export async function getPublicLeaderboard(round: 1 | 2 | 3, currentTeamName?: string) {
  const sql = getSql();

  // Top 10 query with millisecond precision
  const top10Rows = await sql<Array<{
    team: string;
    round: number;
    elapsedMs: string | number;
    finishedAt: string | number;
    masterKeyAttempts: number;
    totalAttempts: string | number;
    solvedDoors: string | number;
  }>>`
    SELECT 
      rs.team_name as team,
      rs.round_number as round,
      rs.elapsed_ms as "elapsedMs",
      rs.finished_at as "finishedAt",
      rs.master_key_attempts as "masterKeyAttempts",
      COALESCE(SUM(ds.attempts), 0) as "totalAttempts",
      COUNT(ds.id) FILTER (WHERE ds.solved = TRUE) as "solvedDoors"
    FROM round_states rs
    LEFT JOIN door_states ds ON ds.team_name = rs.team_name AND ds.round_number = rs.round_number
    WHERE rs.round_number = ${round} AND rs.status = 'complete' AND rs.elapsed_ms IS NOT NULL
    GROUP BY rs.team_name, rs.round_number, rs.elapsed_ms, rs.finished_at, rs.master_key_attempts
    ORDER BY rs.elapsed_ms ASC, rs.finished_at ASC, rs.master_key_attempts ASC
    LIMIT 10
  `;

  const top10: LeaderboardEntry[] = top10Rows.map((r, idx) => {
    const ms = Number(r.elapsedMs);
    return {
      rank: idx + 1,
      team: r.team,
      round: r.round as 1 | 2 | 3,
      elapsedMs: ms,
      elapsedSec: Math.floor(ms / 1000),
      formattedTime: fmtMs(ms),
      finishedAt: Number(r.finishedAt),
      solvedDoors: Number(r.solvedDoors),
      totalAttempts: Number(r.totalAttempts),
      masterKeyAttempts: r.masterKeyAttempts,
    };
  });

  // Count total completed teams for this round
  const [countRow] = await sql<Array<{ count: string | number }>>`
    SELECT COUNT(*) as count 
    FROM round_states 
    WHERE round_number = ${round} AND status = 'complete' AND elapsed_ms IS NOT NULL
  `;
  const totalCompleted = Number(countRow?.count || 0);

  let currentTeamEntry: LeaderboardEntry | null = null;

  if (currentTeamName) {
    const key = norm(currentTeamName);
    // Check if in top 10
    const inTop10 = top10.find((e) => norm(e.team) === key);
    if (inTop10) {
      currentTeamEntry = inTop10;
    } else {
      // Query specific team ranking without loading all teams
      const [teamRow] = await sql<Array<{
        team: string;
        round: number;
        elapsedMs: string | number;
        finishedAt: string | number;
        masterKeyAttempts: number;
        totalAttempts: string | number;
        solvedDoors: string | number;
      }>>`
        SELECT 
          rs.team_name as team,
          rs.round_number as round,
          rs.elapsed_ms as "elapsedMs",
          rs.finished_at as "finishedAt",
          rs.master_key_attempts as "masterKeyAttempts",
          COALESCE(SUM(ds.attempts), 0) as "totalAttempts",
          COUNT(ds.id) FILTER (WHERE ds.solved = TRUE) as "solvedDoors"
        FROM round_states rs
        LEFT JOIN door_states ds ON ds.team_name = rs.team_name AND ds.round_number = rs.round_number
        WHERE rs.team_name = ${key} AND rs.round_number = ${round} AND rs.status = 'complete' AND rs.elapsed_ms IS NOT NULL
        GROUP BY rs.team_name, rs.round_number, rs.elapsed_ms, rs.finished_at, rs.master_key_attempts
        LIMIT 1
      `;

      if (teamRow) {
        const ms = Number(teamRow.elapsedMs);
        const finAt = Number(teamRow.finishedAt);
        // Calculate rank efficiently in SQL
        const [rankRow] = await sql<Array<{ rank: string | number }>>`
          SELECT COUNT(*) + 1 as rank
          FROM round_states
          WHERE round_number = ${round} 
            AND status = 'complete' 
            AND elapsed_ms IS NOT NULL
            AND (elapsed_ms < ${ms} OR (elapsed_ms = ${ms} AND finished_at < ${finAt}))
        `;

        currentTeamEntry = {
          rank: Number(rankRow.rank),
          team: teamRow.team,
          round: round,
          elapsedMs: ms,
          elapsedSec: Math.floor(ms / 1000),
          formattedTime: fmtMs(ms),
          finishedAt: finAt,
          solvedDoors: Number(teamRow.solvedDoors),
          totalAttempts: Number(teamRow.totalAttempts),
          masterKeyAttempts: teamRow.masterKeyAttempts,
        };
      }
    }
  }

  return {
    round,
    top10,
    currentTeam: currentTeamEntry,
    totalCompleted,
  };
}

/**
 * Full leaderboard calculation (for Admin dashboard)
 */
export async function getLeaderboard(round: 1 | 2 | 3): Promise<LeaderboardEntry[]> {
  const sql = getSql();
  const rows = await sql<Array<{
    team: string;
    round: number;
    elapsedMs: string | number;
    finishedAt: string | number;
    masterKeyAttempts: number;
    totalAttempts: string | number;
    solvedDoors: string | number;
  }>>`
    SELECT 
      rs.team_name as team,
      rs.round_number as round,
      rs.elapsed_ms as "elapsedMs",
      rs.finished_at as "finishedAt",
      rs.master_key_attempts as "masterKeyAttempts",
      COALESCE(SUM(ds.attempts), 0) as "totalAttempts",
      COUNT(ds.id) FILTER (WHERE ds.solved = TRUE) as "solvedDoors"
    FROM round_states rs
    LEFT JOIN door_states ds ON ds.team_name = rs.team_name AND ds.round_number = rs.round_number
    WHERE rs.round_number = ${round} AND rs.status = 'complete' AND rs.elapsed_ms IS NOT NULL
    GROUP BY rs.team_name, rs.round_number, rs.elapsed_ms, rs.finished_at, rs.master_key_attempts
    ORDER BY rs.elapsed_ms ASC, rs.finished_at ASC, rs.master_key_attempts ASC
  `;

  return rows.map((r, idx) => {
    const ms = Number(r.elapsedMs);
    return {
      rank: idx + 1,
      team: r.team,
      round: r.round as 1 | 2 | 3,
      elapsedMs: ms,
      elapsedSec: Math.floor(ms / 1000),
      formattedTime: fmtMs(ms),
      finishedAt: Number(r.finishedAt),
      solvedDoors: Number(r.solvedDoors),
      totalAttempts: Number(r.totalAttempts),
      masterKeyAttempts: r.masterKeyAttempts,
    };
  });
}

// Backwards compatibility for results endpoint
export async function completedTeams(): Promise<any[]> {
  const top = await getLeaderboard(1);
  return top.map((e) => ({
    team: e.team,
    minutes: Math.floor(e.elapsedMs / 60000),
    solved: e.solvedDoors,
    status: "COMPLETE",
    finishedAt: new Date(e.finishedAt).toISOString(),
    attempts: e.masterKeyAttempts,
  }));
}

export async function setStatus(name: string, status: "complete" | "timeup", round?: 1 | 2 | 3) {
  return setRoundStatus(name, status, round);
}
