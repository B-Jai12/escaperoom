import getSql from "./db";

export const ROUND_DURATION_SEC = 45 * 60; // 2700 seconds (45 min)
export const TOTAL_ROUNDS = 3;
export const EVENT_DURATION_SEC = ROUND_DURATION_SEC * TOTAL_ROUNDS; // 8100 seconds (135 min)

export type EventConfig = {
  eventStartTime: number;
  roundDurationSec: number;
  totalRounds: number;
};

export type EventSchedule = {
  serverTime: number;
  eventStartTime: number;
  activeRound: 1 | 2 | 3 | null;
  roundTimeLeft: number;
  roundElapsed: number;
  round1Start: number;
  round1End: number;
  round2Start: number;
  round2End: number;
  round3Start: number;
  round3End: number;
  eventEnd: number;
  eventStatus: "not_started" | "active" | "complete";
};

/**
 * Fetch authoritative event configuration directly from PostgreSQL.
 * No local file reads.
 */
export async function getEventConfig(): Promise<EventConfig> {
  const sql = getSql();
  const rows = await sql<Array<{
    event_start_time: string | number;
    round_duration_sec: number;
    total_rounds: number;
  }>>`
    SELECT event_start_time, round_duration_sec, total_rounds 
    FROM events 
    WHERE id = 'default' 
    LIMIT 1
  `;

  if (rows && rows.length > 0) {
    return {
      eventStartTime: Number(rows[0].event_start_time),
      roundDurationSec: rows[0].round_duration_sec || ROUND_DURATION_SEC,
      totalRounds: rows[0].total_rounds || TOTAL_ROUNDS,
    };
  }

  // Insert initial default event row if not present
  const now = Date.now();
  const inserted = await sql<Array<{
    event_start_time: string | number;
    round_duration_sec: number;
    total_rounds: number;
  }>>`
    INSERT INTO events (id, event_name, event_status, event_start_time, round_duration_sec, total_rounds)
    VALUES ('default', 'The Codebreaker''s Gauntlet', 'active', ${now}, ${ROUND_DURATION_SEC}, ${TOTAL_ROUNDS})
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    RETURNING event_start_time, round_duration_sec, total_rounds
  `;

  return {
    eventStartTime: Number(inserted[0].event_start_time),
    roundDurationSec: inserted[0].round_duration_sec || ROUND_DURATION_SEC,
    totalRounds: inserted[0].total_rounds || TOTAL_ROUNDS,
  };
}

/**
 * Set official event start time in PostgreSQL.
 * Authoritative for all serverless instances.
 */
export async function setEventStartTime(startTime: number): Promise<EventConfig> {
  const sql = getSql();
  const rows = await sql<Array<{
    event_start_time: string | number;
    round_duration_sec: number;
    total_rounds: number;
  }>>`
    INSERT INTO events (id, event_name, event_status, event_start_time, round_duration_sec, total_rounds)
    VALUES ('default', 'The Codebreaker''s Gauntlet', 'active', ${startTime}, ${ROUND_DURATION_SEC}, ${TOTAL_ROUNDS})
    ON CONFLICT (id) DO UPDATE 
    SET event_start_time = ${startTime}, updated_at = NOW()
    RETURNING event_start_time, round_duration_sec, total_rounds
  `;

  return {
    eventStartTime: Number(rows[0].event_start_time),
    roundDurationSec: rows[0].round_duration_sec,
    totalRounds: rows[0].total_rounds,
  };
}

/**
 * Reset official event clock (e.g. for development / testing controls)
 */
export async function resetEventClock(elapsedSec = 0): Promise<EventConfig> {
  const startTime = Date.now() - elapsedSec * 1000;
  return setEventStartTime(startTime);
}

/**
 * Pure calculation helpers derived from authoritative eventStartTime
 */
export function getOfficialRoundStartTime(round: 1 | 2 | 3, eventStartTime: number): number {
  return eventStartTime + (round - 1) * ROUND_DURATION_SEC * 1000;
}

export function getOfficialRoundEndTime(round: 1 | 2 | 3, eventStartTime: number): number {
  return eventStartTime + round * ROUND_DURATION_SEC * 1000;
}

export function calculateActiveRound(eventStartTime: number, now = Date.now()): 1 | 2 | 3 | null {
  if (now < eventStartTime) return 1;
  const elapsed = (now - eventStartTime) / 1000;
  if (elapsed < ROUND_DURATION_SEC) return 1;
  if (elapsed < ROUND_DURATION_SEC * 2) return 2;
  if (elapsed < ROUND_DURATION_SEC * 3) return 3;
  return null; // event complete
}

export function calculateSchedule(eventStartTime: number, now = Date.now()): EventSchedule {
  const round1Start = eventStartTime;
  const round1End = round1Start + ROUND_DURATION_SEC * 1000;
  const round2Start = round1End;
  const round2End = round2Start + ROUND_DURATION_SEC * 1000;
  const round3Start = round2End;
  const round3End = round3Start + ROUND_DURATION_SEC * 1000;
  const eventEnd = round3End;

  let activeRound: 1 | 2 | 3 | null = null;
  let roundTimeLeft = 0;
  let roundElapsed = 0;
  let eventStatus: "not_started" | "active" | "complete" = "active";

  const totalElapsed = (now - eventStartTime) / 1000;

  if (now < eventStartTime) {
    activeRound = 1;
    roundTimeLeft = ROUND_DURATION_SEC;
    roundElapsed = 0;
    eventStatus = "not_started";
  } else if (totalElapsed < ROUND_DURATION_SEC) {
    activeRound = 1;
    roundTimeLeft = Math.max(0, Math.floor(ROUND_DURATION_SEC - totalElapsed));
    roundElapsed = Math.floor(totalElapsed);
    eventStatus = "active";
  } else if (totalElapsed < ROUND_DURATION_SEC * 2) {
    activeRound = 2;
    const r2Elapsed = totalElapsed - ROUND_DURATION_SEC;
    roundTimeLeft = Math.max(0, Math.floor(ROUND_DURATION_SEC - r2Elapsed));
    roundElapsed = Math.floor(r2Elapsed);
    eventStatus = "active";
  } else if (totalElapsed < ROUND_DURATION_SEC * 3) {
    activeRound = 3;
    const r3Elapsed = totalElapsed - ROUND_DURATION_SEC * 2;
    roundTimeLeft = Math.max(0, Math.floor(ROUND_DURATION_SEC - r3Elapsed));
    roundElapsed = Math.floor(r3Elapsed);
    eventStatus = "active";
  } else {
    activeRound = null;
    roundTimeLeft = 0;
    roundElapsed = ROUND_DURATION_SEC;
    eventStatus = "complete";
  }

  return {
    serverTime: now,
    eventStartTime,
    activeRound,
    roundTimeLeft,
    roundElapsed,
    round1Start,
    round1End,
    round2Start,
    round2End,
    round3Start,
    round3End,
    eventEnd,
    eventStatus,
  };
}

/**
 * Fetch full event schedule derived from authoritative DB state.
 */
export async function getEventSchedule(now = Date.now()): Promise<EventSchedule> {
  const { eventStartTime } = await getEventConfig();
  return calculateSchedule(eventStartTime, now);
}

/**
 * Get active round directly from authoritative DB state.
 */
export async function getActiveRound(now = Date.now()): Promise<1 | 2 | 3 | null> {
  const { eventStartTime } = await getEventConfig();
  return calculateActiveRound(eventStartTime, now);
}
