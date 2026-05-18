import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMarket, getMarketPrice, resolveFillPrice } from "@/lib/onyx";

export const dynamic = "force-dynamic";

type OrderBody = {
  symbol?: string;
  side?: "YES" | "NO";
  quantity?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: OrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { symbol, side, quantity } = body;
  if (!symbol || (side !== "YES" && side !== "NO") || !Number.isInteger(quantity) || quantity! <= 0) {
    return NextResponse.json(
      { error: "symbol, side (YES|NO), and positive integer quantity required" },
      { status: 400 },
    );
  }

  // Fetch live market + price from Onyx (server-side, fresh).
  let market;
  let price;
  try {
    [market, price] = await Promise.all([getMarket(symbol), getMarketPrice(symbol)]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upstream error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const fillPrice = resolveFillPrice(market, price, side);
  if (fillPrice == null) {
    return NextResponse.json(
      { error: "no live price available for this market" },
      { status: 409 },
    );
  }

  const rounded = Math.round(fillPrice * 10000) / 10000;

  const { data, error } = await supabase.rpc("place_paper_order", {
    p_symbol: symbol,
    p_market_name: market.name,
    p_side: side,
    p_quantity: quantity,
    p_fill_price: rounded,
  });

  if (error) {
    const status = error.message.includes("insufficient") ? 402 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, fill_price: rounded, result: data });
}
