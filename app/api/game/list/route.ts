import { NextResponse } from "next/server";
import { listTeams } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const teams = await listTeams();
    return NextResponse.json(teams);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
