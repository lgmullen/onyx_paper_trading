import { NextResponse } from "next/server";
import { listMarkets } from "@/lib/onyx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 100);
  const limit = Math.min(
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100),
    1000,
  );
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
  const sport = url.searchParams.get("sport") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  try {
    const markets = await listMarkets({ limit, offset, sport, status });
    return NextResponse.json({ markets });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch markets";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
