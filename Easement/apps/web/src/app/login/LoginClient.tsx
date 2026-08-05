"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { api } from "@/lib/api";
import { safeNextPath } from "@/lib/safe-next";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<{ userId: string; role: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (next) {
        router.push(next);
      } else if (result.role === "business_owner") {
        router.push("/dashboard");
      } else {
        router.push("/home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ease-mesh-pastel min-h-screen text-slate-900 flex flex-col justify-between">
      <div>
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-12">
          <div className="text-center">
            <span className="inline-block rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">
              Welcome Back
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Log in to Easement
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Access your business dashboard or manage upcoming bookings.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="ease-card-clean mt-8 space-y-4 p-6 sm:p-8"
          >
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Email Address
              <input
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                className="ease-input mt-1.5"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Password
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="ease-input mt-1.5"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ease-btn-primary w-full py-3.5 mt-2 font-bold"
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Don&apos;t have an account yet?{" "}
            <Link
              href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
              className="font-semibold text-indigo-600 hover:underline"
            >
              Create one now
            </Link>
          </p>
        </main>
      </div>

      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Easement Inc. All rights reserved.
      </footer>
    </div>
  );
}
