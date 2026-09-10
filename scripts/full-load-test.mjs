import fs from 'fs';
import path from 'path';

// Target URL - can be set via env or default to live Vercel deployment
const TARGET_URL = process.env.BASE_URL || 'https://escaperoom-gamma-drab.vercel.app';
const ENV_FILE = 'C:/Users/Jai/OneDrive/Documents/Desktop/escaperoom/.env.local';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(ENV_FILE)) {
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.substring('DATABASE_URL='.length).trim();
      if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
        dbUrl = dbUrl.slice(1, -1);
      }
      break;
    }
  }
}

let sql = null;
try {
  const postgresModule = await import('file:///C:/Users/Jai/OneDrive/Documents/Desktop/escaperoom/node_modules/postgres/src/index.js');
  const postgres = postgresModule.default || postgresModule;
  if (dbUrl) {
    sql = postgres(dbUrl, { prepare: false, ssl: { rejectUnauthorized: false }, max: 10 });
  }
} catch (e) {
  console.log('Postgres import skipped or direct DB unavailable:', e.message);
}

const allLatencies = [];
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let dbErrorCount = 0;
let timeoutCount = 0;

async function request(url, options = {}, timeoutMs = 25000) {
  totalRequests++;
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    const latency = performance.now() - start;
    allLatencies.push(latency);

    let data = null;
    let text = '';
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      text = await res.text().catch(() => '');
    }

    if (res.ok) {
      successfulRequests++;
      return { ok: true, status: res.status, data, latency };
    } else {
      failedRequests++;
      if (text.includes('database') || text.includes('DATABASE') || (data && data.error && data.error.includes('database'))) {
        dbErrorCount++;
      }
      return { ok: false, status: res.status, error: (data && data.error) || text, latency };
    }
  } catch (err) {
    clearTimeout(timer);
    const latency = performance.now() - start;
    allLatencies.push(latency);
    failedRequests++;
    if (err.name === 'AbortError') {
      timeoutCount++;
      return { ok: false, status: 0, error: 'TIMEOUT', latency };
    }
    return { ok: false, status: 0, error: err.message, latency };
  }
}

function calcPercentiles(lats) {
  if (lats.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...lats].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return { p50, p95, p99, min, max, avg };
}

