import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/schema";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    await ensureSchema();
    return NextResponse.json({ ok: true, message: "Schema verified and migrated successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Migration failed" }, { status: 500 });
  }
}
