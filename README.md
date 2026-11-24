# KillSoc — AI-Powered Open-Source Contribution Intelligence Platform

> *"Find. Analyze. Contribute. Conquer."*

KillSoc is a production-grade developer platform designed to help engineers discover Google Summer of Code (GSoC) organizations, evaluate open-source repository health through transparent explainability heuristics, manage technical skill profiles, match with suitable codebases, and receive grounded AI-powered contribution recommendations.

---

## Architecture Overview

```
KillSoc Platform
├── client/                      # Next.js 16 (App Router) + TypeScript + Tailwind CSS
│   ├── src/app/                 # 13 Application Routes & Layouts
│   ├── src/components/ui/       # Design System (Linear/Vercel inspired dark theme)
│   ├── src/contexts/            # AuthContext (session) & ToastContext (notifications)
│   └── src/lib/                 # Typed API client, TypeScript contracts, utilities
│
└── server/                      # Node.js + Express.js + TypeScript
    ├── prisma/                  # PostgreSQL Schema & 6 Migrations
    ├── src/config/              # Prisma, Redis, Environment variables
    ├── src/controllers/         # REST Controllers with centralized error handling
    ├── src/jobs/                # BullMQ + Redis background workers (org-sync, repo-analysis, AI)
    ├── src/middleware/          # JWT auth (requireAuth, optionalAuth, requireAdmin), Helmet, CORS
    ├── src/routes/              # Centralized route mounting
    ├── src/services/            # Intelligence, Matching, Discovery, AI, GitHub REST client
    └── src/utils/               # AES-256-GCM crypto, JWT signing, rate limiting
```

---

## Prerequisites

- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v15+` (local or managed instance)
- **Redis**: `v7+` (for BullMQ background job processing)
- **GitHub OAuth App**: Client ID & Client Secret from [GitHub Developer Settings](https://github.com/settings/developers)

---

## Getting Started

### 1. Clone & Setup Environment

```bash
git clone https://github.com/sourodeepsaha2/KillSoc.git
cd KillSoc
```

#### Backend Environment Setup
Create `server/.env` based on `server/.env.example`:

```bash
cp server/.env.example server/.env
```

Configure your secrets in `server/.env`:
```env
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/killsoc?schema=public

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5001/api/auth/github/callback

JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
TOKEN_ENCRYPTION_KEY=super_secret_aes256_key_at_least_32_characters_long

REDIS_URL=redis://localhost:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

AI_PROVIDER=gemini # 'gemini' | 'openai' | 'mock'
AI_MODEL=gemini-1.5-flash
AI_API_KEY=your_gemini_api_key
```

#### Frontend Environment Setup
Create `client/.env.local`:

```bash
cp client/.env.example client/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
```

---

### 2. Database Migrations

Install dependencies and run Prisma migrations:

```bash
cd server
npm install
npx prisma migrate dev
```

---

### 3. Running the Application

Open 3 terminal sessions:

#### Terminal 1: Backend API Server
```bash
cd server
npm run dev
# Server running at http://localhost:5001
```

#### Terminal 2: BullMQ Background Worker
```bash
cd server
npm run worker
# Worker listening on org-sync, repo-analysis, skill-extraction, ai-recommendations
```

#### Terminal 3: Next.js Frontend
```bash
cd client
npm install
npm run dev
# Frontend running at http://localhost:3000
```

---

## Testing & Quality Assurance

### Run Server Automated Test Suites
Runs all 8 verification suites covering crypto, GitHub integration, intelligence heuristics, deterministic matching, GSoC discovery, AI recommendations, Redis/BullMQ background jobs, and full-stack end-to-end user journeys:

```bash
cd server
npm test
```

Individual test suites:
```bash
npm run test:auth          # Task 03: Crypto, AES-256-GCM, OAuth state & JWT
npm run test:github        # Task 04: GitHub REST API client & Rate Limiting
npm run test:intelligence  # Task 05: 5-Dimension Intelligence heuristics
npm run test:matching      # Task 06: Developer skill profile & matching engine
npm run test:discovery     # Task 07: GSoC organizations & good-first-issues
npm run test:ai            # Task 08: AI-powered recommendations & citations
npm run test:jobs          # Task 09: Redis + BullMQ background worker queues
npm run test:e2e           # Task 11: End-to-end user journeys & security audit
```

### Run Frontend Verification
```bash
cd client
npx tsc --noEmit           # TypeScript compile check (0 errors)
npm run lint               # Next.js ESLint verification
npm run build              # Next.js optimized production build
```

---

## Security Safeguards

- **AES-256-GCM Token Encryption**: User access tokens are encrypted with an authenticated 96-bit IV and 128-bit authentication tag before database insertion. Plaintext tokens are never stored, logged, or exposed in API responses.
- **CSRF & OAuth State Protection**: Cryptographic 32-byte OAuth state verified with constant-time equality checks against HttpOnly cookies.
- **Strict User Isolation**: All skill records, matching recommendations, AI guidance, and background jobs verify ownership by authenticated `userId`. User B cannot read or tamper with User A resources.
- **Role-Based Access Control**: Administrative tasks such as batch GSoC organization ingestion require `ADMIN` role authentication.
- **Error Sanitization**: Background worker logs and API error handlers sanitize failure reasons, replacing sensitive tokens and Bearer headers with `[REDACTED]`.
- **Zero-Hallucination Heuristics**: AI recommendation models are grounded in database telemetry; closed issues are excluded, and repositories/mentors are strictly validated against indexed GitHub data.

---

## Deployment Guide (Render & Vercel)

KillSoc is architected for seamless multi-cloud production deployment:
- **Frontend**: Next.js App Router deployed on [Vercel](https://vercel.com)
- **Backend & Worker**: Express.js API & BullMQ Background Worker deployed on [Render](https://render.com)
- **Database**: Managed PostgreSQL on Render (or Supabase / Neon)
- **Cache & Queues**: Managed Redis on Render (or Upstash Redis)

See the root `render.yaml` for 1-click Blueprint deployment. Detailed step-by-step setup guides, environment variables, CORS, and cross-site cookie settings are documented below.

