import { Suspense } from "react";
import MarketplaceClient from "./MarketplaceClient";

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-[var(--ease-text-muted)] font-semibold">
          Loading marketplace…
        </div>
      }
    >
      <MarketplaceClient />
    </Suspense>
  );
}
