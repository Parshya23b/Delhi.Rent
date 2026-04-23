# delhi.rent

Anonymous rent pins for Delhi NCR (Next.js App Router, Mapbox, Supabase).

## Local development

```bash
npm install
cp .env.example .env.local
# Add NEXT_PUBLIC_MAPBOX_TOKEN (required for the map) and Supabase keys (see below).
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The map is at [/map](http://localhost:3000/map).

## Environment variables

Use the **same variable names** everywhere: local files (`.env.local` or `.env`) and **Vercel → Project → Settings → Environment Variables** (Production + Preview).

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes (for map) | Mapbox GL public token (`pk.`). |
| `MAPBOX_SECRET_TOKEN` | No | Server-side geocoding (`sk.`). |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL; omit to run fully offline/local submissions. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | **Public** anon key from Supabase → Settings → API. With URL, the server loads **map + leaderboard** reads without the service role. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-only **service_role** secret; **never** expose as `NEXT_PUBLIC_`. Needed for saving pins, confirms, reports, and moderation queries. |

Copy the values from your local `.env.local` into Vercel when deploying (do not commit real keys to git). The committed `.env.example` lists names only.

Apply SQL migrations under `supabase/migrations/` (or paste `supabase/migrations/_apply_all.sql` in the Supabase SQL editor for a fresh project). After migrations, you can run `supabase/seed.sql` once to insert a few Delhi NCR starter pins so the map is not empty while you wait for real submissions.

### Saves fail or “saved on this device only”

1. **Use the service role key on the server** — In Vercel (or `.env.local`), `SUPABASE_SERVICE_ROLE_KEY` must be the **service_role** secret from Supabase → **Project Settings → API**, not the `anon` / public key. The anon key cannot insert rows under RLS.
2. **Run migrations** — If optional columns (`women_only`, `maintenance_inr`, etc.) are missing, the API retries with fewer columns; if the database still rejects the row, the app falls back to **local-only** storage so the user still sees their pin, but it will not sync to Supabase until the DB is fixed.

## Deploy to Vercel

**Production URL (when deployed):** `https://delhi-rent.vercel.app` — map: `https://delhi-rent.vercel.app/map`

1. In **Vercel → your project → Settings → Environment Variables**, add all variables from the table above for **Production** (and **Preview** if needed). Redeploy after changing env.
2. Prefer **Git** import for ongoing deploys: push this repo to GitHub/GitLab and connect it in Vercel so every push deploys automatically.

CLI (logged in with `vercel login`):

```bash
npx vercel --prod
```

The repo includes `.vercelignore` so local `.env` / `.env.local` are **not** uploaded by the CLI; rely on the dashboard for production secrets.

The included `vercel.json` marks the project as Next.js. You can set a preferred deployment **region** under Project Settings if your plan supports it.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
