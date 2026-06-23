# Super Sefty Admin

Next.js App Router admin dashboard and backend API for a parental-control system.

## Stack

- Next.js App Router, TypeScript, `src` directory
- Tailwind CSS and shadcn/ui-style components
- Drizzle ORM with Supabase Postgres through `DATABASE_URL`
- Zod request validation
- HTTP-only JWT admin session cookie
- Custom Node server in `server.ts` for the app routes and WebSocket signaling endpoint

## Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres?sslmode=require"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
JWT_SECRET="replace-with-at-least-32-random-bytes"
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are reserved for later Supabase client usage. Drizzle uses `DATABASE_URL`.

## Setup

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

`pnpm dev` starts the custom server in watch mode, so the WebSocket signaling path stays available during local development.

Open `http://localhost:3000/register` to create the first admin.

## VPS Deployment

This app is meant to run as a single Node process behind Nginx, Caddy, or another reverse proxy.

1. Install Node.js 20+ and `pnpm` on the VPS.
1. Clone the repository and copy the production environment values into `.env.production` or `.env.local`.
1. Run `pnpm install --frozen-lockfile`.
1. Run `pnpm db:migrate` against the production database.
1. Run `pnpm build`.
1. Start the service with `pnpm start`.
1. Expose the app through a reverse proxy and forward WebSocket upgrades to the same port.

The production command uses `server.ts`, so both the HTTP routes and the `/ws` signaling endpoint come up together.

## Keeping It Up To Date

When you deploy a new version to the VPS, use the same sequence every time:

```bash
git pull
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
sudo systemctl restart super-sefty
```

Use `pnpm db:migrate` for production database changes. Keep `pnpm db:generate` for local schema work when the Drizzle schema changes in the repo.

For dependency maintenance, check `pnpm outdated` periodically and update packages in a separate branch before shipping them to the VPS.

## Main Files

- `src/db/schema.ts` - Drizzle tables and enums.
- `src/db/index.ts` - Supabase Postgres Drizzle client.
- `src/lib/auth.ts` - password hashing, JWT sessions, API/page auth helpers.
- `middleware.ts` - protects `/dashboard` and `/children`.
- `src/app/api/**/route.ts` - route-handler backend API.
- `src/app/(admin)/**` - protected admin pages.
- `src/components/child-detail.tsx` - child overview, app rules, web rules, live screen tab.

## API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/children`
- `POST /api/children`
- `GET /api/children/:id`
- `PATCH /api/children/:id`
- `DELETE /api/children/:id`
- `GET /api/children/:id/app-rules`
- `POST /api/children/:id/app-rules`
- `PATCH /api/app-rules/:ruleId`
- `DELETE /api/app-rules/:ruleId`
- `GET /api/children/:id/web-rules`
- `POST /api/children/:id/web-rules`
- `PATCH /api/web-rules/:ruleId`
- `DELETE /api/web-rules/:ruleId`
- `GET /api/children/:id/live-screen`
- `POST /api/children/:id/live-screen/request`
- `PATCH /api/live-screen/:sessionId/start`
- `PATCH /api/live-screen/:sessionId/end`
- `PATCH /api/live-screen/:sessionId/fail`

The live screen feature includes WebSocket signaling and WebRTC message relaying. It still does not include a media relay or video streaming server.
