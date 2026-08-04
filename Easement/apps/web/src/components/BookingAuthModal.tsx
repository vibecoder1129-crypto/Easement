"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

type Mode = "login" | "signup";

export function BookingAuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      if (mode === "login") {
        await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
          }),
        });
      } else {
        await api("/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone") || undefined,
            password: form.get("password"),
            role: "consumer",
          }),
        });
      }
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-auth-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] p-6 shadow-xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full px-2 py-1 text-sm font-semibold text-[var(--ease-text-muted)] hover:bg-slate-100 dark:hover:bg-white/10"
        >
          ✕
        </button>

        <h2
          id="booking-auth-title"
          className="text-xl font-extrabold text-[var(--ease-text-main)] pr-8"
        >
          Log in or sign up to book
        </h2>
        <p className="mt-1.5 text-sm text-[var(--ease-text-muted)]">
          Your appointment details are saved. We only need an account to confirm.
        </p>

        <div className="mt-5 flex rounded-full border border-[var(--ease-border)] p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 rounded-full py-2 transition ${
              mode === "signup"
                ? "bg-indigo-600 text-white"
                : "text-[var(--ease-text-muted)]"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-full py-2 transition ${
              mode === "login"
                ? "bg-indigo-600 text-white"
                : "text-[var(--ease-text-muted)]"
            }`}
          >
            Log in
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
              Name
              <input
                name="name"
                required
                placeholder="Jane Doe"
                className="ease-input mt-1.5"
              />
            </label>
          )}

          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
            Email
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="ease-input mt-1.5"
            />
          </label>

          {mode === "signup" && (
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
              Phone{" "}
              <span className="font-normal normal-case text-[var(--ease-text-subtle)]">
                (optional)
              </span>
              <input
                name="phone"
                placeholder="+371 …"
                className="ease-input mt-1.5"
              />
            </label>
          )}

          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
            Password
            <input
              name="password"
              type="password"
              minLength={8}
              required
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
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
            className="ease-btn-primary w-full py-3.5 font-bold"
          >
            {loading
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
                ? "Continue"
                : "Create account & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
