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
 * PIPELINED CONCURRENCY: executes team, rounds, and doors queries simultaneously in 1 network roundtrip.
 */
export async function getTeam(name: string): Promise<TeamState | null> {
  const key = norm(name);
  if (!key) return null;
  const sql = getSql();

  const [teamRows, roundRows, doorRows] = await Promise.all([
    sql<Array<{
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
    `,
    sql<Array<{
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
    `,
    sql<Array<{
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
    `,
  ]);

  const teamRow = teamRows[0];
  if (!teamRow) return null;

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
  if (!key) throw new Error("Invalid team name");

  const existing = await getTeam(key);
  if (existing) {
    return { team: existing, created: false };
  }

  const sql = getSql();
  const now = Date.now();
  const sessionId = "sess_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  // 1. Insert Team
  await sql`
    INSERT INTO teams (team_name, session_id, created_at, last_sync, current_round, status)
    VALUES (${key}, ${sessionId}, ${now}, ${now}, 1, 'active')
    ON CONFLICT (team_name) DO UPDATE SET last_sync = ${now}
  `;

  // 2. Batch-insert 3 rounds in a single query
  const roundRowsToInsert = [
    { team_name: key, round_number: 1, status: "active", started_at: now },
    { team_name: key, round_number: 2, status: "active", started_at: null },
    { team_name: key, round_number: 3, status: "active", started_at: null },
  ];

  await sql`
    INSERT INTO round_states ${(sql as any)(roundRowsToInsert, "team_name", "round_number", "status", "started_at")}
    ON CONFLICT (team_name, round_number) DO NOTHING
  `;

  // 3. Batch-insert all 18 doors in a single query
  const doorRowsToInsert: any[] = [];
  for (let r = 1; r <= 3; r++) {
    for (let i = 0; i < 6; i++) {
      const doorNum = (r - 1) * 6 + i + 1;
      doorRowsToInsert.push({
        team_name: key,
        door_number: doorNum,
        round_number: r,
        index_in_round: i,
        solved: false,
        fragment: "",
        attempts: 0,
      });
    }
  }

  await sql`
    INSERT INTO door_states ${(sql as any)(doorRowsToInsert, "team_name", "door_number", "round_number", "index_in_round", "solved", "fragment", "attempts")}
    ON CONFLICT (team_name, door_number) DO NOTHING
  `;

  const createdTeam = await getTeam(key);
  return { team: createdTeam!, created: true };
}

/**
 * List all teams with their complete status (for Admin Dashboard)
 */
export async function listTeams(): Promise<TeamState[]> {
  const sql = getSql();
  const rows = await sql<Array<{ team_name: string }>>`
    SELECT team_name FROM teams ORDER BY created_at ASC
  `;

  const teams: TeamState[] = [];
  for (const r of rows) {
    const t = await getTeam(r.team_name);
    if (t) teams.push(t);
  }
  return teams;
}

/**
 * Mark a door solved in PostgreSQL and record earned fragment.
 * Idempotent: safe against duplicate requests.
 */
export async function solveDoor(
  name: string,
  doorNumber: number,
  fragment: string
): Promise<{ team: TeamState; newlySolved: boolean; error?: string } | null> {
  const key = norm(name);
  const sql = getSql();

  const [door] = await sql<Array<{ solved: boolean; round_number: number }>>`
    SELECT solved, round_number 
    FROM door_states 
    WHERE team_name = ${key} AND door_number = ${doorNumber}
    LIMIT 1
  `;

  if (!door) return null;

  const now = Date.now();
  const newlySolved = !door.solved;

  if (newlySolved) {
    await sql`
      UPDATE door_states
      SET solved = TRUE,
          fragment = ${fragment},
          solved_at = ${now},
          attempts = attempts + 1
      WHERE team_name = ${key} AND door_number = ${doorNumber}
    `;
  } else {
    // Already solved: preserve solved status and fragment, update sync
    await sql`
      UPDATE door_states
      SET attempts = attempts + 1
      WHERE team_name = ${key} AND door_number = ${doorNumber}
    `;
  }

  await sql`UPDATE teams SET last_sync = ${now} WHERE team_name = ${key}`;

  const t = await getTeam(key);
  if (!t) return null;
  return { team: t, newlySolved };
}

/**
 * Record a failed or intermediate attempt on a door without marking solved.
 */
export async function recordAttempt(name: string, doorNumber: number): Promise<TeamState | null> {
  const key = norm(name);
  const sql = getSql();
  const now = Date.now();

  await sql`
    UPDATE door_states
    SET attempts = attempts + 1
    WHERE team_name = ${key} AND door_number = ${doorNumber}
  `;

  await sql`UPDATE teams SET last_sync = ${now} WHERE team_name = ${key}`;

  return getTeam(key);
}

/**
 * Start a round for a team. Sets started_at if not already set.
 */
export async function startRound(name: string, roundArg?: number): Promise<TeamState | null> {
  const key = norm(name);
  const sql = getSql();

  const { eventStartTime } = await getEventConfig();
  const activeRound = (calculateActiveRound(eventStartTime) || 1) as 1 | 2 | 3;
  const targetRound = (roundArg && (roundArg === 1 || roundArg === 2 || roundArg === 3)) ? roundArg : activeRound;

  const now = Date.now();
  await sql`
    UPDATE round_states
    SET started_at = COALESCE(started_at, ${now}),
        status = 'active'
    WHERE team_name = ${key} AND round_number = ${targetRound}
  `;

  await sql`
    UPDATE teams
    SET current_round = ${targetRound}, last_sync = ${now}
    WHERE team_name = ${key}
  `;

  return getTeam(key);
}

/**
 * Record Master Key submission in PostgreSQL.
 * If accepted=true, calculates deterministic elapsed_ms with millisecond precision
 * relative to the official round start time.
 */
export async function setMasterKey(
  name: string,
  accepted: boolean,
  roundArg?: number
): Promise<{ team: TeamState; accepted: boolean; error?: string } | null> {
  const key = norm(name);
  const sql = getSql();

  const { eventStartTime } = await getEventConfig();
  const activeRound = (calculateActiveRound(eventStartTime) || 1) as 1 | 2 | 3;
  const targetRound = (roundArg && (roundArg === 1 || roundArg === 2 || roundArg === 3)) ? roundArg : activeRound;

  const now = Date.now();

  if (accepted) {
    const officialStart = getOfficialRoundStartTime(targetRound, eventStartTime);
    const elapsedMs = Math.max(0, now - officialStart);

    await sql`
      UPDATE round_states
      SET master_key = TRUE,
          master_key_at = ${now},
          finished_at = ${now},
          status = 'complete',
          elapsed_ms = COALESCE(elapsed_ms, ${elapsedMs}),
          master_key_attempts = master_key_attempts + 1
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

  const [top10Rows, countRows] = await Promise.all([
    sql<Array<{
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
    `,
    sql<Array<{ count: string | number }>>`
      SELECT COUNT(*) as count 
      FROM round_states 
      WHERE round_number = ${round} AND status = 'complete' AND elapsed_ms IS NOT NULL
    `,
  ]);

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

  const totalCompleted = Number(countRows[0]?.count || 0);
  let currentTeamEntry: LeaderboardEntry | null = null;

  if (currentTeamName) {
    const key = norm(currentTeamName);
    const inTop10 = top10.find((e) => norm(e.team) === key);
    if (inTop10) {
      currentTeamEntry = inTop10;
    } else {
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


