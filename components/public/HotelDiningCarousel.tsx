"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type DiningVenue = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
};

type HotelDiningCarouselProps = {
  venues: DiningVenue[];
};

const AUTO_PLAY_MS = 5000;

function getCircularOffset(index: number, activeIndex: number, total: number) {
  let offset = index - activeIndex;

  if (offset > total / 2) {
    offset -= total;
  }

  if (offset < -total / 2) {
    offset += total;
  }

  return offset;
}

function getCardStyle(offset: number) {
  const absOffset = Math.abs(offset);
  const isActive = offset === 0;

  const x = offset * 310;
  const scale = isActive ? 1 : absOffset === 1 ? 0.88 : 0.76;
  const opacity = absOffset > 2 ? 0 : isActive ? 1 : absOffset === 1 ? 0.78 : 0.48;
  const zIndex = isActive ? 30 : absOffset === 1 ? 20 : 10;

  return {
    transform: `translateX(calc(-50% + ${x}px)) scale(${scale})`,
    opacity,
    zIndex,
    pointerEvents: absOffset > 2 ? "none" : "auto",
  } as const;
}

export function HotelDiningCarousel({ venues }: HotelDiningCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (venues.length <= 1 || isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) =>
        current === venues.length - 1 ? 0 : current + 1,
      );
    }, AUTO_PLAY_MS);

    return () => window.clearInterval(intervalId);
  }, [venues.length, isPaused]);

  function previous() {
    setActiveIndex((current) =>
      current === 0 ? venues.length - 1 : current - 1,
    );
  }

  function next() {
    setActiveIndex((current) =>
      current === venues.length - 1 ? 0 : current + 1,
    );
  }

  if (venues.length === 0) {
    return null;
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative mx-auto h-[680px] overflow-hidden">
        {venues.map((venue, index) => {
          const offset = getCircularOffset(index, activeIndex, venues.length);
          const absOffset = Math.abs(offset);
          const isActive = offset === 0;
          const isVisible = absOffset <= 2;

          return (
            <button
              key={venue.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              style={getCardStyle(offset)}
              className={[
                "absolute left-1/2 top-0 w-[430px] overflow-hidden border border-luxury-stone bg-white text-left shadow-xl transition-all duration-700 ease-out",
                isActive
                  ? "rounded-[2rem]"
                  : "rounded-[1.5rem] hover:opacity-100",
                isVisible ? "visible" : "invisible",
              ].join(" ")}
              aria-label={`View ${venue.title}`}
            >
              <div className="relative h-[280px] bg-slate-200">
                <Image
                  src={venue.imageUrl}
                  alt={venue.imageAlt}
                  fill
                  sizes="430px"
                  className="object-cover transition duration-700"
                />

                {!isActive ? <div className="absolute inset-0 bg-white/20" /> : null}
              </div>

              <div
                className={[
                  "flex min-h-[340px] flex-col items-center p-8 text-center",
                  isActive ? "justify-start" : "justify-center",
                ].join(" ")}
              >
                <p className="font-serif text-base italic text-slate-600">
                  {venue.subtitle}
                </p>

                <h3 className="mt-4 text-xl font-black uppercase tracking-[0.28em] text-luxury-ink">
                  {venue.title}
                </h3>

                <div className="mt-5 h-px w-14 bg-luxury-ink" />

                <p
                  className={[
                    "mt-6 text-sm leading-7 text-slate-600",
                    isActive ? "line-clamp-none" : "line-clamp-3",
                  ].join(" ")}
                >
                  {venue.description}
                </p>

                {isActive ? (
                  <div className="mt-auto grid w-full gap-3 pt-8">
                    <span className="inline-flex h-12 w-full items-center justify-center bg-luxury-navy px-5 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-luxury-ink">
                      Reserve a table
                    </span>

                    <span className="inline-flex h-12 w-full items-center justify-center bg-white px-5 text-sm font-black uppercase tracking-[0.22em] text-luxury-ink transition hover:bg-luxury-cream">
                      Learn more
                    </span>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={previous}
          className="inline-flex size-12 items-center justify-center rounded-full border border-luxury-stone bg-white text-lg font-black text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
          aria-label="Previous dining venue"
        >
          ‹
        </button>

        <p className="text-sm font-bold text-slate-500">
          {activeIndex + 1} / {venues.length}
        </p>

        <button
          type="button"
          onClick={next}
          className="inline-flex size-12 items-center justify-center rounded-full bg-luxury-navy text-lg font-black text-white shadow-sm transition hover:bg-luxury-ink"
          aria-label="Next dining venue"
        >
          ›
        </button>
      </div>
    </div>
  );
}