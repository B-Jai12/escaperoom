import { NextResponse } from "next/server";
import { getPublicLeaderboard } from "@/lib/store";
import { getActiveRound } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const t0 = performance.now();
  try {
    const { searchParams } = new URL(req.url);
    const roundParam = searchParams.get("round");
    const teamParam = searchParams.get("team") || undefined;

    const tDb0 = performance.now();
    let round: 1 | 2 | 3 = 1;
    if (roundParam === "1" || roundParam === "2" || roundParam === "3") {
      round = parseInt(roundParam, 10) as 1 | 2 | 3;
    } else {
      round = (await getActiveRound()) || 1;
    }

    const data = await getPublicLeaderboard(round, teamParam);
    const dbMs = performance.now() - tDb0;
    const totalMs = performance.now() - t0;
    const appMs = Math.max(0, totalMs - dbMs);

    const res = NextResponse.json({
      ...data,
      _timing: { totalMs: Number(totalMs.toFixed(1)), dbMs: Number(dbMs.toFixed(1)), appMs: Number(appMs.toFixed(1)) },
    });
    res.headers.set("Server-Timing", `db;dur=${dbMs.toFixed(1)}, app;dur=${appMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
