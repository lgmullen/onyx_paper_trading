# Onyx Paper Trade

A paper-trading web app for the Onyx Predictions API. Users sign up, browse live prediction markets, and place simulated buy-YES / buy-NO orders that fill instantly at the current upstream price. Nothing actually executes against Onyx — all orders, positions, and balances are stored in our own database.

- **Live URL:** https://onyx-paper-trade.vercel.app/
- **Repo:** https://github.com/lgmullen/onyx_paper_trading

## Stack

| Layer         | Choice                                         |
| ------------- | ---------------------------------------------- |
| Framework     | Next.js 16 (App Router, TypeScript, Turbopack) |
| Auth + DB     | Supabase (managed Postgres + auth)             |
| UI            | Tailwind v4                                    |
| Data fetching | SWR with 3–5s polling                          |
| Deploy        | Vercel (recommended)                           |



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

## What I'd do next given more time

1. **Settlement.** A price-update webhook would be beneficial to polling that we are currently using. Onyx pushing the changes would be more efficient at scale and could trigger settlement automatically without having to watch the `expiry_date` resolving.

2. **Charts.** From a UX perspective, a 24h price spark line per market would certainly make things a lot more interesting and provide tangible information on how things are resolving.

3. **Better filtering.** The dev API returns `sport: "OTHER"` for almost everything, so the sport filter is currently a no-op. Pull richer category data from `/events` and `/games/{sport}` and join.

4. **Tests.** Jest unit tests for `resolveFillPrice` and the position math; one Playwright test that signs up, places an order, and verifies portfolio.

5. **Server-side price hydration.** A single cron job (Supabase Edge Function or Vercel cron) polls Onyx on a master interval and writes prices into a `market_prices` table. Clients then poll our own DB instead of Onyx directly — eliminates the N-user fan-out problem and makes the app resilient to Onyx downtime.

6. **Redis (at scale).** Not needed now, but if concurrent users grow significantly, Redis as a write-through cache in front of Onyx (or the `market_prices` table) would keep API route latency sub-millisecond under load. The price hydration cron we referenced earlier could serve as an intermediate step — Redis only makes sense after that pattern is in place and read volume justifies the added infrastructure.

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

## Design decisions

**Next.js** — API routes let the Onyx and Supabase keys live server-side only, so they never reach the client. SSR resolves the user session before the page is sent, avoiding auth flashes on the market detail and portfolio pages. Crucially, it collapses frontend, API proxy, and cron jobs into a single Vercel deployment with no separate backend process. The trade-off is App Router complexity (server vs. client component boundaries, SSR-aware cookie handling) that wouldn't be necessary for a purely public, auth-free app.

**Tailwind v4** — utility classes keep styles co-located with markup, which matters for a small codebase where a separate CSS layer would just be indirection. Dark mode, responsive breakpoints, and design tokens are handled without any configuration overhead. The trade-off is verbose class lists in JSX, but at this scale that's preferable to context-switching between files.
