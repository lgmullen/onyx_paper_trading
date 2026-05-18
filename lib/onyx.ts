const BASE = "https://predictions.dev-onyxodds.com";

export type Market = {
  id: string;
  symbol: string;
  sport: string;
  name: string | null;
  event_name: string | null;
  status: string;
  expiry_date: string | null;
  min_price: number;
  max_price: number;
  yes_price: number | null;
};

export type MarketPrice = {
  symbol: string;
  bid_price: number | null;
  ask_price: number | null;
  last_price: number | null;
  volume: number | null;
};

const headers: HeadersInit = {
  accept: "application/json",
  ...(process.env.ONYX_JWT ? { Authorization: `Bearer ${process.env.ONYX_JWT}` } : {}),
};

export type ListMarketsParams = {
  sport?: string;
  status?: string;
  event_type?: string;
  contract_type?: string;
  limit?: number;
  offset?: number;
};

export async function listMarkets(params: ListMarketsParams = {}): Promise<Market[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${BASE}/markets?${qs.toString()}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Onyx /markets failed: ${res.status}`);
  return res.json();
}

export async function getMarket(symbol: string): Promise<Market> {
  const res = await fetch(`${BASE}/markets/${encodeURIComponent(symbol)}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Onyx /markets/${symbol} failed: ${res.status}`);
  return res.json();
}

export async function getMarketPrice(symbol: string): Promise<MarketPrice> {
  const res = await fetch(`${BASE}/markets/${encodeURIComponent(symbol)}/prices`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Onyx prices failed: ${res.status}`);
  return res.json();
}

// Resolves the effective YES and NO prices for paper trading.
// The Onyx API returns a single bid/ask pair representing the YES side.
// NO side is the complement: NO_bid = 1 - YES_ask, NO_ask = 1 - YES_bid.
// We use last_price (or mid) as the fill price for instant paper fills,
// falling back to yes_price from the market metadata.
export function resolveFillPrice(
  market: Market,
  price: MarketPrice,
  side: "YES" | "NO",
): number | null {
  // Prefer a real fill candidate: ask (what you pay to buy), else last, else mid, else yes_price.
  let yesPrice: number | null = null;
  if (price.ask_price != null && price.bid_price != null) {
    yesPrice = (price.ask_price + price.bid_price) / 2;
  } else if (price.last_price != null) {
    yesPrice = price.last_price;
  } else if (price.ask_price != null) {
    yesPrice = price.ask_price;
  } else if (price.bid_price != null) {
    yesPrice = price.bid_price;
  } else if (market.yes_price != null) {
    yesPrice = market.yes_price;
  }

  if (yesPrice == null) return null;
  // Clamp to the market's allowed range to avoid placing impossible orders.
  const clamped = Math.max(market.min_price, Math.min(market.max_price, yesPrice));
  return side === "YES" ? clamped : 1 - clamped;
}
