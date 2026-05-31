import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import type { PublicHotelsResponse } from "@/lib/frontend/types";

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host");

  if (!host) {
    throw new Error("Unable to resolve host");
  }

  const protocol =
    headerStore.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
}

async function getPublicHotels() {
  const baseUrl = await getBaseUrl();

  const response = await fetch(`${baseUrl}/api/public/hotels`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as PublicHotelsResponse;
  return data.hotels;
}

function formatPrice(price: number | null, currency: string) {
  if (price === null) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(price);
}

export default async function HomePage() {
  const hotels = await getPublicHotels();
  const featuredHotels = hotels.slice(0, 3);
  const heroHotel = featuredHotels[0] || null;

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-luxury-navy">
          <div className="relative h-[72vh] min-h-[520px] max-h-[820px]">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            >
              <source src="/videos/hotel-hero.webm" type="video/webm" />
            </video>

            <div className="absolute inset-0 bg-black/15" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-luxury-navy to-transparent" />
          </div>
        </section>

        <section className="bg-luxury-navy text-white">
          <div className="luxury-container grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold-soft backdrop-blur">
                Luxury booking platform
              </div>

              <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                Premium hotel stays, designed around a cleaner booking experience.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                Explore hotels, compare rooms, check live availability, reserve your
                stay, and manage payments from one polished guest account.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/hotels"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-luxury-navy shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:bg-luxury-gold-soft"
                >
                  Explore hotels
                </Link>

                <Link
                  href="/bookings/lookup"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Find my booking
                </Link>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["Live", "availability"],
                  ["Secure", "guest accounts"],
                  ["Clear", "payments"],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
                  >
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="mt-1 text-xs text-white/60">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
                <div className="overflow-hidden rounded-[1.75rem] bg-white">
                  <div className="relative h-[430px] bg-slate-200">
                    {heroHotel?.primaryImage ? (
                      <Image
                        src={heroHotel.primaryImage.url}
                        alt={heroHotel.primaryImage.altText || heroHotel.name}
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 560px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                        <div className="px-6 text-center">
                          <p className="text-sm font-bold text-slate-700">
                            Hotel image
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Add public hotel media from the admin panel.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold">
                      Featured stay
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-luxury-ink">
                      {heroHotel?.name || "Grand hotel experience"}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {heroHotel?.description ||
                        "Comfortable rooms, clear pricing, and a fast reservation flow."}
                    </p>

                    <Link
                      href={heroHotel ? `/hotels/${heroHotel.slug}` : "/hotels"}
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-luxury-navy px-5 text-sm font-bold text-white transition hover:bg-luxury-ink"
                    >
                      View hotel
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="luxury-container grid gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Designed for guests
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                From discovery to payment, every step is simple.
              </h2>
            </div>

            <p className="max-w-3xl text-sm leading-7 text-slate-600 lg:ml-auto">
              The public experience is built around real hotel flows: browsing,
              room selection, live availability, reservation creation, booking
              lookup, and guest payments.
            </p>
          </div>
        </section>

        <section className="luxury-container py-16">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Curated stays
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                Featured hotels
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Choose from available hotels and continue to live room
                availability.
              </p>
            </div>

            <Link
              href="/hotels"
              className="inline-flex h-11 items-center justify-center rounded-full border border-luxury-stone bg-white px-5 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-gold-soft"
            >
              View all hotels
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredHotels.length === 0 ? (
              <div className="rounded-[2rem] border border-luxury-stone bg-white p-8 shadow-sm md:col-span-2 xl:col-span-3">
                <p className="text-sm font-black text-luxury-ink">
                  No public hotels available yet.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Add hotels and room types from the admin panel first.
                </p>
              </div>
            ) : (
              featuredHotels.map((hotel) => (
                <Link
                  key={hotel.id}
                  href={`/hotels/${hotel.slug}`}
                  className="group overflow-hidden rounded-[1.75rem] border border-luxury-stone bg-white shadow-sm transition hover:-translate-y-1 hover:border-luxury-gold hover:shadow-xl"
                >
                  <div className="relative h-56 bg-slate-200">
                    {hotel.primaryImage ? (
                      <Image
                        src={hotel.primaryImage.url}
                        alt={hotel.primaryImage.altText || hotel.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 420px"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 px-6 text-center">
                        <div>
                          <p className="text-sm font-bold text-slate-600">
                            Hotel image
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Add public images later
                          </p>
                        </div>
                      </div>
                    )}

                    {hotel.starRating ? (
                      <div className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-luxury-ink shadow-sm">
                        {hotel.starRating} stars
                      </div>
                    ) : null}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-black text-luxury-ink transition group-hover:text-luxury-gold">
                      {hotel.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {hotel.city}, {hotel.country}
                    </p>

                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                      {hotel.description ||
                        "Comfortable rooms and modern hotel services."}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-3 border-t border-luxury-stone pt-5">
                      <div>
                        <p className="text-xs text-slate-500">Starting from</p>
                        <p className="text-lg font-black text-luxury-ink">
                          {formatPrice(hotel.startingPrice, hotel.currency)}
                        </p>
                      </div>

                      <span className="text-sm font-black text-luxury-gold">
                        View stay
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="bg-white">
          <div className="luxury-container py-16">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-luxury-cream p-4 shadow-xl shadow-slate-900/5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    "Rooms and suites",
                    "Dining experiences",
                    "Amenities and services",
                    "Photos and moments",
                  ].map((item) => (
                    <div
                      key={item}
                      className="min-h-40 rounded-[1.5rem] border border-luxury-stone bg-white p-5"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold">
                        Explore
                      </p>
                      <p className="mt-3 text-lg font-black text-luxury-ink">
                        {item}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Hotel-specific pages will expand this section with more
                        detailed content.
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  More than booking
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                  Build toward a complete hotel website experience.
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The next layer is hotel marketing: rooms, gallery, dining,
                  amenities, location, and contact pages for each hotel. The
                  booking system stays connected to live availability and
                  payments.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/hotels"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                  >
                    Browse hotels
                  </Link>

                  <Link
                    href="/bookings/lookup"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                  >
                    Find reservation
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="luxury-container py-16">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Live availability",
                text: "Search by date and guest count before choosing your room.",
              },
              {
                title: "Clear booking flow",
                text: "Review room details, guest information, and pricing before confirming.",
              },
              {
                title: "Guest account",
                text: "Manage reservations, profile details, and payments from your account.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-luxury-stone bg-white p-6 shadow-sm"
              >
                <p className="text-lg font-black text-luxury-ink">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}