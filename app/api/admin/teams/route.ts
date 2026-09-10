import { NextResponse } from "next/server";
import { listTeams } from "@/lib/store";
import { getEventSchedule } from "@/lib/eventClock";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

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
