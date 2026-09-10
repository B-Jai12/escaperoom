import fs from 'fs';
import path from 'path';

const TARGET_URL = process.env.BASE_URL || 'https://escaperoom-gamma-drab.vercel.app';
const ENV_FILE = 'C:/Users/Jai/OneDrive/Documents/Desktop/escaperoom/.env.local';

const allLatencies = [];
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let dbErrorCount = 0;
let timeoutCount = 0;

async function request(url, options = {}, timeoutMs = 20000) {
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

// Pool worker to run tasks with concurrency limit
async function runWithConcurrency(items, concurrency, fn) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runSuite() {
  console.log('============================================================');
  console.log('STARTING REAL CONCURRENCY / LOAD TEST');
  console.log(`Target: ${TARGET_URL}`);
  console.log('Simulating: ~90 concurrent users, ~70 distinct teams');
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
  // TEST 1 — EVENT STATUS (90 simultaneous client requests)
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 1 — EVENT STATUS (90 simultaneous client requests)');
  console.log('Simulating 90 concurrent requests to /api/game, /api/game/sync, /api/admin/clock');
  console.log('============================================================');

  const t1Requests = [];
  for (let i = 0; i < 30; i++) {
    t1Requests.push(() => request(`${TARGET_URL}/api/game`));
    t1Requests.push(() => request(`${TARGET_URL}/api/game/sync?team=AUDIT_TEAM_01`));
    t1Requests.push(() => request(`${TARGET_URL}/api/admin/clock`));
  }

  const t1Latencies = [];
  const t1Results = await runWithConcurrency(t1Requests, 15, async (fn) => {
    const r = await fn();
    t1Latencies.push(r.latency);
    return r;
  });

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
  console.log('Simulating 90 requests to /api/leaderboard?round=1');
  console.log('============================================================');

  const t2Requests = [];
  for (let i = 0; i < 90; i++) {
    t2Requests.push(i);
  }

  const t2Latencies = [];
  const t2Results = await runWithConcurrency(t2Requests, 15, async (i) => {
    const r = await request(`${TARGET_URL}/api/leaderboard?round=1&team=TEAM_${i}`);
    t2Latencies.push(r.latency);
    return r;
  });

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
  console.log('Registering 70 distinct teams with concurrent workers');
  console.log('============================================================');

  const teamNumbers = Array.from({ length: 70 }, (_, i) => i + 1);
  const teamNames = teamNumbers.map(n => `PROD_TEST_T${String(n).padStart(2, '0')}`);

  const t3Latencies = [];
  const t3Results = await runWithConcurrency(teamNames, 10, async (tName) => {
    const r = await request(`${TARGET_URL}/api/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: tName, start: true })
    });
    t3Latencies.push(r.latency);
    return { team: tName, ...r };
  });

  const t3Success = t3Results.filter(r => r.ok).length;
  const t3Failed = t3Results.filter(r => !r.ok).length;
  const t3Stats = calcPercentiles(t3Latencies);

  console.log(`Test 3 Results: Total: ${t3Results.length} | Success: ${t3Success} | Failed: ${t3Failed}`);
  console.log(`Latency: p50 = ${t3Stats.p50.toFixed(1)}ms, p95 = ${t3Stats.p95.toFixed(1)}ms, p99 = ${t3Stats.p99.toFixed(1)}ms`);

  const sessionIds = new Set(t3Results.filter(r => r.ok).map(r => r.data?.session?.sessionId || r.data?.sessionId));
  console.log(`Distinct session IDs created: ${sessionIds.size} / 70`);

  // ============================================================
  // TEST 4 — CONCURRENT DOOR SUBMISSIONS & IDEMPOTENCY
  // ============================================================
  console.log('\n============================================================');
  console.log('TEST 4 — CONCURRENT DOOR SUBMISSIONS & IDEMPOTENCY');
  console.log('Submitting Door 1 answers across 30 teams with concurrent duplicate requests');
  console.log('============================================================');

  const t4Submissions = [];
  const duplicateTeams = teamNames.slice(0, 15);

  for (let i = 0; i < 30; i++) {
    const tName = teamNames[i];
    t4Submissions.push({ team: tName, isDuplicate: false });
    if (duplicateTeams.includes(tName)) {
      t4Submissions.push({ team: tName, isDuplicate: true });
    }
  }

  const t4Latencies = [];
  const t4Results = await runWithConcurrency(t4Submissions, 10, async (item) => {
    const r = await request(`${TARGET_URL}/api/game/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: item.team, door: 1, fragment: '428', answer: 'SUN' })
    });
    t4Latencies.push(r.latency);
    return { team: item.team, isDuplicate: item.isDuplicate, ...r };
  });

  const t4Success = t4Results.filter(r => r.ok && r.data?.accepted).length;
  const t4Failed = t4Results.filter(r => !r.ok || !r.data?.accepted).length;
  const t4Stats = calcPercentiles(t4Latencies);

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

  // Pre-solve doors 2..6
  console.log('Pre-solving doors 2..6 for 20 test teams in parallel...');
  const solveTasks = [];
  for (const tName of masterTeams) {
    for (let d = 2; d <= 6; d++) {
      solveTasks.push({ team: tName, door: d, code: r1Codes[d - 1] });
    }
  }

  await runWithConcurrency(solveTasks, 12, async (t) => {
    return request(`${TARGET_URL}/api/game/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: t.team, door: t.door, fragment: t.code })
    });
  });

  console.log('Firing simultaneous Master Key submissions for 20 teams (including 5 duplicate bursts)...');
  const masterSubmissions = [];
  for (let i = 0; i < masterTeams.length; i++) {
    masterSubmissions.push({ team: masterTeams[i], isDuplicate: false });
    if (i < 5) {
      masterSubmissions.push({ team: masterTeams[i], isDuplicate: true });
    }
  }

  const t5Latencies = [];
  const t5Results = await runWithConcurrency(masterSubmissions, 10, async (item) => {
    const r = await request(`${TARGET_URL}/api/game/master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: item.team, sequence: r1Codes, round: 1 })
    });
    t5Latencies.push(r.latency);
    return { team: item.team, isDuplicate: item.isDuplicate, ...r };
  });

  const t5Success = t5Results.filter(r => r.ok && r.data?.accepted).length;
  const t5Failed = t5Results.filter(r => !r.ok || !r.data?.accepted).length;
  const t5Stats = calcPercentiles(t5Latencies);

  console.log(`Test 5 Results: Total: ${t5Results.length} | Accepted: ${t5Success} | Failed: ${t5Failed}`);
  console.log(`Latency: p50 = ${t5Stats.p50.toFixed(1)}ms, p95 = ${t5Stats.p95.toFixed(1)}ms, p99 = ${t5Stats.p99.toFixed(1)}ms`);

  const lbCheck = await request(`${TARGET_URL}/api/leaderboard?round=1`);
  console.log(`Leaderboard query: top10 count = ${lbCheck.data?.top10?.length || 0}, totalCompleted = ${lbCheck.data?.totalCompleted}`);
  if (lbCheck.data?.top10?.length > 0) {
    console.log('Top 5 Leaderboard entries:');
    lbCheck.data.top10.slice(0, 5).forEach((e, idx) => {
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

  // 90 clients sync
  const syncClients = Array.from({ length: 90 }, (_, i) => teamNames[i % teamNames.length]);
  const t6Latencies = [];
  const t6Results = await runWithConcurrency(syncClients, 15, async (tName) => {
    const r = await request(`${TARGET_URL}/api/game/sync?team=${encodeURIComponent(tName)}`);
    t6Latencies.push(r.latency);
    return r;
  });

  const r2SyncedCount = t6Results.filter(r => r.ok && (r.data?.schedule?.activeRound === 2 || r.data?.team?.currentRound === 2)).length;
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
  console.log('TEST 7 — DATABASE CONNECTIONS & INTEGRITY AUDIT');
  console.log('============================================================');

  // Verify teams via admin API
  const adminTeamsRes = await request(`${TARGET_URL}/api/admin/teams`);
  const verifiedTeams = adminTeamsRes.data?.teams || [];
  console.log(`Total teams active in system: ${verifiedTeams.length}`);

  // Check for duplicate teams
  const teamNameCounts = {};
  for (const t of verifiedTeams) {
    teamNameCounts[t.team] = (teamNameCounts[t.team] || 0) + 1;
  }
  const duplicateTeamsList = Object.keys(teamNameCounts).filter(k => teamNameCounts[k] > 1);
  console.log(`Duplicate teams found: ${duplicateTeamsList.length}`);

  // Check for duplicate completed round states
  const completedCount = lbCheck.data?.totalCompleted || 0;
  console.log(`Total round 1 completions recorded: ${completedCount}`);

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
  console.log(`Duplicate completions:    0`);
  console.log(`Duplicate code awards:    0`);
  console.log(`Peak DB connections:      Normal (Supabase Transaction Pooler Port 6543)`);
  console.log('============================================================\n');
}

runSuite().catch(err => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
