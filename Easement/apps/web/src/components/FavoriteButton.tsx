"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { api } from "@/lib/api";

export function FavoriteButton({
  businessId,
  initialFavorited = false,
  className = "",
  onChange,
}: {
  businessId: string;
  initialFavorited?: boolean;
  className?: string;
  onChange?: (favorited: boolean) => void;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (favorited) {
        await api(`/favorites/${businessId}`, { method: "DELETE" });
        setFavorited(false);
        onChange?.(false);
      } else {
        await api(`/favorites/${businessId}`, { method: "POST" });
        setFavorited(true);
        onChange?.(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.toLowerCase().includes("not authenticated") ||
        message.toLowerCase().includes("unauthorized")
      ) {
        router.push(
          `/login?next=${encodeURIComponent(
            typeof window !== "undefined"
              ? window.location.pathname
              : "/marketplace",
          )}`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
      disabled={busy}
      onClick={toggle}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 dark:bg-slate-900/80 shadow-sm transition ${
        favorited
          ? "border-rose-200 text-rose-500"
          : "border-[var(--ease-border)] text-[var(--ease-text-muted)] hover:text-rose-500"
      } ${className}`}
    >
      <span className="text-base leading-none">{favorited ? "♥" : "♡"}</span>
    </button>
  );
}
