import { NextResponse } from "next/server";
import { getPublicLeaderboard } from "@/lib/store";
import { getActiveRound } from "@/lib/eventClock";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

    const data = await getPublicLeaderboard(round, teamParam);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
