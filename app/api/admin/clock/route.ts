import { NextResponse } from "next/server";
import { getEventSchedule, setEventStartTime, resetEventClock, ROUND_DURATION_SEC } from "@/lib/eventClock";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const schedule = await getEventSchedule();
    return NextResponse.json(schedule);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { action, elapsedSec, startTime, setRound } = body ?? {};

    if (action === "startNow") {
      await setEventStartTime(Date.now());
    } else if (action === "setElapsed" && typeof elapsedSec === "number") {
      await resetEventClock(elapsedSec);
    } else if (action === "setStartTime" && typeof startTime === "number") {
      await setEventStartTime(startTime);
    } else if (action === "jumpRound" && (setRound === 1 || setRound === 2 || setRound === 3)) {
      // Jump clock to start of round 1, 2, or 3
      const offsetSec = (setRound - 1) * ROUND_DURATION_SEC;
      await resetEventClock(offsetSec + 5); // 5 seconds into the round
    } else if (action === "jumpNearEnd" && (setRound === 1 || setRound === 2 || setRound === 3)) {
      // Jump clock to 15s before round ends for transition testing!
      const offsetSec = setRound * ROUND_DURATION_SEC - 15;
      await resetEventClock(offsetSec);
    } else if (action === "resetNotStarted") {
      // Reset clock to not_started for clean event setup
      const config = await setEventStartTime(Date.now());
      // Directly mark not_started in DB
      const getSql = (await import("@/lib/db")).default;
      const sql = getSql();
      await sql`UPDATE events SET event_status = 'not_started' WHERE id = 'default'`;
    }

    const schedule = await getEventSchedule();
    return NextResponse.json(schedule);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
