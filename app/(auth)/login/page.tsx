"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { loginAction } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/markets";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const r = await loginAction(fd);
          if (r?.error) setError(r.error);
        })
      }
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          name="email"
          required
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          name="password"
          required
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-black text-white py-2 disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-16 px-6">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
      <p className="text-sm text-zinc-500 mt-4">
        No account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
