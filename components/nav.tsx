import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let balance: number | null = null;
  let username: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, balance")
      .eq("id", user.id)
      .maybeSingle();
    balance = data?.balance ?? null;
    username = data?.username ?? null;
  }

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-6">
      <Link href="/markets" className="font-semibold tracking-tight">
        Onyx Paper
      </Link>
      <Link href="/markets" className="text-sm hover:underline">
        Markets
      </Link>
      {user && (
        <Link href="/portfolio" className="text-sm hover:underline">
          Portfolio
        </Link>
      )}
      <div className="ml-auto flex items-center gap-4 text-sm">
        {user ? (
          <>
            {balance != null && (
              <span className="text-zinc-500">
                Balance:{" "}
                <span className="font-mono text-zinc-900 dark:text-zinc-100">
                  ${balance.toFixed(2)}
                </span>
              </span>
            )}
            {username && <span className="text-zinc-500">@{username}</span>}
            <form action="/logout" method="post">
              <button type="submit" className="underline">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:underline">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded bg-black text-white px-3 py-1.5 dark:bg-white dark:text-black"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
