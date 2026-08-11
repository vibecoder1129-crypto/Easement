"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ease-mesh-pastel min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] p-6 text-center">
        <h1 className="text-xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--ease-text-muted)]">
          An unexpected error occurred. You can try again or go home.
        </p>
        <div className="mt-5 flex gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="ease-btn-primary text-sm py-2 px-4"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-2xl border border-[var(--ease-border)] text-sm font-bold py-2 px-4"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
