import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarket } from "@/lib/onyx";
import { createClient } from "@/lib/supabase/server";
import OrderPanel from "@/components/order-panel";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage(props: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await props.params;
  let market;
  try {
    market = await getMarket(decodeURIComponent(symbol));
  } catch {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/markets" className="text-sm text-zinc-500 hover:underline">
        ← All markets
      </Link>

      <div className="mt-4 grid md:grid-cols-[1fr_320px] gap-8">
        <div>
          <h1 className="text-2xl font-semibold">{market.name ?? market.symbol}</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">{market.symbol}</p>

          <dl className="mt-6 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-zinc-500">Sport</dt>
            <dd>{market.sport}</dd>
            <dt className="text-zinc-500">Status</dt>
            <dd>{market.status}</dd>
            <dt className="text-zinc-500">Expires</dt>
            <dd>{market.expiry_date ? new Date(market.expiry_date).toLocaleString() : "—"}</dd>
            <dt className="text-zinc-500">Price range</dt>
            <dd>
              {market.min_price.toFixed(2)} – {market.max_price.toFixed(2)}
            </dd>
          </dl>

          <div className="mt-8 rounded border border-zinc-200 dark:border-zinc-800 p-4 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>How paper trading works:</strong> orders fill instantly at the current
              upstream mid-price (or last trade if no two-sided market). Buying YES at{" "}
              <code>p</code> costs <code>p × qty</code> and pays <code>$1 × qty</code> if the
              market resolves YES. NO is the complement.
            </p>
          </div>
        </div>

        <OrderPanel market={market} isAuthed={!!user} />
      </div>
    </div>
  );
}
