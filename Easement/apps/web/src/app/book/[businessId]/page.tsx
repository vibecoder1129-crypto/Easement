import { Suspense } from "react";
import BookClient from "./BookClient";

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="ease-mesh-pastel min-h-screen flex items-center justify-center font-semibold text-[var(--ease-text-muted)]">
          Loading booking…
        </div>
      }
    >
      <BookClient />
    </Suspense>
  );
}
