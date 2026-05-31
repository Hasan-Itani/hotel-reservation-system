"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type HotelSubnavItem =
  | "overview"
  | "rooms"
  | "gallery"
  | "dining"
  | "amenities"
  | "location"
  | "contact";

type HotelSubnavProps = {
  hotelSlug: string;
  active: HotelSubnavItem;
};

const navItems: Array<{
  key: HotelSubnavItem;
  label: string;
  hrefSuffix: string;
}> = [
  {
    key: "overview",
    label: "Overview",
    hrefSuffix: "",
  },
  {
    key: "rooms",
    label: "Rooms",
    hrefSuffix: "/rooms",
  },
  {
    key: "gallery",
    label: "Gallery",
    hrefSuffix: "/gallery",
  },
  {
    key: "dining",
    label: "Dining",
    hrefSuffix: "/dining",
  },
  {
    key: "amenities",
    label: "Amenities",
    hrefSuffix: "/amenities",
  },
  {
    key: "location",
    label: "Location",
    hrefSuffix: "/location",
  },
  {
    key: "contact",
    label: "Contact",
    hrefSuffix: "/contact",
  },
];

export function HotelSubnav({ hotelSlug, active }: HotelSubnavProps) {
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [active]);

  return (
    <div className="sticky top-20 z-30 border-b border-luxury-stone bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="luxury-container">
        <div className="relative">
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-white to-transparent sm:hidden" />
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-white to-transparent sm:hidden" />

          <div className="flex items-center gap-3 overflow-x-auto scroll-smooth py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav className="flex min-w-max items-center gap-2 px-1">
              {navItems.map((item) => {
                const isActive = item.key === active;
                const href = `/hotels/${hotelSlug}${item.hrefSuffix}`;

                return (
                  <Link
                    key={item.key}
                    ref={isActive ? activeItemRef : undefined}
                    href={href}
                    className={[
                      "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-bold transition",
                      isActive
                        ? "bg-luxury-navy text-white shadow-sm"
                        : "text-slate-600 hover:bg-luxury-cream hover:text-luxury-ink",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto hidden shrink-0 sm:block">
              <Link
                href={`/hotels/${hotelSlug}#availability`}
                className="inline-flex h-10 items-center justify-center rounded-full bg-luxury-gold px-5 text-sm font-black text-white shadow-sm transition hover:bg-luxury-navy"
              >
                Book now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}