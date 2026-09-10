import { NextResponse } from "next/server";
import { completedTeams, getTeam, setStatus } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const list = await completedTeams();
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.team !== "string") {
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    }
    const t = await getTeam(body.team);
    if (!t) return NextResponse.json({ ok: false, error: "team not found" }, { status: 404 });
    const status = body.status === "DNF" ? "timeup" : "complete";
    const updated = await setStatus(t.team, status);
    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
