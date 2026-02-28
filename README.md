# Portify

**From Commits to Career.** AI-powered developer portfolio infrastructure that turns GitHub repositories into a live, hosted portfolio.

## Features

- **GitHub OAuth** — Sign in and select repos
- **AI summaries** — OpenAI-generated project summaries and tech stack
- **Screenshots & diagrams** — Placeholder pipeline (Playwright + Mermaid in production)
- **Evolution graph** — Commits over time and language distribution (Recharts)
- **Public URL** — `portify.dev/u/{username}` (or your host)

## Tech stack

- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn-style components, Recharts, Mermaid
- **Backend:** Next.js API routes, Prisma, PostgreSQL, Redis, BullMQ
- **Worker:** Node.js worker (tsx), clone → analyze → summary → build → screenshot → diagram
- **Storage:** S3-compatible (AWS S3 / R2 / MinIO)
- **AI:** OpenAI API (summaries)

## Setup

1. **Clone and install**

   ```bash
   cd portify
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` — PostgreSQL connection string
   - `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — NextAuth (use `openssl rand -base64 32` for secret)
   - `GITHUB_ID`, `GITHUB_SECRET` — [GitHub OAuth App](https://github.com/settings/developers) (callback: `{NEXTAUTH_URL}/api/auth/callback/github`)
   - `REDIS_URL` — Redis for BullMQ (e.g. `redis://localhost:6379`)
   - `OPENAI_API_KEY` — For AI summaries
   - Optional: `S3_*` for artifact storage (screenshots, diagrams)

3. **Database**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run**

   - App: `npm run dev`
   - Worker (separate terminal): `npm run worker` (requires Redis)

5. **Demo**

   - Home: Sign in with GitHub, add repos, click Regenerate.
   - Public portfolio: `/u/demo` (static demo) or `/u/{your-username}` after publishing.

## Project structure

```
app/
  (app)/dashboard/     # Repo list, add, generate
  (app)/editor/       # Bio, socials, publish toggle
  u/[username]/       # Public portfolio
api/
  auth/               # NextAuth
  repos/               # GET user repos
  portfolio/           # GET/PATCH portfolio, POST/DELETE repos
  generate/            # POST enqueue generate
  job-status/          # GET status by portfolioRepoId
lib/
  auth.ts, db.ts, github.ts, jobQueue.ts, openai.ts, s3.ts, stackDetector.ts
worker/
  index.ts             # BullMQ worker
  jobs/                # analyze, summary, build, screenshot, diagram
```

## Security (MVP)

- Builds run in the worker process (no Docker sandbox in MVP).
- No production secrets in job payloads; worker uses env only.
- Rate limiting and full sandboxing (e.g. Docker/gVisor) are recommended for production.

## License

MIT
