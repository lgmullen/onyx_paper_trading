"use client";

import Link from "next/link";
import useSWR from "swr";
import type { MarketPrice } from "@/lib/onyx";

type Position = {
  id: string;
  symbol: string;
  market_name: string | null;
  side: "YES" | "NO";
  quantity: number;
  avg_price: number;
};

type Order = {
  id: string;
  symbol: string;
  market_name: string | null;
  side: "YES" | "NO";
  quantity: number;
  fill_price: number;
  total_cost: number;
  created_at: string;
};

const fetcher = async (url: string, init?: RequestInit) =>
  fetch(url, init).then((r) => r.json());

type PricesResp = { prices: Record<string, MarketPrice | null> };

function currentMark(side: "YES" | "NO", p: MarketPrice | null | undefined): number | null {
  if (!p) return null;
  let yes: number | null = null;
  if (p.bid_price != null && p.ask_price != null) yes = (p.bid_price + p.ask_price) / 2;
  else if (p.last_price != null) yes = p.last_price;
  else if (p.bid_price != null) yes = p.bid_price;
  else if (p.ask_price != null) yes = p.ask_price;
  if (yes == null) return null;
  return side === "YES" ? yes : 1 - yes;
}

export default function PortfolioView({
  positions,
  orders,
  balance,
}: {
  positions: Position[];
  orders: Order[];
  balance: number;
}) {
  const symbols = Array.from(new Set(positions.map((p) => p.symbol)));

  const { data: pricesResp } = useSWR<PricesResp>(
    symbols.length > 0 ? ["prices", symbols.join(",")] : null,
    () =>
      fetcher("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
      }) as Promise<PricesResp>,
    { refreshInterval: 10000 },
  );
  const prices = pricesResp?.prices ?? {};

  let totalMarket = 0;
  let totalCost = 0;
  const rows = positions.map((pos) => {
    const mark = currentMark(pos.side, prices[pos.symbol]);
    const cost = pos.avg_price * pos.quantity;
    const value = mark == null ? null : mark * pos.quantity;
    const pnl = value == null ? null : value - cost;
    if (value != null) {
      totalMarket += value;
      totalCost += cost;
    }
    return { pos, mark, cost, value, pnl };
  });
  const totalPnL = totalMarket - totalCost;
  const totalEquity = balance + totalMarket;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Portfolio</h1>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs text-zinc-500">Cash balance</div>
          <div className="text-xl font-mono mt-1">${balance.toFixed(2)}</div>
        </div>
        <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs text-zinc-500">Market value of positions</div>
          <div className="text-xl font-mono mt-1">${totalMarket.toFixed(2)}</div>
        </div>
        <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs text-zinc-500">Total equity</div>
          <div className="text-xl font-mono mt-1">${totalEquity.toFixed(2)}</div>
          <div
            className={`text-xs mt-1 ${
              totalPnL >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            Unrealized P&amp;L: {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
          </div>
        </div>
      </div>

      <h2 className="font-semibold mb-2">Positions</h2>
      <div className="rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-left">
            <tr>
              <th className="px-4 py-2">Market</th>
              <th className="px-4 py-2">Side</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Avg</th>
              <th className="px-4 py-2 text-right">Mark</th>
              <th className="px-4 py-2 text-right">Value</th>
              <th className="px-4 py-2 text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pos, mark, value, pnl }) => (
              <tr key={pos.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2">
                  <Link
                    href={`/markets/${encodeURIComponent(pos.symbol)}`}
                    className="hover:underline"
                  >
                    {pos.market_name ?? pos.symbol}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      pos.side === "YES" ? "text-green-600" : "text-red-600"
                    }
                  >
                    {pos.side}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono">{pos.quantity}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {(pos.avg_price * 100).toFixed(1)}¢
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {mark == null ? "—" : `${(mark * 100).toFixed(1)}¢`}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {value == null ? "—" : `$${value.toFixed(2)}`}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono ${
                    pnl == null ? "" : pnl >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
                </td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No positions yet.{" "}
                  <Link href="/markets" className="underline">
                    Browse markets
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold mb-2">Order history</h2>
      <div className="rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-left">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Market</th>
              <th className="px-4 py-2">Side</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Fill</th>
              <th className="px-4 py-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {new Date(o.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/markets/${encodeURIComponent(o.symbol)}`}
                    className="hover:underline"
                  >
                    {o.market_name ?? o.symbol}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={o.side === "YES" ? "text-green-600" : "text-red-600"}
                  >
                    {o.side}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono">{o.quantity}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {(o.fill_price * 100).toFixed(1)}¢
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  ${Number(o.total_cost).toFixed(2)}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
