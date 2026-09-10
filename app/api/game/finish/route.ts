import { NextResponse } from "next/server";
import { setStatus } from "@/lib/store";

export const runtime = "nodejs";

const ALLOWED = ["complete", "timeup"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, status, round } = body ?? {};
    if (typeof team !== "string" || !ALLOWED.includes(status)) {
      return NextResponse.json({ error: "team + status(complete|timeup) required" }, { status: 400 });
    }
    const roundArg = (round === 1 || round === 2 || round === 3) ? round : undefined;
    const updated = await setStatus(team, status as "complete" | "timeup", roundArg);
    if (!updated) return NextResponse.json({ error: "team invalid" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
