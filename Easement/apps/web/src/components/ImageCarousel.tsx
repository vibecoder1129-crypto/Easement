"use client";

import { useEffect, useRef, useState } from "react";

export function ImageCarousel({
  images,
  alt,
  className = "",
  aspectClass = "aspect-[16/10]",
  showDots = true,
}: {
  images: string[];
  alt: string;
  className?: string;
  aspectClass?: string;
  showDots?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = images.length > 0 ? images : [];

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      setIndex(Math.round(el.scrollLeft / w));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function go(delta: number) {
    const el = scrollerRef.current;
    if (!el || slides.length === 0) return;
    const next = Math.min(slides.length - 1, Math.max(0, index + delta));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  }

  if (slides.length === 0) {
    return (
      <div
        className={`${aspectClass} w-full bg-gradient-to-br from-indigo-100 to-rose-100 dark:from-indigo-900/40 dark:to-rose-900/30 ${className}`}
      />
    );
  }

  return (
    <div className={`relative group overflow-hidden ${className}`}>
      <div
        ref={scrollerRef}
        className={`flex ${aspectClass} overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {slides.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={src}
            alt={`${alt} ${i + 1}`}
            className="h-full w-full shrink-0 snap-center object-cover"
            draggable={false}
          />
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 dark:bg-slate-900/80 border border-black/5 px-2.5 py-1.5 text-sm font-bold shadow-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 dark:bg-slate-900/80 border border-black/5 px-2.5 py-1.5 text-sm font-bold shadow-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition"
          >
            ›
          </button>
        </>
      )}

      {showDots && slides.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition ${
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
