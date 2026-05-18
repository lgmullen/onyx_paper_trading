import { NextResponse } from "next/server";
import { getMarketPrice } from "@/lib/onyx";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  try {
    const price = await getMarketPrice(symbol);
    return NextResponse.json(price);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch price";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
