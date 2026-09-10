import { NextResponse } from "next/server";
import { getPublicLeaderboard } from "@/lib/store";
import { getActiveRound } from "@/lib/eventClock";

export const runtime = "nodejs";

type CachedLeaderboard = {
  data: any;
  timestamp: number;
};
const lbCache: Record<string, CachedLeaderboard> = {};

export async function GET(req: Request) {
  const t0 = performance.now();
  try {
    const { searchParams } = new URL(req.url);
    const roundParam = searchParams.get("round");
    const teamParam = searchParams.get("team") || undefined;

    let round: 1 | 2 | 3 = 1;
    if (roundParam === "1" || roundParam === "2" || roundParam === "3") {
      round = parseInt(roundParam, 10) as 1 | 2 | 3;
    } else {
      round = (await getActiveRound()) || 1;
    }

    const cacheKey = `${round}:${teamParam || ""}`;
    const cached = lbCache[cacheKey];
    const now = Date.now();
    if (cached && now - cached.timestamp < 2000) {
      const res = NextResponse.json({
        ...cached.data,
        _timing: { totalMs: 0.1, dbMs: 0, appMs: 0.1, cached: true },
      });
      res.headers.set("Server-Timing", `db;dur=0;desc="cached", total;dur=0.1`);
      return res;
    }

    const tDb0 = performance.now();
    const data = await getPublicLeaderboard(round, teamParam);
    const dbMs = performance.now() - tDb0;
    const totalMs = performance.now() - t0;
    const appMs = Math.max(0, totalMs - dbMs);

    lbCache[cacheKey] = { data, timestamp: now };

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
