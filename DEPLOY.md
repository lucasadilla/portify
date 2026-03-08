# Publishing Portify

Checklist to deploy your site to production.

---

## 1. Production URL

Decide your live URL, e.g. `https://portify.example.com` or `https://your-app.vercel.app`.

---

## 2. Database (PostgreSQL)

You need a Postgres database. Options:

- **[Vercel Postgres](https://vercel.com/storage/postgres)** (if you deploy on Vercel)
- **[Neon](https://neon.tech)** — serverless Postgres, free tier
- **[Supabase](https://supabase.com)** — Postgres + optional extras
- **[Railway](https://railway.app)** — Postgres add-on
- **[PlanetScale](https://planetscale.com)** — MySQL (would require Prisma adapter change; Postgres is simpler)

Set **`DATABASE_URL`** to your connection string, e.g.:

`postgresql://user:password@host:5432/dbname?sslmode=require`

After first deploy, run migrations from your machine (or a one-off job):

```bash
DATABASE_URL="your-production-url" npx prisma db push
```

---

## 3. GitHub OAuth App (production)

1. Go to [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers).
2. Create a new OAuth App (or edit the one you use for localhost).
3. **Homepage URL:** your production URL, e.g. `https://portify.example.com`
4. **Authorization callback URL:** `https://portify.example.com/api/auth/callback/github` (replace with your real URL).
5. Copy the **Client ID** and generate a **Client Secret**. Set in production env:
   - **`GITHUB_ID`** = Client ID  
   - **`GITHUB_SECRET`** = Client Secret  

Use **raw values** (no quotes) in your env.

---

## 4. NextAuth (production)

In your production environment set:

- **`NEXTAUTH_URL`** = your full site URL, e.g. `https://portify.example.com` (no trailing slash).
- **`NEXTAUTH_SECRET`** = a random secret. Generate with:  
  `openssl rand -base64 32`  
  Keep this secret and use the same value on every deploy.

---

## 5. Redis (for background jobs)

The generate pipeline (clone repo, AI summary, diagrams, etc.) runs via BullMQ and **requires Redis**.

Options:

- **[Upstash Redis](https://upstash.com)** — serverless Redis, free tier, works well with Vercel.
- **[Railway](https://railway.app)** — add Redis to your project.
- **[Render](https://render.com)** — Redis add-on.
- Any Redis host (e.g. Redis Cloud, self-hosted).

Set **`REDIS_URL`** in production, e.g.:

- `redis://default:password@host:6379`
- For TLS: `rediss://default:password@host:6379`

If you **don’t** set `REDIS_URL`, jobs will stay queued and “Generate” won’t run until a worker processes them.

---

## 6. Worker (separate process)

The app only starts the worker automatically in **development**. In **production** you must run the worker yourself so jobs are processed.

Options:

**A) Same host as the app (VPS, Railway, Render, Fly.io)**  
Run in a separate process or as a second “worker” service:

```bash
npm run worker
```

Ensure this process has:

- **`REDIS_URL`**
- **`DATABASE_URL`**
- **`OPENAI_API_KEY`**
- **`GITHUB_*`** not required for the worker; tokens are in the DB.
- Optional: **`WORKER_REPO_DIR`** (default: `.repos` under cwd). Must be writable for git clone.
- Optional: **`S3_*`** if you use S3 for artifacts.

**B) Vercel (app only)**  
Deploy the Next.js app to Vercel and run the worker elsewhere (e.g. a small Railway/Render/Fly.io app that only runs `npm run worker` and shares the same `REDIS_URL` and `DATABASE_URL`).

---

## 7. OpenAI (AI summaries)

Set **`OPENAI_API_KEY`** in the environment where the **worker** runs (and optionally in the app if you call OpenAI from API routes). Without it, summary generation will fail.

---

## 8. Optional: S3-compatible storage (screenshots/diagrams)

If you want uploaded/generated screenshots and diagrams stored in object storage instead of data URLs:

- **AWS S3**, or
- **Cloudflare R2**, or
- **MinIO** (self-hosted)

Set in production (and in the worker if it writes artifacts):

- **`S3_ENDPOINT`** (optional; for R2/MinIO)
- **`S3_REGION`** (e.g. `us-east-1`)
- **`S3_BUCKET`**
- **`S3_ACCESS_KEY_ID`**
- **`S3_SECRET_ACCESS_KEY`**
- **`S3_PUBLIC_URL`** (optional; public base URL for artifacts)

If these are not set, the app and worker can still run; artifact URLs may be data URLs or placeholders.

---

## 9. App URL (optional)

Set **`NEXT_PUBLIC_APP_URL`** to your production URL (e.g. `https://portify.example.com`) if any part of the app builds absolute links to the site.

---

## 10. Deploy the Next.js app

**Vercel (recommended for the app):**

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Add all env vars above (Database, NextAuth, GitHub, Redis, OpenAI, optional S3, `NEXT_PUBLIC_APP_URL`).
3. Deploy. Then run `prisma db push` (or migrations) with `DATABASE_URL` pointing at production.
4. Run the worker elsewhere (Railway, Render, etc.) with the same `DATABASE_URL` and `REDIS_URL`, plus `OPENAI_API_KEY` and optional S3.

**Railway / Render / Fly.io (app + worker on same provider):**

1. Create a Postgres (and optionally Redis) service.
2. Deploy the repo as a web service; set **Start Command** to `npm run start` (or `npx next start`).
3. Add a second process or service that runs `npm run worker` and give it the same env (no web port).
4. Set all env vars on both app and worker as needed.

---

## 11. After first deploy

1. Open your production URL and sign in with GitHub (you’ll be redirected to GitHub and back).
2. Add a repo and click **Generate**. If the worker is running and Redis/OpenAI are set, the job should complete.
3. In **Settings** (or editor), turn **Published** on so your portfolio is visible at `https://your-site.com/your-username`.

---

## Quick reference: required env for “full” production

| Variable            | Where        | Purpose                    |
|---------------------|-------------|----------------------------|
| `DATABASE_URL`      | App + Worker| PostgreSQL                 |
| `NEXTAUTH_URL`      | App         | NextAuth base URL          |
| `NEXTAUTH_SECRET`   | App         | NextAuth signing           |
| `GITHUB_ID`         | App         | GitHub OAuth                |
| `GITHUB_SECRET`     | App         | GitHub OAuth                |
| `REDIS_URL`         | App + Worker| BullMQ job queue            |
| `OPENAI_API_KEY`    | Worker      | AI summaries                |
| `S3_*` (optional)   | App + Worker| Screenshots/diagrams        |
| `NEXT_PUBLIC_APP_URL` (optional) | App | Public site URL       |

Worker must run as a separate process in production and have at least `DATABASE_URL`, `REDIS_URL`, and `OPENAI_API_KEY`.
