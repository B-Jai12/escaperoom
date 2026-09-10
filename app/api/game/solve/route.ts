import { NextResponse } from "next/server";
import { solveDoor } from "@/lib/store";
import { getActiveRound } from "@/lib/eventClock";
import { ALL_PUZZLES } from "@/app/puzzleData";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, door, fragment, answer } = body ?? {};

    if (typeof team !== "string" || typeof door !== "number") {
      return NextResponse.json({ error: "team and door required" }, { status: 400 });
    }

    // Determine target puzzle
    let puzzle = ALL_PUZZLES.find((p) => p.doorNumber === door || p.id === door);
    if (!puzzle && door >= 0 && door < 6) {
      // Relative index within active round
      const active = (await getActiveRound()) || 1;
      const offset = (active - 1) * 6;
      puzzle = ALL_PUZZLES[offset + door];
    }

    if (!puzzle) {
      return NextResponse.json({ error: "Invalid door index" }, { status: 404 });
    }

    // Server-side answer validation if answer is supplied
    if (typeof answer === "string") {
      const cleanAnswer = answer.trim().toUpperCase();
      const valid =
        cleanAnswer === puzzle.answer.toUpperCase() ||
        puzzle.acceptedAnswers.some((a) => a.toUpperCase() === cleanAnswer);
      if (!valid) {
        return NextResponse.json({ accepted: false, error: "Incorrect answer" }, { status: 400 });
      }
    }

    const fragToAward = fragment || puzzle.fragment;
    const result = await solveDoor(team, puzzle.doorNumber, fragToAward);

    if (!result) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({
      accepted: true,
      newlySolved: result.newlySolved,
      doorNumber: puzzle.doorNumber,
      fragment: fragToAward,
      team: result.team,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
