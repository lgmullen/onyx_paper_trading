"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signupAction } from "./actions";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-sm py-16 px-6">
      <h1 className="text-2xl font-semibold mb-2">Create account</h1>
      <p className="text-sm text-zinc-500 mb-6">
        You&rsquo;ll start with <strong>$1,000</strong> in paper balance.
      </p>
      <form
        action={(fd) =>
          startTransition(async () => {
            const r = await signupAction(fd);
            if (r?.error) setError(r.error);
          })
        }
        className="space-y-4"
      >
        <div>
          <label className="block text-sm mb-1">Username</label>
          <input
            name="username"
            required
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2"
          />
        </div>
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
            minLength={6}
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-black text-white py-2 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="text-sm text-zinc-500 mt-4">
        Have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
