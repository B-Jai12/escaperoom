import postgres from "postgres";
import fs from "fs";
import path from "path";

// Load .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function cleanup() {
  console.log("--> Purging test data from PostgreSQL...");

  // Delete test teams (cascades to door_states and round_states)
  const deleted = await sql`
    DELETE FROM teams 
    WHERE team_name LIKE 'GAUNTLET_%' 
       OR team_name LIKE 'PROD_TEST_%' 
       OR team_name LIKE 'TEST_%'
       OR team_name LIKE 'LOAD_%'
    RETURNING team_name;
  `;

  console.log(`  ? Removed ${deleted.length} test teams and their associated round_states & door_states.`);

  // Reset event clock to pristine 'not_started' state
  const now = Date.now();
  await sql`
    UPDATE events 
    SET event_status = 'not_started', 
        event_start_time = ${now}, 
        updated_at = NOW() 
    WHERE id = 'default';
  `;

  console.log("  ? Official event clock reset to 'not_started'.");

  // Verify remaining real teams
  const remaining = await sql`SELECT team_name, created_at, status FROM teams ORDER BY created_at ASC`;
  console.log(`  ? Verified: ${remaining.length} non-test teams in database.`);
  for (const t of remaining) {
    console.log(`    - Team: ${t.team_name} (status: ${t.status})`);
  }

  await sql.end();
  console.log("--> Test data cleanup complete.");
}

cleanup().catch((e) => {
  console.error("Cleanup error:", e);
  process.exit(1);
});
