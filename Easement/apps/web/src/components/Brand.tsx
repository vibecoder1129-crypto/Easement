import Image from "next/image";
import Link from "next/link";

/** Transparent E mark embedded in clean white badge frame */
export function BrandLogo({
  size = 36,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt="Easement Mark"
      width={size}
      height={size}
      className={`object-contain transition-transform duration-300 group-hover:scale-105 ${className}`}
      priority={priority}
    />
  );
}

type WordmarkSize = "sm" | "md" | "lg" | "xl";

const wordmarkClass: Record<WordmarkSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl sm:text-5xl",
  xl: "text-5xl sm:text-6xl",
};

export function BrandWordmark({
  size = "md",
}: {
  size?: WordmarkSize;
}) {
  return (
    <span className={`ease-wordmark-pastel ${wordmarkClass[size]}`}>
      Ease<span className="ment">ment</span>
    </span>
  );
}

/** Header Link */
export function BrandHeaderLink() {
  return (
    <Link href="/" className="ease-brand-lockup group">
      <div className="ease-emblem-badge ease-emblem-badge--header">
        <BrandLogo size={28} className="h-7 w-7" priority />
      </div>
      <BrandWordmark size="md" />
    </Link>
  );
}

/** Clean Footer Brand */
export function BrandFooter() {
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
      <div className="flex items-center gap-3">
        <div className="ease-emblem-badge p-2">
          <BrandLogo size={32} className="h-8 w-8" />
        </div>
        <div>
          <BrandWordmark size="md" />
          <p className="text-xs tracking-wider text-slate-500 mt-0.5">
            Appointments Made Effortless
          </p>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Easement Inc. All rights reserved.
      </p>
    </div>
  );
}
