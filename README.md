# Onyx Paper Trade

A paper-trading web app for the Onyx Predictions API. Users sign up, browse live prediction markets, and place simulated buy-YES / buy-NO orders that fill instantly at the current upstream price. Nothing actually executes against Onyx — all orders, positions, and balances are stored in our own database.

- **Live URL:** _add after deploy_
- **Repo:** _add after push_

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Auth + DB | Supabase (managed Postgres + auth) |
| UI | Tailwind v4 |
| Data fetching | SWR with 3–5s polling |
| Deploy | Vercel (recommended) |

## Run locally

```bash
# 1. Install deps (Node 18+ required for Next 16)
npm install

# 2. Create a Supabase project at https://supabase.com
#    (free tier is fine; takes ~1 min to provision)

# 3. In the Supabase SQL editor, paste and run db/schema.sql

# 4. Copy your project URL + anon key from Supabase → Settings → API
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 5. Start the dev server
npm run dev
# → http://localhost:3000
```

Sign up, get $1,000 in paper balance, and start trading.

## How it works

### Data flow
- `app/api/markets/*` proxies the Onyx API server-side. Browser never sees Onyx directly. The Onyx market data endpoints are publicly accessible — no API key needed in this environment. If your environment requires one, set `ONYX_JWT` in `.env.local`.
- The markets page polls `/api/markets` every 5s via SWR. The market detail page polls the single-market and price endpoints every 3s.
- The portfolio page batch-fetches prices for every held symbol every 5s and recalculates mark-to-market P&L on the client.

### Order placement
`POST /api/orders` is the only mutation endpoint. The flow:
1. Verify the Supabase session (reject if anonymous).
2. Fetch the current market + price from Onyx server-side (defeats client tampering).
3. Resolve a fill price (`(bid+ask)/2` → `last_price` → `yes_price`), then take YES or `1 − YES` for NO.
4. Call the `place_paper_order` Postgres function, which **atomically**:
   - locks the user's profile row,
   - checks balance ≥ cost,
   - debits the balance,
   - inserts the order,
   - upserts the position (weighted-average cost basis).

Doing this as a single DB function avoids partial-state races and means RLS still owns authorization.

### P&L
For each open position:
- `mark = bid/ask mid` (YES side) or `1 − that` (NO side).
- `unrealized = (mark − avg_price) × quantity`.

This is mark-to-market against the same mid we'd fill at. A real exchange would mark to bid for longs.

## Major design decisions & trade-offs

- **Supabase over rolling our own auth.** Email/password + cookie sessions + JWT verification in middleware would have eaten an evening. Supabase RLS also means the API surface is genuinely safe even if the route handlers had bugs.
- **Polling, not WebSockets/SSE.** Onyx doesn't expose a streaming endpoint (the docs show REST only), and SSE through Vercel's serverless layer has gotchas around timeouts. 3s polling is honest about what the upstream supports and is trivial to reason about.
- **`place_paper_order` as a Postgres function.** Tempting to do balance check → debit → insert from the route handler, but that's three round-trips with race conditions. The DB function fits in 30 lines and makes the operation atomic.
- **YES/NO from a single price.** The Onyx schema returns one bid/ask pair per market; NO is treated as the algebraic complement (`1 − YES`). That's how Kalshi / Polymarket model it too.
- **NO real order book.** Fills are instant at the upstream mid. No slippage model, no partial fills, no limit orders. The brief said "fill instantly at the current upstream price" and I took it literally.
- **No market resolution / settlement.** Orders are recorded but the app never says "you won, paying out $1/share." That would need a worker watching `status` transitions on each held market.

## What I'd do next given more time

1. **Settlement.** Cron job (or Supabase Edge Function) that watches `expiry_date` + `status`, and when a market resolves credits `qty × $1` for winning side and zero for losing side. Realized P&L table.
2. **WebSocket prices** if Onyx adds them — or proxy FIX through a small Node worker that broadcasts SSE to clients.
3. **Limit orders + sell-to-close.** Right now you can only buy YES or NO. A position can be reduced by buying the opposite side (synthetic close), but a real "sell" with a limit price is the obvious next step.
4. **Charts.** Even just a 24h price spark line per market would massively improve the browse experience.
5. **Better filtering.** The dev API returns `sport: "OTHER"` for almost everything, so the sport filter is currently a no-op. Pull richer category data from `/events` and `/games/{sport}` and join.
6. **Tests.** Jest unit tests for `resolveFillPrice` and the position math; one Playwright test that signs up, places an order, and verifies portfolio.

## File map

```
app/
  (auth)/login,signup,logout      auth pages + actions
  api/markets/*                    Onyx proxy (GET)
  api/orders                       POST → place_paper_order
  api/prices                       batch price fan-out
  markets/                         list + detail
  portfolio/                       positions + P&L + history
components/
  nav.tsx                          balance + sign-out
  markets-browser.tsx              live market table
  order-panel.tsx                  YES/NO order ticket
  portfolio-view.tsx               mark-to-market dashboard
lib/
  onyx.ts                          fetch wrapper + resolveFillPrice
  supabase/client.ts,server.ts     SSR-aware Supabase clients
db/
  schema.sql                       run once in Supabase SQL editor
proxy.ts                           auth-aware route protection
```

## Deploy

1. Push to GitHub.
2. Import into Vercel; set the two `NEXT_PUBLIC_SUPABASE_*` env vars (and `ONYX_JWT` if needed).
3. Add the deployed origin to Supabase → Authentication → URL Configuration so email confirmation links resolve correctly. (For demo, you can also disable email confirmation in Supabase → Authentication → Providers → Email.)