async function runSuite() {
  console.log('============================================================');
  console.log('STARTING REAL CONCURRENCY / LOAD TEST');
  console.log(`Target: ${TARGET_URL}`);
  console.log('Concurrency: ~90 concurrent users, ~70 distinct teams');
  console.log('Timestamp:', new Date().toISOString());
  console.log('============================================================\n');

  // STEP 0: Reset and start clock for Round 1
  console.log('[STEP 0] Resetting and starting official event clock for Round 1...');
  const resetRes = await request(`${TARGET_URL}/api/admin/clock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'jumpRound', setRound: 1 })
  });
  console.log(`Clock reset result: status ${resetRes.status}, activeRound: ${resetRes.data?.activeRound}, status: ${resetRes.data?.eventStatus}`);

  // ============================================================
  // TEST 1 — EVENT STATUS (90 simultaneous clients)
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 1 — EVENT STATUS (90 simultaneous clients)');
  console.log('Simulating simultaneous requests to /api/game, /api/game/sync, /api/admin/clock');
  console.log('============================================================');

  const t1Latencies = [];
  const t1Promises = [];

  for (let i = 0; i < 30; i++) {
    t1Promises.push(request(`${TARGET_URL}/api/game`).then(r => { t1Latencies.push(r.latency); return r; }));
    t1Promises.push(request(`${TARGET_URL}/api/game/sync?team=ALPHA_TEST`).then(r => { t1Latencies.push(r.latency); return r; }));
    t1Promises.push(request(`${TARGET_URL}/api/admin/clock`).then(r => { t1Latencies.push(r.latency); return r; }));
  }

  const t1Results = await Promise.all(t1Promises);
  const t1Success = t1Results.filter(r => r.ok).length;
  const t1Failed = t1Results.filter(r => !r.ok).length;
  const t1Stats = calcPercentiles(t1Latencies);

  console.log(`Test 1 Results: Total: ${t1Results.length} | Success: ${t1Success} | Failed: ${t1Failed}`);
  console.log(`Latency: p50 = ${t1Stats.p50.toFixed(1)}ms, p95 = ${t1Stats.p95.toFixed(1)}ms, p99 = ${t1Stats.p99.toFixed(1)}ms (min: ${t1Stats.min.toFixed(1)}ms, max: ${t1Stats.max.toFixed(1)}ms)`);

  // ============================================================
  // TEST 2 — LEADERBOARD (90 simultaneous requests)
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 2 — LEADERBOARD (90 simultaneous requests)');
  console.log('Simulating simultaneous requests to /api/leaderboard?round=1');
  console.log('============================================================');

  const t2Latencies = [];
  const t2Promises = [];
  for (let i = 0; i < 90; i++) {
    t2Promises.push(
      request(`${TARGET_URL}/api/leaderboard?round=1&team=TEAM_${i}`).then(r => {
        t2Latencies.push(r.latency);
        return r;
      })
    );
  }

  const t2Results = await Promise.all(t2Promises);
  const t2Success = t2Results.filter(r => r.ok).length;
  const t2Failed = t2Results.filter(r => !r.ok).length;
  const t2Stats = calcPercentiles(t2Latencies);
  const sampleData = t2Results.find(r => r.ok)?.data;

  console.log(`Test 2 Results: Total: ${t2Results.length} | Success: ${t2Success} | Failed: ${t2Failed}`);
  console.log(`Latency: p50 = ${t2Stats.p50.toFixed(1)}ms, p95 = ${t2Stats.p95.toFixed(1)}ms, p99 = ${t2Stats.p99.toFixed(1)}ms`);
  console.log(`Leaderboard Top 10 entries returned: ${sampleData?.top10?.length || 0}`);

  // ============================================================
  // TEST 3 — TEAM REGISTRATION (~70 distinct teams)
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 3 — TEAM REGISTRATION (~70 distinct test teams)');
  console.log('Simulating simultaneous registration of 70 distinct teams');
  console.log('============================================================');

  const t3Latencies = [];
  const t3Promises = [];
  const teamNames = [];
  for (let i = 1; i <= 70; i++) {
    const tName = `GAUNTLET_T${String(i).padStart(2, '0')}`;
    teamNames.push(tName);
    t3Promises.push(
      request(`${TARGET_URL}/api/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: tName, start: true })
      }).then(r => {
        t3Latencies.push(r.latency);
        return { team: tName, ...r };
      })
    );
  }

  const t3Results = await Promise.all(t3Promises);
  const t3Success = t3Results.filter(r => r.ok).length;
  const t3Failed = t3Results.filter(r => !r.ok).length;
  const t3Stats = calcPercentiles(t3Latencies);

  console.log(`Test 3 Results: Total: ${t3Results.length} | Success: ${t3Success} | Failed: ${t3Failed}`);
  console.log(`Latency: p50 = ${t3Stats.p50.toFixed(1)}ms, p95 = ${t3Stats.p95.toFixed(1)}ms, p99 = ${t3Stats.p99.toFixed(1)}ms`);

  // Verify unique session IDs
  const sessionIds = new Set(t3Results.filter(r => r.ok).map(r => r.data?.sessionId));
  console.log(`Distinct session IDs created: ${sessionIds.size} / 70`);

  // ============================================================
  // TEST 4 — CONCURRENT DOOR SUBMISSIONS & IDEMPOTENCY
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 4 — CONCURRENT DOOR SUBMISSIONS & IDEMPOTENCY');
  console.log('Submitting Door 1 answers across 30 teams with concurrent duplicate requests');
  console.log('============================================================');

  const t4Latencies = [];
  const t4Promises = [];
  const duplicateTeams = teamNames.slice(0, 15);

  for (let i = 0; i < 30; i++) {
    const tName = teamNames[i];
    // First request
    t4Promises.push(
      request(`${TARGET_URL}/api/game/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: tName, door: 1, fragment: '428', answer: '428' })
      }).then(r => { t4Latencies.push(r.latency); return { team: tName, ...r }; })
    );

    // If duplicate team, send second identical request immediately in parallel
    if (duplicateTeams.includes(tName)) {
      t4Promises.push(
        request(`${TARGET_URL}/api/game/solve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: tName, door: 1, fragment: '428', answer: '428' })
        }).then(r => { t4Latencies.push(r.latency); return { team: tName, duplicate: true, ...r }; })
      );
    }
  }

  const t4Results = await Promise.all(t4Promises);
  const t4Success = t4Results.filter(r => r.ok).length;
  const t4Failed = t4Results.filter(r => !r.ok).length;
  const t4Stats = calcPercentiles(t4Latencies);

  // Analyze newlySolved vs duplicate
  let newlySolvedCount = 0;
  let idempotentIgnoredCount = 0;
  for (const r of t4Results) {
    if (r.ok && r.data) {
      if (r.data.newlySolved === true) newlySolvedCount++;
      else if (r.data.newlySolved === false) idempotentIgnoredCount++;
    }
  }

  console.log(`Test 4 Results: Total Requests: ${t4Results.length} | Success: ${t4Success} | Failed: ${t4Failed}`);
  console.log(`Latency: p50 = ${t4Stats.p50.toFixed(1)}ms, p95 = ${t4Stats.p95.toFixed(1)}ms, p99 = ${t4Stats.p99.toFixed(1)}ms`);
  console.log(`newlySolved = true: ${newlySolvedCount} (Expected: 30 distinct teams)`);
  console.log(`newlySolved = false: ${idempotentIgnoredCount} (Expected: 15 duplicate requests safely deduplicated)`);

  // ============================================================
  // TEST 5 — SIMULTANEOUS MASTER KEY COMPLETION
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 5 — SIMULTANEOUS MASTER KEY COMPLETION');
  console.log('Pre-solving doors 2..6 for 20 teams, then firing concurrent Master Key submissions');
  console.log('============================================================');

  const r1Codes = ['428', '731', '195', '604', '382', '917'];
  const masterTeams = teamNames.slice(0, 20);

  // Pre-solve doors 2..6 in batches of 20
  console.log('Pre-solving doors 2..6 for 20 test teams...');
  for (let d = 2; d <= 6; d++) {
    const code = r1Codes[d - 1];
    const doorBatch = masterTeams.map(tName =>
      request(`${TARGET_URL}/api/game/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: tName, door: d, fragment: code })
      })
    );
    await Promise.all(doorBatch);
  }

  console.log('Firing simultaneous Master Key submissions for 20 teams (including 5 duplicate bursts)...');
  const t5Latencies = [];
  const t5Promises = [];

  for (let i = 0; i < masterTeams.length; i++) {
    const tName = masterTeams[i];
    t5Promises.push(
      request(`${TARGET_URL}/api/game/master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: tName, sequence: r1Codes, round: 1 })
      }).then(r => { t5Latencies.push(r.latency); return { team: tName, ...r }; })
    );

    // Duplicate submission for first 5 teams
    if (i < 5) {
      t5Promises.push(
        request(`${TARGET_URL}/api/game/master`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: tName, sequence: r1Codes, round: 1 })
        }).then(r => { t5Latencies.push(r.latency); return { team: tName, duplicate: true, ...r }; })
      );
    }
  }

  const t5Results = await Promise.all(t5Promises);
  const t5Success = t5Results.filter(r => r.ok && r.data?.accepted).length;
  const t5Failed = t5Results.filter(r => !r.ok || !r.data?.accepted).length;
  const t5Stats = calcPercentiles(t5Latencies);

  console.log(`Test 5 Results: Total: ${t5Results.length} | Accepted: ${t5Success} | Failed: ${t5Failed}`);
  console.log(`Latency: p50 = ${t5Stats.p50.toFixed(1)}ms, p95 = ${t5Stats.p95.toFixed(1)}ms, p99 = ${t5Stats.p99.toFixed(1)}ms`);

  // Verify leaderboard response
  const lbCheck = await request(`${TARGET_URL}/api/leaderboard?round=1`);
  console.log(`Leaderboard query: top10 count = ${lbCheck.data?.top10?.length || 0}, totalCompleted = ${lbCheck.data?.totalCompleted}`);
  if (lbCheck.data?.top10?.length > 0) {
    console.log('Top 3 Leaderboard entries:');
    lbCheck.data.top10.slice(0, 3).forEach((e, idx) => {
      console.log(`  Rank ${idx + 1}: ${e.team} | ${e.formattedTime} (${e.elapsedMs}ms)`);
    });
  }

  // ============================================================
  // TEST 6 — ROUND TRANSITION (Clock Transition + Gating)
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 6 — ROUND TRANSITION (ROUND 1 -> ROUND 2 -> ROUND 3)');
  console.log('Simulating round transition and checking client synchronization & gating');
  console.log('============================================================');

  // Jump to Round 2
  console.log('Transitioning clock to Round 2...');
  const r2Clock = await request(`${TARGET_URL}/api/admin/clock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'jumpRound', setRound: 2 })
  });
  console.log(`Clock set to Round 2: activeRound = ${r2Clock.data?.activeRound}`);

  // Test 90 clients synchronizing to Round 2
  const t6Promises = [];
  const t6Latencies = [];
  for (let i = 0; i < 90; i++) {
    const tName = teamNames[i % teamNames.length];
    t6Promises.push(
      request(`${TARGET_URL}/api/game/sync?team=${encodeURIComponent(tName)}`).then(r => {
        t6Latencies.push(r.latency);
        return r;
      })
    );
  }
  const t6Results = await Promise.all(t6Promises);
  const r2SyncedCount = t6Results.filter(r => r.ok && (r.data?.round === 2 || r.data?.currentRound === 2)).length;
  console.log(`90 clients sync to Round 2: ${r2SyncedCount} / 90 returned activeRound = 2`);

  // Verify round gating: Late submission to Round 1 Door 1 must be rejected
  console.log('Testing Round Gating: Submitting to Round 1 Door while Round 2 is active...');
  const lateSubmit = await request(`${TARGET_URL}/api/game/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team: teamNames[0], door: 1, fragment: '428' })
  });
  console.log(`Late submission result (Expected: 403 Forbidden): Status ${lateSubmit.status}, Error: ${lateSubmit.error}`);

  // Verify early submission to Round 3 Door 13 must be rejected
  console.log('Testing Round Gating: Submitting to Round 3 Door while Round 2 is active...');
  const earlySubmit = await request(`${TARGET_URL}/api/game/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team: teamNames[0], door: 13, fragment: '624' })
  });
  console.log(`Early submission result (Expected: 403 Forbidden): Status ${earlySubmit.status}, Error: ${earlySubmit.error}`);

  // Transition to Round 3
  console.log('Transitioning clock to Round 3...');
  const r3Clock = await request(`${TARGET_URL}/api/admin/clock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'jumpRound', setRound: 3 })
  });
  console.log(`Clock set to Round 3: activeRound = ${r3Clock.data?.activeRound}`);

  // Reset clock back to Round 1
  console.log('Resetting clock back to Round 1...');
  await request(`${TARGET_URL}/api/admin/clock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'jumpRound', setRound: 1 })
  });

  // ============================================================
  // TEST 7 — DATABASE CONNECTIONS & INTEGRITY AUDIT
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 7 — DATABASE CONNECTIONS & INTEGRITY AUDIT (Supabase PostgreSQL)');
  console.log('============================================================');

  let peakConnections = 'N/A';
  let duplicateCompletions = 0;
  let duplicateCodeAwards = 0;

  if (sql) {
    try {
      const conns = await sql`
        SELECT state, count(*) as count 
        FROM pg_stat_activity 
        GROUP BY state
      `;
      console.log('Supabase Connection Pool status:');
      let totalConns = 0;
      for (const row of conns) {
        console.log(`  State: ${row.state || 'active/idle'} => ${row.count}`);
        totalConns += Number(row.count);
      }
      peakConnections = `${totalConns} connections`;

      // Check for duplicate teams
      const dupTeams = await sql`
        SELECT team_name, count(*) as count 
        FROM teams 
        GROUP BY team_name 
        HAVING count(*) > 1
      `;
      console.log(`Duplicate team rows in DB: ${dupTeams.length}`);

      // Check for duplicate door records
      const dupDoors = await sql`
        SELECT team_name, door_number, count(*) as count 
        FROM door_states 
        GROUP BY team_name, door_number 
        HAVING count(*) > 1
      `;
      console.log(`Duplicate door rows in DB: ${dupDoors.length}`);
      duplicateCodeAwards = dupDoors.length;

      // Check for duplicate completed round states
      const dupCompletions = await sql`
        SELECT team_name, round_number, count(*) as count 
        FROM round_states 
        WHERE status = 'complete' 
        GROUP BY team_name, round_number 
        HAVING count(*) > 1
      `;
      console.log(`Duplicate round completion rows in DB: ${dupCompletions.length}`);
      duplicateCompletions = dupCompletions.length;

      // Total teams created in DB
      const [teamCountRow] = await sql`SELECT count(*) as count FROM teams`;
      console.log(`Total teams verified in DB: ${teamCountRow.count}`);

      await sql.end();
    } catch (dbErr) {
      console.error('Direct DB audit query error:', dbErr.message);
    }
  } else {
    console.log('Direct SQL connection not available in runner environment.');
  }

  // ============================================================
  // FINAL AGGREGATED METRICS SUMMARY
  // ============================================================
  const overallStats = calcPercentiles(allLatencies);
  const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : '0.00';

  console.log('\n============================================================');
  console.log('TEST 9 — ACTUAL METRICS SUMMARY');
  console.log('============================================================');
  console.log(`Concurrent users:         90`);
  console.log(`Distinct teams:           70`);
  console.log(`Total requests:           ${totalRequests}`);
  console.log(`Successful requests:      ${successfulRequests}`);
  console.log(`Failed requests:          ${failedRequests}`);
  console.log(`Error rate:               ${errorRate}%`);
  console.log(`p50 latency:              ${overallStats.p50.toFixed(1)} ms`);
  console.log(`p95 latency:              ${overallStats.p95.toFixed(1)} ms`);
  console.log(`p99 latency:              ${overallStats.p99.toFixed(1)} ms`);
  console.log(`Database errors:          ${dbErrorCount}`);
  console.log(`Timeouts:                 ${timeoutCount}`);
  console.log(`Duplicate completions:    ${duplicateCompletions}`);
  console.log(`Duplicate code awards:    ${duplicateCodeAwards}`);
  console.log(`Peak DB connections:      ${peakConnections}`);
  console.log('============================================================\n');
}

runSuite().catch(err => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
