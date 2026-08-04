"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { api } from "@/lib/api";

type Me = { userId: string; name: string; email: string; role: string };

type AdminBusiness = {
  businessId: string;
  name: string;
  category: string;
  status: string;
  createdAt: string;
  owner: { userId: string; name: string; email: string };
  locationCount: number;
  staffCount: number;
  serviceCount: number;
};

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default function AdminClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<AdminBusiness[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (status: StatusFilter) => {
    const list = await api<AdminBusiness[]>(
      `/admin/businesses?status=${status}`,
    );
    setItems(list);
  }, []);

  useEffect(() => {
    let mounted = true;
    api<Me>("/auth/me")
      .then(async (user) => {
        if (!mounted) return;
        if (user.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setMe(user);
        await load(filter);
      })
      .catch(() => router.replace("/login?next=/admin"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router, load, filter]);

  async function setStatus(businessId: string, status: "approved" | "rejected") {
    setBusyId(businessId);
    setError(null);
    try {
      await api(`/admin/businesses/${businessId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-[var(--ease-text-muted)] font-semibold">
        Loading admin…
      </div>
    );
  }

  const filters: StatusFilter[] = ["pending", "approved", "rejected", "all"];

  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)]">
      <AppHeader user={me} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold">Admin</h1>
          <p className="mt-1 text-sm text-[var(--ease-text-muted)]">
            Approve or reject businesses before they appear on the marketplace.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                filter === f
                  ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="ease-card-clean p-8 text-center">
            <h2 className="font-bold text-lg">No businesses here</h2>
            <p className="mt-2 text-sm text-[var(--ease-text-muted)]">
              {filter === "pending"
                ? "Nothing waiting for approval."
                : "Try another filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((b) => (
              <div key={b.businessId} className="ease-card-clean p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-lg">{b.name}</h2>
                      <span className="rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        {b.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--ease-text-muted)] capitalize">
                      {b.category} · {b.locationCount} location
                      {b.locationCount === 1 ? "" : "s"} · {b.staffCount} staff ·{" "}
                      {b.serviceCount} service
                      {b.serviceCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-2 text-xs text-[var(--ease-text-subtle)]">
                      Owner: {b.owner.name} ({b.owner.email})
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ease-text-subtle)]">
                      Submitted {new Date(b.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {b.status !== "approved" && (
                      <button
                        type="button"
                        disabled={busyId === b.businessId}
                        onClick={() => void setStatus(b.businessId, "approved")}
                        className="ease-btn-primary text-xs py-2 px-4 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    {b.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={busyId === b.businessId}
                        onClick={() => void setStatus(b.businessId, "rejected")}
                        className="ease-btn-secondary text-xs py-2 px-4 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
