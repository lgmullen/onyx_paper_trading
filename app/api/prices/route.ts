import { NextResponse } from "next/server";
import { getMarketPrice, type MarketPrice } from "@/lib/onyx";

export const dynamic = "force-dynamic";

// Batch price fetch via parallel single-price calls.
// Onyx's POST /prices/batch returns {} in current env, so we fan out instead.
export async function POST(request: Request) {
  let body: { symbols?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const symbols = Array.isArray(body.symbols)
    ? body.symbols.filter((s): s is string => typeof s === "string").slice(0, 50)
    : [];
  if (symbols.length === 0) return NextResponse.json({ prices: {} });

  const entries = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const p = await getMarketPrice(sym);
        return [sym, p] as const;
      } catch {
        return [sym, null] as const;
      }
    }),
  );

  const prices: Record<string, MarketPrice | null> = {};
  for (const [sym, p] of entries) prices[sym] = p;
  return NextResponse.json({ prices });
}
