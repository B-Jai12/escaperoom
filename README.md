<div align="center">



<br/>

[[Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[[React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[[Three.js](https://img.shields.io/badge/Three.js-R3F-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org)
[[TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[[PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com)
[[Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

<br/>

> **A synchronized, multi-team digital escape room tournament platform.**  
> Competing squads navigate through an interactive 3D cyberpunk corridor powered by Three.js, solving 18 cryptography, networking, and exploit-themed puzzles across 3 progressive difficulty rounds while competing on a live synchronized leaderboard.

<br/>

**[Game Mechanics](#-gameplay--mechanics) &nbsp;•&nbsp; [3D Spatial Engine](#-%EF%B8%8F-3d-spatial-engine) &nbsp;•&nbsp; [Tech Stack](#-technology-stack) &nbsp;•&nbsp; [Local Development](#-getting-started) &nbsp;•&nbsp; [Admin Portal](#%EF%B8%8F-tournament-operations--admin)**

<br/>

</div>

---

##  What is The Codebreaker's Gauntlet?

Built specifically for high-intensity hackathons, cybersecurity clubs, and competitive technical events, **The Codebreaker's Gauntlet** is a full-featured competition platform that merges spatial 3D navigation with technical puzzle solving.

Teams register simultaneously, race through a timed sequence of cyber vaults, and attempt to crack complex cryptographic ciphers, binary payloads, and terminal mini-games before the central countdown expires.

---

##  Gameplay & Mechanics

### 1. Progressive Three-Tier Rounds
- **Round 1 — Infiltration (Easy):** Pattern recognition, substitution ciphers, and security fundamentals.
- **Round 2 — Breach (Medium):** Hash reversing, network packet decoding, and payload analysis.
- **Round 3 — Core Override (Hard):** Multi-step cryptographic sequences, memory forensics, and terminal puzzles.

### 2. Live Competitive Leaderboard
- Real-time score aggregation backed by Supabase PostgreSQL.
- Points awarded based on solve speed, attempt accuracy, and difficulty tier.
- Penalty calculations for incorrect brute-force submissions.

### 3. Synchronized Tournament Clock
- Server-authoritative event clock with automatic phase progression (`eventClock.ts`).
- Instant state broadcast when rounds lock or conclude.

---

##  3D Spatial Engine

Rather than static web forms, players explore a first-person 3D cyber corridor built with **Three.js** and **React Three Fiber (`@react-three/fiber`, `@react-three/drei`)**:
- Interactive terminal nodes that open modal puzzle viewports upon proximity.
- Dynamic point lighting and glowing neon materials rendered in real-time WebGL.
- Seamless camera transitions between exploration mode and puzzle terminals.

---

##  Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend Framework** | Next.js 16 (App Router) | Server and client component rendering |
| **UI Library** | React 19 | Cutting-edge concurrent rendering |
| **3D Graphics** | Three.js + React Three Fiber | WebGL 3D corridor and terminal interaction |
| **Language** | TypeScript | Strict end-to-end type safety |
| **Database** | PostgreSQL via Supabase | High-concurrency score persistence |
| **DB Client** | `postgres.js` | Ultra-fast native SQL driver |
| **Styling** | Tailwind CSS v4 + Framer Motion | Cyberpunk glassmorphic HUD & micro-animations |

---

##  Repository Structure

```
escaperoom/
├── app/
│   ├── page.tsx             # Player landing, team entry, and lobby
│   ├── puzzleData.ts        # 18 cybersecurity challenge definitions
│   ├── admin/               # Organizer dashboard (clock, reset, leaderboard)
│   ├── cinematic/           # Animated opening sequence
│   └── api/                 # REST endpoints (game attempts, solves, sync)
├── lib/
│   ├── db.ts                # PostgreSQL connection pooling (postgres.js)
│   ├── eventClock.ts        # Tournament clock and phase supervisor
│   ├── schema.ts            # Data models and validation
│   └── store.ts             # Client-side state orchestration
├── scripts/                 # Reliability and load-testing testbed
│   ├── load-test.mjs        # Concurrent team submission simulation
│   └── migrate.mjs          # Database table initialization
├── styles/                  # Cyber aesthetic stylesheets
└── schema.sql               # PostgreSQL schema definition
```

---

##  Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (local or Supabase)

### 1. Installation

```bash
git clone https://github.com/B-Jai12/escaperoom.git
cd escaperoom
npm install
```

### 2. Environment Setup

Create a `.env.local` file:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/escaperoom
ADMIN_SECRET=your_admin_secret_key
NEXT_PUBLIC_GAME_TITLE="The Codebreaker's Gauntlet"
```

### 3. Database Migration

Initialize the tournament tables:
```bash
# Apply schema
node scripts/migrate.mjs
```

### 4. Run Development Server

```bash
npm run dev
```
Open `http://localhost:3001` in your browser.

---

##  Tournament Operations & Admin

Organizers have access to a dedicated `/admin` control center:
- **Global Timer Controls:** Start, pause, or fast-forward competition rounds.
- **Live Team Monitor:** Track connected teams, active puzzle attempts, and solve timestamps.
- **Event Reset:** Purge test submissions and reset tables cleanly for tournament day.

---

##  Author

**Jaideep Botla** ([B-Jai12](https://github.com/B-Jai12))  
B.Tech AIML Student & Builder • Crafting interactive 3D web experiences, competitive games, and distributed applications.
