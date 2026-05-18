import { NextResponse } from "next/server";
import { getMarket } from "@/lib/onyx";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  try {
    const market = await getMarket(symbol);
    return NextResponse.json(market);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch market";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
