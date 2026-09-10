import { NextResponse } from "next/server";
import { recordAttempt } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, door } = body ?? {};
    if (typeof team !== "string" || typeof door !== "number") {
      return NextResponse.json({ error: "team + door required" }, { status: 400 });
    }
    const updated = await recordAttempt(team, door);
    if (!updated) return NextResponse.json({ error: "team or door invalid" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
