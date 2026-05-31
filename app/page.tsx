import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
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

  return (
    <div className="min-h-screen bg-luxury-cream">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden bg-luxury-navy">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(184,138,68,0.35),transparent_30%),linear-gradient(135deg,#07111f_0%,#0b1220_45%,#13223a_100%)]" />
          <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-luxury-gold/10 blur-3xl" />

          <div className="luxury-container relative grid min-h-[680px] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold-soft backdrop-blur">
                Luxury booking platform
              </div>

              <h1 className="mt-7 max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Book premium stays with clarity, speed, and confidence.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                Discover hotels, compare rooms, check live availability, reserve
                your stay, and manage payments through a clean guest experience.
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

              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                {[
                  ["Live", "availability"],
                  ["Secure", "guest accounts"],
                  ["Clear", "payments"],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur"
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
                  <div className="relative h-[420px] bg-slate-200">
                    {featuredHotels[0]?.primaryImage ? (
                      <Image
                        src={featuredHotels[0].primaryImage.url}
                        alt={
                          featuredHotels[0].primaryImage.altText ||
                          featuredHotels[0].name
                        }
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 560px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-700">
                            Hotel image
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Add public hotel media later
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold">
                      Featured stay
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-luxury-ink">
                      {featuredHotels[0]?.name || "Grand hotel experience"}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {featuredHotels[0]?.description ||
                        "Comfortable rooms, clear pricing, and fast reservation flow."}
                    </p>

                    <Link
                      href={
                        featuredHotels[0]
                          ? `/hotels/${featuredHotels[0].slug}`
                          : "/hotels"
                      }
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

        <section className="luxury-container py-16">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold">
                Curated stays
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-luxury-ink sm:text-4xl">
                Featured hotels
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
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
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent>
                  <p className="text-sm font-semibold text-foreground">
                    No public hotels available yet.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add hotels and room types from the admin panel first.
                  </p>
                </CardContent>
              </Card>
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
                            Add room type images later
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
                    <h3 className="text-xl font-bold text-luxury-ink group-hover:text-luxury-gold">
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
                        <p className="text-lg font-bold text-luxury-ink">
                          {formatPrice(hotel.startingPrice, hotel.currency)}
                        </p>
                      </div>

                      <span className="text-sm font-bold text-luxury-gold">
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
          <div className="luxury-container grid gap-5 py-16 md:grid-cols-3">
            {[
              {
                title: "Live availability",
                text: "Search by date and guest count before choosing your room.",
              },
              {
                title: "Clear booking flow",
                text: "See room details, pricing, guest information, and totals before confirming.",
              },
              {
                title: "Guest account",
                text: "Manage reservations, profile details, and payments from your account.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-luxury-stone bg-luxury-cream p-6"
              >
                <p className="text-lg font-bold text-luxury-ink">
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