"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { api } from "@/lib/api";

export default function SignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const defaultRole = next ? "consumer" : "business_owner";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<{ userId: string; role: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone") || undefined,
          password: form.get("password"),
          role: form.get("role"),
        }),
      });
      if (next) {
        router.push(next);
      } else if (result.role === "business_owner") {
        router.push("/onboarding");
      } else {
        router.push("/home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
            <span className="inline-block rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2">
              Get Started
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Create Your Account
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {next
                ? "Create a client account to confirm your booking."
                : "Business owners set up location and staff next. Clients can book right away."}
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="ease-card-clean mt-8 space-y-4 p-6 sm:p-8"
          >
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Name
              <input name="name" required placeholder="Jane Doe" className="ease-input mt-1.5" />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Email Address
              <input
                name="email"
                type="email"
                required
                placeholder="jane@example.com"
                className="ease-input mt-1.5"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Phone Number <span className="font-normal lowercase text-slate-400">(optional)</span>
              <input name="phone" placeholder="+33 6 12 34 56 78" className="ease-input mt-1.5" />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Password
              <input
                name="password"
                type="password"
                minLength={8}
                required
                placeholder="At least 8 characters"
                className="ease-input mt-1.5"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Account Role
              <select
                name="role"
                defaultValue={defaultRole}
                className="ease-input mt-1.5"
              >
                <option value="consumer">Client (Book appointments)</option>
                <option value="business_owner">Business Owner (Salons, Spas, Barbers)</option>
              </select>
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
              {loading ? "Creating Account…" : "Create Account →"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already registered?{" "}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="font-semibold text-indigo-600 hover:underline"
            >
              Sign in
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
