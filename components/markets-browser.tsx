"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import type { Market } from "@/lib/onyx";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function priceCell(yes: number | null) {
  if (yes == null) return <span className="text-zinc-400 font-mono">—</span>;
  return (
    <span className="font-mono">
      <span className="text-green-600 dark:text-green-400">
        {(yes * 100).toFixed(1)}¢
      </span>
      <span className="text-zinc-400 mx-1">/</span>
      <span className="text-red-600 dark:text-red-400">
        {((1 - yes) * 100).toFixed(1)}¢
      </span>
    </span>
  );
}

export default function MarketsBrowser() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [onlyPriced, setOnlyPriced] = useState(false);
  const [limit, setLimit] = useState(200);

  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (statusFilter) qs.set("status", statusFilter);

  const { data, error, isLoading } = useSWR<{ markets: Market[] }>(
    `/api/markets?${qs.toString()}`,
    fetcher,
    { refreshInterval: 5000, keepPreviousData: true },
  );

  const markets = data?.markets ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return markets.filter((m) => {
      if (onlyPriced && m.yes_price == null) return false;
      if (!q) return true;
      return (
        m.symbol.toLowerCase().includes(q) ||
        (m.name ?? "").toLowerCase().includes(q) ||
        (m.event_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [markets, search, onlyPriced]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Markets</h1>
          <p className="text-sm text-zinc-500">
            Live prices from the Onyx Predictions API. Prices refresh every 5s.
          </p>
        </div>
        <div className="text-xs text-zinc-500">
          {isLoading
            ? "Loading…"
            : `${filtered.length} of ${markets.length} markets`}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or symbol…"
          className="flex-1 min-w-[240px] rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="halted">Halted</option>
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
        >
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={onlyPriced}
            onChange={(e) => setOnlyPriced(e.target.checked)}
          />
          Only show markets with live prices
        </label>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 px-4 py-3 text-sm mb-4">
          Failed to load markets. Retrying…
        </div>
      )}

      <div className="rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Market</th>
              <th className="px-4 py-2 font-medium hidden md:table-cell">
                Expires
              </th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">
                Status
              </th>
              <th className="px-4 py-2 font-medium text-right">YES / NO</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const expired =
                m.expiry_date != null && new Date(m.expiry_date) < new Date();
              return (
                <tr
                  key={m.id}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/markets/${encodeURIComponent(m.symbol)}`}
                      className="block"
                    >
                      <div className="font-medium">
                        {m.name ?? m.symbol}
                        {expired && (
                          <span className="ml-2 text-xs font-normal text-red-500">
                            expired
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {m.symbol}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell text-zinc-500 text-xs">
                    {m.expiry_date
                      ? new Date(m.expiry_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell text-xs">
                    <span className="inline-block rounded px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800">
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {priceCell(m.yes_price)}
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-zinc-500"
                >
                  No markets match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
