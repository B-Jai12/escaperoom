import { NextResponse } from "next/server";
import { getOrCreateTeam, startRound, getTeam } from "@/lib/store";
import { getEventSchedule } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const t0 = performance.now();
  try {
    const { searchParams } = new URL(req.url);
    const teamName = searchParams.get("team");
    const tDb0 = performance.now();
    const schedule = await getEventSchedule();

    if (!teamName) {
      const dbMs = performance.now() - tDb0;
      const totalMs = performance.now() - t0;
      const res = NextResponse.json({ schedule, _timing: { totalMs, dbMs } });
      res.headers.set("Server-Timing", `db;dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
      return res;
    }

    const team = await getTeam(teamName);
    const dbMs = performance.now() - tDb0;
    const totalMs = performance.now() - t0;

    if (!team) {
      return NextResponse.json({ error: "team not found", schedule }, { status: 404 });
    }

    // Check if client provided matching session ID
    const clientSessionId = req.headers.get("x-session-id");
    const isOwner = clientSessionId && clientSessionId === team.sessionId;

    // Sanitize: do not leak private session ID to arbitrary public callers
    const safeTeam = isOwner
      ? team
      : {
          ...team,
          sessionId: undefined,
        };

    const res = NextResponse.json({
      ...safeTeam,
      schedule,
      _timing: { totalMs: Number(totalMs.toFixed(1)), dbMs: Number(dbMs.toFixed(1)) },
    });
    res.headers.set("Server-Timing", `db;dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const t0 = performance.now();
  try {
    const body = await req.json();
    const { team, start } = body ?? {};
    if (typeof team !== "string" || !team.trim()) {
      return NextResponse.json({ error: "team required" }, { status: 400 });
    }

    const tDb0 = performance.now();
    const { team: teamObj, created } = await getOrCreateTeam(team);
    if (start && !created) {
      await startRound(team);
    }
    const schedule = await getEventSchedule();
    const dbMs = performance.now() - tDb0;
    const totalMs = performance.now() - t0;

    const res = NextResponse.json({
      session: {
        ...teamObj,
        schedule,
      },
      schedule,
      _timing: { totalMs: Number(totalMs.toFixed(1)), dbMs: Number(dbMs.toFixed(1)) },
    });
    res.headers.set("Server-Timing", `db;dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
