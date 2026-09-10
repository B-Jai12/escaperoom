import { NextResponse } from "next/server";
import { getTeamSyncData } from "@/lib/store";
import { getEventSchedule } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const t0 = performance.now();
  let dbMs = 0;

  try {
    const { searchParams } = new URL(req.url);
    const teamName = searchParams.get("team");

    const tDb0 = performance.now();
    const schedule = await getEventSchedule();
    const activeRound = schedule.activeRound || 1;

    let teamInfo: any = null;
    if (teamName) {
      teamInfo = await getTeamSyncData(teamName, activeRound);
    }
    dbMs = performance.now() - tDb0;
    const totalMs = performance.now() - t0;
    const appMs = Math.max(0, totalMs - dbMs);

    const res = NextResponse.json({
      schedule,
      team: teamInfo,
      _timing: { totalMs: Number(totalMs.toFixed(1)), dbMs: Number(dbMs.toFixed(1)), appMs: Number(appMs.toFixed(1)) },
    });
    res.headers.set("Server-Timing", `db;dur=${dbMs.toFixed(1)}, app;dur=${appMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
