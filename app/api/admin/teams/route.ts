import { NextResponse } from "next/server";
import { listTeams } from "@/lib/store";
import { getEventSchedule } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function GET() {
  try {
    const teams = await listTeams();
    const schedule = await getEventSchedule();
    return NextResponse.json({
      schedule,
      teams,
      totalTeams: teams.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
