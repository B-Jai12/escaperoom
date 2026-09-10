import { NextResponse } from "next/server";

const DEFAULT_ADMIN_SECRET = "GAUNTLET_ADMIN_2026";

/**
 * Verifies if an incoming HTTP request contains valid admin credentials.
 * Checks for:
 * 1. 'x-admin-key' header
 * 2. 'authorization: Bearer <token>' header
 * Matches against ADMIN_SECRET or ADMIN_PASSWORD env var, falling back to GAUNTLET_ADMIN_2026.
 */
export function verifyAdmin(req: Request): boolean {
  const expectedSecret =
    process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_SECRET;

  // Check x-admin-key
  const adminKeyHeader = req.headers.get("x-admin-key");
  if (adminKeyHeader && adminKeyHeader === expectedSecret) {
    return true;
  }

  // Check Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token === expectedSecret) {
      return true;
    }
  }

  return false;
}

/**
 * Enforces admin authentication on a route.
 * Returns null if authorized, or a 401 Unauthorized NextResponse if rejected.
 */
export function requireAdmin(req: Request): NextResponse | null {
  if (!verifyAdmin(req)) {
    return NextResponse.json(
      {
        error: "Unauthorized: Missing or invalid administrator credentials",
        status: 401,
      },
      { status: 401 }
    );
  }
  return null;
}
