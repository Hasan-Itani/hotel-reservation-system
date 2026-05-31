"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type HotelGallerySlide = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
};

export type HotelGallerySection = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  slides: HotelGallerySlide[];
};

type HotelGallerySlidersProps = {
  sections: HotelGallerySection[];
};

const AUTO_PLAY_MS = 4500;

function getActiveIndex(activeIndexes: Record<string, number>, sectionId: string) {
  return activeIndexes[sectionId] || 0;
}

export function HotelGallerySliders({ sections }: HotelGallerySlidersProps) {
  const [activeIndexes, setActiveIndexes] = useState<Record<string, number>>({});
  const [pausedSectionIds, setPausedSectionIds] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndexes((current) => {
        const nextIndexes = { ...current };

        for (const section of sections) {
          if (pausedSectionIds[section.id]) {
            continue;
          }

          if (section.slides.length <= 1) {
            continue;
          }

          const currentIndex = current[section.id] || 0;
          nextIndexes[section.id] =
            currentIndex === section.slides.length - 1 ? 0 : currentIndex + 1;
        }

        return nextIndexes;
      });
    }, AUTO_PLAY_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [sections, pausedSectionIds]);

  function setActive(sectionId: string, index: number) {
    setActiveIndexes((current) => ({
      ...current,
      [sectionId]: index,
    }));
  }

  function setPaused(sectionId: string, isPaused: boolean) {
    setPausedSectionIds((current) => ({
      ...current,
      [sectionId]: isPaused,
    }));
  }

  function previous(section: HotelGallerySection) {
    const currentIndex = getActiveIndex(activeIndexes, section.id);
    const nextIndex =
      currentIndex === 0 ? section.slides.length - 1 : currentIndex - 1;

    setActive(section.id, nextIndex);
  }

  function next(section: HotelGallerySection) {
    const currentIndex = getActiveIndex(activeIndexes, section.id);
    const nextIndex =
      currentIndex === section.slides.length - 1 ? 0 : currentIndex + 1;

    setActive(section.id, nextIndex);
  }

  return (
    <>
      <style>
        {`
          @keyframes hotelGalleryFadeZoom {
            0% {
              opacity: 0;
              transform: scale(1.035);
            }

            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          .hotel-gallery-active-image {
            animation: hotelGalleryFadeZoom 750ms ease-out both;
          }
        `}
      </style>

      <div className="grid gap-12">
        {sections.map((section) => {
          if (section.slides.length === 0) {
            return null;
          }

          const activeIndex = getActiveIndex(activeIndexes, section.id);
          const activeSlide = section.slides[activeIndex];
          const hasMultipleSlides = section.slides.length > 1;

          return (
            <section
              key={section.id}
              onMouseEnter={() => setPaused(section.id, true)}
              onMouseLeave={() => setPaused(section.id, false)}
              className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5"
            >
              <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="relative h-[26rem] overflow-hidden bg-slate-200 sm:h-[34rem] lg:h-[42rem]">
                  <Image
                    key={activeSlide.id}
                    src={activeSlide.imageUrl}
                    alt={activeSlide.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 760px"
                    className="hotel-gallery-active-image object-cover"
                    priority={section.id === "rooms"}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

                  <div className="absolute inset-x-4 bottom-4 rounded-[1.5rem] border border-white/30 bg-white/90 p-4 shadow-lg backdrop-blur-xl sm:hidden">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold">
                      {activeSlide.eyebrow}
                    </p>
                    <p className="mt-2 text-lg font-black text-luxury-ink">
                      {activeSlide.title}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col p-6 sm:p-8 lg:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                    {section.eyebrow}
                  </p>

                  <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                    {section.title}
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {section.description}
                  </p>

                  <div
                    key={`${activeSlide.id}-copy`}
                    className="hotel-gallery-active-image mt-8 hidden rounded-[1.5rem] bg-luxury-cream p-5 sm:block"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold">
                      {activeSlide.eyebrow}
                    </p>

                    <h3 className="mt-3 text-2xl font-black tracking-tight text-luxury-ink">
                      {activeSlide.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {activeSlide.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => previous(section)}
                      disabled={!hasMultipleSlides}
                      className="inline-flex size-12 items-center justify-center rounded-full border border-luxury-stone bg-white text-lg font-black text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Previous ${section.title} image`}
                    >
                      ‹
                    </button>

                    <button
                      type="button"
                      onClick={() => next(section)}
                      disabled={!hasMultipleSlides}
                      className="inline-flex size-12 items-center justify-center rounded-full bg-luxury-navy text-lg font-black text-white shadow-sm transition hover:bg-luxury-ink disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Next ${section.title} image`}
                    >
                      ›
                    </button>

                    <p className="ml-2 text-sm font-bold text-slate-500">
                      {activeIndex + 1} / {section.slides.length}
                    </p>

                    {hasMultipleSlides ? (
                      <p className="ml-auto hidden text-xs font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
                        Auto sliding
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {section.slides.map((slide, index) => {
                      const isActive = index === activeIndex;

                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => setActive(section.id, index)}
                          className={[
                            "group overflow-hidden rounded-2xl border bg-slate-200 transition",
                            isActive
                              ? "border-luxury-gold ring-4 ring-luxury-gold-soft"
                              : "border-luxury-stone hover:border-luxury-gold",
                          ].join(" ")}
                          aria-label={`View ${slide.title}`}
                        >
                          <span className="relative block h-20">
                            <Image
                              src={slide.imageUrl}
                              alt={slide.imageAlt}
                              fill
                              sizes="120px"
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}