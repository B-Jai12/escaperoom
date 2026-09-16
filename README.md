# The Codebreaker's Gauntlet — Escape Room

> A real-time, multi-team, 3-round escape room game with 18 cyber-themed puzzles, 3D corridor navigation, and a live leaderboard.

---

## What It Is

A digital escape room event platform where competing teams race through 3 rounds of cybersecurity-themed puzzles. Built for live event hosting with real-time leaderboards and team synchronization.

---

## Features

- **18 puzzles across 3 rounds** — EASY, MEDIUM, HARD difficulties
- **3D corridor navigation** — Three.js powered first-person-style corridor
- **Real-time leaderboard** — Supabase PostgreSQL tracks all team scores live
- **Mini-games** — Cipher cracker, pattern recognition, code terminal puzzles
- **Timer system** — Per-round countdown with automatic progression
- **Admin panel** — Event control: start/stop/reset from admin UI
- **Team registration** — Teams register on entry, state persisted to DB
- **Cinematic opening** — Animated intro sequence

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| 3D Engine | Three.js (@react-three/fiber, @react-three/drei) |
| Animations | Framer Motion |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (Supabase) via postgres.js |
| Deployment | Vercel |

---

## Architecture

`
Client (Browser)
  ↓ REST API calls
Next.js API Routes (/api/*)
  ↓ postgres.js queries
Supabase PostgreSQL
  → Teams, scores, progress, event state
`

---

## Local Setup

`ash
git clone https://github.com/B-Jai12/escaperoom.git
cd escaperoom
npm install
cp .env.example .env.local
# Set DATABASE_URL in .env.local to your Supabase connection string
npm run dev
`

**Then apply the schema:**

`ash
# Run schema.sql against your Supabase database
# via Supabase Dashboard SQL Editor or psql
`

---

## Environment Variables

| Variable | Description |
|----------|------------|
| DATABASE_URL | Supabase PostgreSQL connection string (Transaction Pooler port 6543) |
| ADMIN_SECRET | Optional admin panel secret (defaults to GAUNTLET_ADMIN_2026 if not set) |

---

## Deployment (Vercel)

1. Push to GitHub
2. Import into Vercel
3. Set DATABASE_URL environment variable to your Supabase connection string
4. Deploy

---

## Future Improvements

- Persistent team sessions (reconnect support)
- Sound effects and music
- Custom puzzle editor
- Multiple concurrent events

---

## Author

Built by [B-Jai12](https://github.com/B-Jai12)