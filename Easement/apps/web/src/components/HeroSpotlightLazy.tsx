"use client";

import dynamic from "next/dynamic";

const HeroSpotlight = dynamic(
  () => import("@/components/HeroSpotlight").then((m) => m.HeroSpotlight),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-[4/5] w-full rounded-[28px] overflow-hidden border border-[var(--ease-border)] animate-pulse"
        style={{
          background:
            "linear-gradient(160deg, #1e293b 0%, #0f172a 40%, #134e4a 100%)",
        }}
      />
    ),
  },
);

export function HeroSpotlightLazy({ area = "Riga" }: { area?: string }) {
  return <HeroSpotlight area={area} />;
}
