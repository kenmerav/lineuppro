# Lineup Pro

Lineup Pro is a softball lineup manager with roster tools, defensive rotation planning, and game tracking.

## Quick start

1. Install dependencies:
   `npm install`
2. Start dev server:
   `npm run dev`
3. Open:
   `http://localhost:5173`

## Environment

Copy `.env.example` to `.env` if you want to override defaults.

## Supabase Persistence (Recommended for Render)

Accounts and team data are persistent across deploys only when Supabase is configured.

1. Create a Supabase project.
2. In Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Set these environment variables in Render and local `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
4. Redeploy.

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are not set, the app falls back to local file storage (`data/store.json`), which is not reliable for production persistence.
