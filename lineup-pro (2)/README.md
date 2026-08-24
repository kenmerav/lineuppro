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

## Supabase Persistence

Accounts and team data are persistent across deploys only when Supabase is configured.

1. Create a Supabase project.
2. In Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Set these environment variables in Cloudflare Workers (or local `.env` for the legacy dev server):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
4. Run the password-function section at the bottom of [`supabase/schema.sql`](./supabase/schema.sql). It keeps bcrypt password checks inside Supabase so Cloudflare's free Worker can serve existing accounts efficiently.

## Cloudflare Workers Deployment

Cloudflare Workers serves the React app and API without Render's free-instance wake delay. The Worker reads the existing Supabase database; no roster or saved game migration is needed.

1. In this folder, run `npm run build` and `npx wrangler deploy`.
2. In the Cloudflare Worker settings, add the `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` secrets from the current Render service.
3. In Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql) to add the password helper functions.
4. Confirm login works on the Worker URL before disabling the Render service.

The Worker has two free scheduled reads each day to keep a low-activity Supabase Free project from being paused. Supabase can still change its free-plan policies, so this improves reliability but is not an availability guarantee.

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are not set, the app falls back to local file storage (`data/store.json`), which is not reliable for production persistence.
