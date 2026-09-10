import { NextResponse } from "next/server";
import { getTeam, setMasterKey } from "@/lib/store";
import { getActiveRound } from "@/lib/eventClock";
import { ROUNDS_CONFIG } from "@/app/puzzleData";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, sequence, key, round: roundArg } = body ?? {};

    if (typeof team !== "string" || !team.trim()) {
      return NextResponse.json({ error: "team required" }, { status: 400 });
    }

    const t = await getTeam(team);
    if (!t) return NextResponse.json({ error: "team invalid" }, { status: 404 });

    const activeRound = await getActiveRound();
    if (!activeRound) {
      return NextResponse.json({ error: "Event complete. No rounds active." }, { status: 403 });
    }

    const targetRound: 1 | 2 | 3 =
      roundArg === 1 || roundArg === 2 || roundArg === 3 ? roundArg : activeRound;

    if (targetRound !== activeRound) {
      return NextResponse.json(
        { error: `Round ${targetRound} is not active. Current round is ${activeRound}.` },
        { status: 403 }
      );
    }

    const roundState = t.rounds[targetRound];
    if (!roundState) {
      return NextResponse.json({ error: "Round state not found" }, { status: 500 });
    }

    const expectedOrder = ROUNDS_CONFIG[targetRound].masterKeyOrder;

    // 1. Verify all six doors are completed
    const allDoorsSolved =
      Array.isArray(roundState.doors) &&
      roundState.doors.length === 6 &&
      roundState.doors.every((d) => d.solved);

    if (!allDoorsSolved) {
      return NextResponse.json(
        {
          accepted: false,
          error: "ALL SIX DOORS MUST BE COMPLETED BEFORE MASTER KEY ACTIVATION",
          solvedDoors: roundState.doors.filter((d) => d.solved).length,
        },
        { status: 400 }
      );
    }

    // 2. Verify all six codes have legitimately been awarded
    const allCodesAwarded = roundState.doors.every(
      (d, i) => typeof d.fragment === "string" && d.fragment.trim().toUpperCase() === expectedOrder[i].toUpperCase()
    );

    if (!allCodesAwarded) {
      return NextResponse.json(
        {
          accepted: false,
          error: "LEGITIMATE DOOR CODES NOT DETECTED IN STORAGE",
        },
        { status: 400 }
      );
    }

    // Parse submitted codes
    let submittedCodes: string[] = [];

    if (Array.isArray(sequence)) {
      submittedCodes = sequence.map((s) => String(s || "").trim().toUpperCase());
    } else if (typeof sequence === "string" && sequence.trim()) {
      const clean = sequence.trim().toUpperCase();
      if (clean.includes("-")) {
        submittedCodes = clean.split("-").map((s) => s.trim());
      } else if (clean.includes(" ")) {
        submittedCodes = clean.split(/\s+/).map((s) => s.trim());
      } else if (clean.length === 18 && /^\d{18}$/.test(clean)) {
        for (let i = 0; i < 18; i += 3) {
          submittedCodes.push(clean.slice(i, i + 3));
        }
      }
    } else if (typeof key === "string" && key.trim()) {
      const clean = key.trim().toUpperCase();
      if (clean.includes("-")) {
        submittedCodes = clean.split("-").map((s) => s.trim());
      } else if (clean.includes(" ")) {
        submittedCodes = clean.split(/\s+/).map((s) => s.trim());
      } else if (clean.length === 18 && /^\d{18}$/.test(clean)) {
        for (let i = 0; i < 18; i += 3) {
          submittedCodes.push(clean.slice(i, i + 3));
        }
      }
    }

    if (submittedCodes.length !== 6 || submittedCodes.some((c) => c.length !== 3)) {
      return NextResponse.json(
        {
          accepted: false,
          error: "MASTER KEY REQUIRES EXACTLY SIX 3-DIGIT CODES IN DOOR ORDER",
        },
        { status: 400 }
      );
    }

    // 3. Verify each code matches the exact door code in fixed door order
    const isCorrect = submittedCodes.every(
      (code, i) => code === expectedOrder[i].toUpperCase()
    );

    if (isCorrect) {
      const res = await setMasterKey(team, true, targetRound);
      if (!res) return NextResponse.json({ error: "Team update failed" }, { status: 500 });
      if (res.error) return NextResponse.json({ error: res.error }, { status: 403 });

      return NextResponse.json({
        accepted: true,
        round: targetRound,
        elapsedMs: res.team.rounds[targetRound].elapsedMs,
        elapsedSec: res.team.rounds[targetRound].elapsedSec,
        message: "MASTER KEY ACCEPTED. PERIMETER ACCESS VERIFIED. ROUND COMPLETE.",
        team: res.team,
      });
    } else {
      // Incorrect attempt: increment attempts, preserve all doors & codes
      const res = await setMasterKey(team, false, targetRound);
      const attempts = res?.team?.rounds[targetRound]?.masterKeyAttempts || (roundState.masterKeyAttempts + 1);

      return NextResponse.json({
        accepted: false,
        error: "MASTER KEY INVALID. VERIFY DOOR CODES AND THEIR ORDER.",
        attempts,
        team: res?.team || t,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
