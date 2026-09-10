import { NextResponse } from "next/server";
import { listTeams } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const teams = await listTeams();
    return NextResponse.json(teams);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
