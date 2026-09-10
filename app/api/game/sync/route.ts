import { NextResponse } from "next/server";
import { getTeam } from "@/lib/store";
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
    let teamInfo: any = null;

    if (teamName) {
      const t = await getTeam(teamName);
      if (t) {
        const activeRound = schedule.activeRound || 1;
        const curRound = t.rounds[activeRound];
        teamInfo = {
          team: t.team,
          currentRound: activeRound,
          doors: curRound ? curRound.doors.map((d) => ({ solved: d.solved, fragment: d.fragment, attempts: d.attempts })) : [],
          masterKey: curRound ? curRound.masterKey : false,
          status: curRound ? curRound.status : "active",
          roundsSummary: {
            1: { status: t.rounds[1]?.status, elapsedMs: t.rounds[1]?.elapsedMs, elapsedSec: t.rounds[1]?.elapsedSec },
            2: { status: t.rounds[2]?.status, elapsedMs: t.rounds[2]?.elapsedMs, elapsedSec: t.rounds[2]?.elapsedSec },
            3: { status: t.rounds[3]?.status, elapsedMs: t.rounds[3]?.elapsedMs, elapsedSec: t.rounds[3]?.elapsedSec },
          },
        };
      }
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
