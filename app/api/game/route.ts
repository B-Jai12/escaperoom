import { NextResponse } from "next/server";
import { getOrCreateTeam, startRound, getTeam } from "@/lib/store";
import { getEventSchedule } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamName = searchParams.get("team");
    const schedule = await getEventSchedule();

    if (!teamName) {
      return NextResponse.json({ schedule });
    }

    const team = await getTeam(teamName);
    if (!team) {
      return NextResponse.json({ error: "team not found", schedule }, { status: 404 });
    }

    return NextResponse.json({
      ...team,
      schedule,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, start } = body ?? {};
    if (typeof team !== "string" || !team.trim()) {
      return NextResponse.json({ error: "team required" }, { status: 400 });
    }

    const { team: teamObj } = await getOrCreateTeam(team);
    if (start) {
      await startRound(team);
    }

    const schedule = await getEventSchedule();
    return NextResponse.json({
      session: {
        ...teamObj,
        schedule,
      },
      schedule,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
