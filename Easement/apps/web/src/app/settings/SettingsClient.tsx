"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";

type Me = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  remindersEnabled?: boolean;
};

export default function SettingsClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let mounted = true;
    api<Me>("/auth/me")
      .then((user) => {
        if (!mounted) return;
        if (user.role === "admin") {
          router.replace("/admin");
          return;
        }
        setMe(user);
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone ?? "");
      })
      .catch(() => router.replace("/login?next=/settings"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingProfile(true);
    try {
      const updated = await api<Me>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      setMe(updated);
      setName(updated.name);
      setEmail(updated.email);
      setPhone(updated.phone ?? "");
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingPassword(true);
    try {
      await api("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password changed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change password",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    if (!deletePassword) {
      setError("Enter your password to delete the account.");
      return;
    }
    setConfirmDelete(true);
  }

  async function runDeleteAccount() {
    setError(null);
    setSuccess(null);
    setDeleting(true);
    try {
      await api("/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      setConfirmDelete(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete account",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-[var(--ease-text-muted)] font-semibold">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)]">
      <AppHeader user={me} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete account?"
        message="This permanently removes your account and cannot be undone."
        confirmLabel="Delete account"
        cancelLabel="Keep account"
        danger
        busy={deleting}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        onConfirm={() => void runDeleteAccount()}
      />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <Link href="/home" className="text-xs font-semibold text-indigo-600">
            ← Home
          </Link>
          <h1 className="text-3xl font-extrabold mt-2">Settings</h1>
          <p className="mt-1 text-sm text-[var(--ease-text-muted)]">
            Update your profile, password, or delete your account.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <form onSubmit={saveProfile} className="ease-card-clean p-5 sm:p-6 space-y-4 mb-6">
          <h2 className="font-bold text-lg">Profile</h2>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ease-text-muted)]">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ease-text-muted)]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ease-text-muted)]">
              Phone
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+371 …"
              className="mt-1 w-full rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={savingProfile}
            className="ease-btn-primary text-sm py-2.5 px-5 disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>

        <form
          onSubmit={savePassword}
          className="ease-card-clean p-5 sm:p-6 space-y-4 mb-6"
        >
          <h2 className="font-bold text-lg">Password</h2>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ease-text-muted)]">
              Current password
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ease-text-muted)]">
              New password
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3 py-2.5 text-sm"
            />
            <span className="mt-1 block text-[11px] text-[var(--ease-text-subtle)]">
              At least 8 characters.
            </span>
          </label>
          <button
            type="submit"
            disabled={savingPassword}
            className="ease-btn-primary text-sm py-2.5 px-5 disabled:opacity-50"
          >
            {savingPassword ? "Updating…" : "Change password"}
          </button>
        </form>

        <form
          onSubmit={deleteAccount}
          className="ease-card-clean p-5 sm:p-6 space-y-4 border-rose-200 dark:border-rose-500/30"
        >
          <h2 className="font-bold text-lg text-rose-700 dark:text-rose-400">
            Delete account
          </h2>
          <p className="text-sm text-[var(--ease-text-muted)]">
            Permanently removes your account and booking history. Business owners
            and staff linked to a venue must leave that role first.
          </p>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ease-text-muted)]">
              Confirm with your password
            </span>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={deleting}
            className="rounded-full border border-rose-300 bg-rose-600 text-white text-sm font-semibold py-2.5 px-5 hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </form>
      </main>
    </div>
  );
}
