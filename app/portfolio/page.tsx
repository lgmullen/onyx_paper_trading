import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortfolioView from "@/components/portfolio-view";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portfolio");

  const [profileRes, positionsRes, ordersRes] = await Promise.all([
    supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle(),
    supabase
      .from("positions")
      .select("id, symbol, market_name, side, quantity, avg_price")
      .eq("user_id", user.id)
      .gt("quantity", 0)
      .order("updated_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, symbol, market_name, side, quantity, fill_price, total_cost, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const balance = Number(profileRes.data?.balance ?? 0);
  const positions = (positionsRes.data ?? []).map((p) => ({
    ...p,
    avg_price: Number(p.avg_price),
    side: p.side as "YES" | "NO",
  }));
  const orders = (ordersRes.data ?? []).map((o) => ({
    ...o,
    fill_price: Number(o.fill_price),
    total_cost: Number(o.total_cost),
    side: o.side as "YES" | "NO",
  }));

  return <PortfolioView positions={positions} orders={orders} balance={balance} />;
}
