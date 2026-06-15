# BroadcastPilot

BroadcastPilot is a MetaBull hub sub-app. Authentication is hub-first: users log in on the main hub, then the hub opens BroadcastPilot with a valid Supabase session handoff.

## Authentication Flow

Use the same Supabase project for the hub and BroadcastPilot.

1. User logs in on the hub.
2. Hub obtains the current Supabase session.
3. Hub redirects to BroadcastPilot with:

```text
https://broadcastpilot.example.com/?access_token=<supabase_access_token>&refresh_token=<supabase_refresh_token>
```

BroadcastPilot calls `supabase.auth.setSession()`, stores the session locally for this app, removes tokens from the URL, and sends the access token to the backend as:

```text
Authorization: Bearer <supabase_access_token>
```

The backend validates every protected request with `supabase.auth.getUser(token)` and loads the user's organization/role from `b_organization_members`.

## Hub Requirements

- Hub and BroadcastPilot must use the same `SUPABASE_URL`.
- BroadcastPilot frontend must use the same Supabase anon key as the hub.
- BroadcastPilot backend must use the service role key for secure server-side profile and organization lookup.
- Configure the deployed BroadcastPilot URL in Supabase Auth redirect URLs if the hub uses Supabase OAuth redirects.
- Do not rely on browser localStorage sharing between hub and sub-app domains. Different origins cannot read each other's Supabase local session.

## Environment Setup

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Redis for background jobs:

```bash
docker compose up -d redis redis-insight
```

- Redis: `redis://127.0.0.1:6380`
- Redis Insight: `http://localhost:5540`
- In Redis Insight, add a database with host `redis` and port `6379`.

Important variables:

- `VITE_HUB_LOGIN_URL`: where unauthenticated users are sent.
- `VITE_HUB_LOGOUT_URL`: where users go after BroadcastPilot sign-out.
- `VITE_ENABLE_LOCAL_AUTH`: set `true` only for local standalone testing.
- `CORS_ORIGINS`: comma-separated allowed browser origins for the API.
- `REDIS_URL`: Redis connection string used by BullMQ workers.

## Security Notes

- Tokens are stripped from the URL immediately after the session is accepted.
- API requests require `Authorization: Bearer ...`.
- Backend CORS is allow-list based via `CORS_ORIGINS`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
