import { NextResponse } from "next/server";
import { getFullSyncData } from "@/lib/store";
import { getEventSchedule } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const t0 = performance.now();

  try {
    const { searchParams } = new URL(req.url);
    const teamName = searchParams.get("team");

    let schedule: any = null;
    let teamInfo: any = null;
    let connWaitMs = 0;
    let sqlExecMs = 0;

    if (teamName) {
      const syncResult = await getFullSyncData(teamName);
      if (syncResult && syncResult.data) {
        schedule = syncResult.data.schedule;
        teamInfo = syncResult.data.team;
        connWaitMs = syncResult.connWaitMs;
        sqlExecMs = syncResult.sqlExecMs;
      }
    }

    // Fallback if teamName wasn't provided or not found
    if (!schedule) {
      const tSched0 = performance.now();
      schedule = await getEventSchedule();
      sqlExecMs += performance.now() - tSched0;
    }

    const totalMs = performance.now() - t0;
    const appMs = Math.max(0, totalMs - (connWaitMs + sqlExecMs));

    const res = NextResponse.json({
      schedule,
      team: teamInfo,
      _timing: {
        totalMs: Number(totalMs.toFixed(1)),
        connWaitMs: Number(connWaitMs.toFixed(1)),
        sqlExecMs: Number(sqlExecMs.toFixed(1)),
        appMs: Number(appMs.toFixed(1)),
      },
    });

    res.headers.set(
      "Server-Timing",
      `conn;dur=${connWaitMs.toFixed(1)}, sql;dur=${sqlExecMs.toFixed(1)}, app;dur=${appMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`
    );
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
