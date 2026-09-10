import { NextResponse } from "next/server";
import getSql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { invalidateEventCache } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const sql = getSql();

    // 1. Delete all test teams (cascades to door_states and round_states)
    const deleted = await sql<Array<{ team_name: string }>>`
      DELETE FROM teams 
      WHERE team_name LIKE 'GAUNTLET_%' 
         OR team_name LIKE 'PROD_TEST_%' 
         OR team_name LIKE 'TEST_%'
         OR team_name LIKE 'LOAD_%'
         OR team_name LIKE 'ALPHA_%'
         OR team_name LIKE 'AUDIT_%'
      RETURNING team_name;
    `;

    // 2. Reset event clock to 'not_started' state
    const now = Date.now();
    await sql`
      UPDATE events 
      SET event_status = 'not_started', 
          event_start_time = ${now}, 
          updated_at = NOW() 
      WHERE id = 'default';
    `;

    invalidateEventCache();

    // 3. Verify remaining teams
    const remaining = await sql<Array<{ team_name: string; status: string }>>`
      SELECT team_name, status FROM teams ORDER BY created_at ASC;
    `;

    return NextResponse.json({
      ok: true,
      message: "Test data successfully purged. Event clock reset to 'not_started'.",
      purgedCount: deleted.length,
      purgedTeams: deleted.map((t) => t.team_name),
      remainingCount: remaining.length,
      remainingTeams: remaining.map((t) => t.team_name),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Cleanup failed" }, { status: 500 });
  }
}

