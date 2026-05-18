"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import type { Market, MarketPrice } from "@/lib/onyx";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  market: Market;
  isAuthed: boolean;
};

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}¢`;
}

export default function OrderPanel({ market, isAuthed }: Props) {
  const { data: live } = useSWR<Market>(
    `/api/markets/${encodeURIComponent(market.symbol)}`,
    fetcher,
    { refreshInterval: 10000, fallbackData: market },
  );
  const { data: price } = useSWR<MarketPrice>(
    `/api/markets/${encodeURIComponent(market.symbol)}/prices`,
    fetcher,
    { refreshInterval: 10000 },
  );

  const yes = live?.yes_price ?? null;
  const noPrice = yes != null ? 1 - yes : null;

  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [qty, setQty] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Estimated fill price = mid of bid/ask, else last, else yes_price.
  let yesFill: number | null = null;
  if (price?.bid_price != null && price?.ask_price != null) {
    yesFill = (price.bid_price + price.ask_price) / 2;
  } else if (price?.last_price != null) yesFill = price.last_price;
  else if (yes != null) yesFill = yes;
  const sideFill = yesFill == null ? null : side === "YES" ? yesFill : 1 - yesFill;
  const estCost = sideFill == null ? null : sideFill * qty;

  async function submit() {
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: market.symbol, side, quantity: qty }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: json.error ?? "Order failed" });
      } else {
        setMsg({
          kind: "ok",
          text: `Filled ${qty} ${side} @ ${fmtPct(json.fill_price)} — cost $${(
            json.fill_price * qty
          ).toFixed(2)}`,
        });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "network error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4">
      <h2 className="font-semibold mb-3">Place paper order</h2>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setSide("YES")}
          className={`rounded border px-3 py-2 text-sm font-medium ${
            side === "YES"
              ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          Buy YES <span className="font-mono ml-1">{fmtPct(yes)}</span>
        </button>
        <button
          onClick={() => setSide("NO")}
          className={`rounded border px-3 py-2 text-sm font-medium ${
            side === "NO"
              ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          Buy NO <span className="font-mono ml-1">{fmtPct(noPrice)}</span>
        </button>
      </div>

      <label className="block text-sm mb-1">Quantity</label>
      <input
        type="number"
        min={1}
        step={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
        className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 mb-3"
      />

      <div className="text-sm text-zinc-500 mb-3 space-y-1">
        <div className="flex justify-between">
          <span>Est. fill price</span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100">
            {fmtPct(sideFill)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Est. cost</span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100">
            {estCost == null ? "—" : `$${estCost.toFixed(2)}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Max payout (if right)</span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100">
            ${qty.toFixed(2)}
          </span>
        </div>
      </div>

      {!isAuthed ? (
        <Link
          href={`/login?next=/markets/${encodeURIComponent(market.symbol)}`}
          className="block w-full text-center rounded bg-black text-white py-2 dark:bg-white dark:text-black"
        >
          Log in to trade
        </Link>
      ) : (
        <button
          onClick={submit}
          disabled={submitting || sideFill == null}
          className={`w-full rounded py-2 text-white font-medium disabled:opacity-50 ${
            side === "YES" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {submitting ? "Placing…" : `Buy ${qty} ${side}`}
        </button>
      )}

      {msg && (
        <p
          className={`mt-3 text-sm ${
            msg.kind === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
        <div className="flex justify-between">
          <span>Bid</span>
          <span className="font-mono">{fmtPct(price?.bid_price)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ask</span>
          <span className="font-mono">{fmtPct(price?.ask_price)}</span>
        </div>
        <div className="flex justify-between">
          <span>Last</span>
          <span className="font-mono">{fmtPct(price?.last_price)}</span>
        </div>
        <div className="flex justify-between">
          <span>Volume</span>
          <span className="font-mono">{price?.volume ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
