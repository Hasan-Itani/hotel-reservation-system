import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import type { PublicHotelsResponse } from "@/lib/frontend/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hotels",
  description:
    "Browse available hotels, compare stays, view rooms, and check live availability.",
};

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

export default async function HotelsPage() {
  const hotels = await getPublicHotels();

  return (
    <div className="min-h-screen bg-luxury-cream">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-luxury-stone bg-luxury-navy">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(184,138,68,0.28),transparent_28%),linear-gradient(135deg,#07111f_0%,#0b1220_50%,#13223a_100%)]" />

          <div className="luxury-container relative py-16 sm:py-20">
            <div className="max-w-4xl">
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold-soft">
                Hotels
              </div>

              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Choose your next stay from curated hotels.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-white/70">
                Browse available hotels, compare starting prices, explore room
                options, and continue to live availability before booking.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#hotel-list"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-luxury-navy shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:bg-luxury-gold-soft"
                >
                  View hotels
                </Link>

                <Link
                  href="/bookings/lookup"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Find my booking
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-white backdrop-blur">
                <p className="text-3xl font-bold">{hotels.length}</p>
                <p className="mt-1 text-sm text-white/60">available hotels</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-white backdrop-blur">
                <p className="text-3xl font-bold">
                  {hotels.reduce((sum, hotel) => sum + hotel.roomTypeCount, 0)}
                </p>
                <p className="mt-1 text-sm text-white/60">room categories</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-white backdrop-blur">
                <p className="text-3xl font-bold">Live</p>
                <p className="mt-1 text-sm text-white/60">availability checks</p>
              </div>
            </div>
          </div>
        </section>

        <section id="hotel-list" className="luxury-container py-14">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold">
                Browse stays
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-luxury-ink sm:text-4xl">
                Available hotels
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Select a hotel to view details, policies, rooms, and real-time
                availability.
              </p>
            </div>

            <Badge variant="luxury">
              {hotels.length} hotel{hotels.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="mt-8">
            {hotels.length === 0 ? (
              <Card>
                <CardContent>
                  <p className="text-sm font-semibold text-foreground">
                    No hotels available.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add active hotels and room types from the admin panel first.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
                {hotels.map((hotel, index) => (
                  <Link
                    key={hotel.id}
                    href={`/hotels/${hotel.slug}`}
                    className="group overflow-hidden rounded-[1.75rem] border border-luxury-stone bg-white shadow-sm transition hover:-translate-y-1 hover:border-luxury-gold hover:shadow-xl"
                  >
                    <div className="relative h-64 bg-slate-200">
                      {hotel.primaryImage ? (
                        <Image
                          src={hotel.primaryImage.url}
                          alt={hotel.primaryImage.altText || hotel.name}
                          fill
                          priority={index === 0}
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 420px"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 px-6 text-center">
                          <div>
                            <p className="text-sm font-bold text-slate-600">
                              Hotel image
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Add room images later
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        {hotel.starRating ? (
                          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-luxury-ink shadow-sm">
                            {hotel.starRating} stars
                          </span>
                        ) : null}

                        <span className="rounded-full bg-luxury-navy/90 px-3 py-1 text-xs font-bold text-white shadow-sm">
                          {hotel.roomTypeCount} room type
                          {hotel.roomTypeCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-luxury-gold-soft">
                          {hotel.city}, {hotel.country}
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-white">
                          {hotel.name}
                        </h3>
                      </div>
                    </div>

                    <div className="p-6">
                      <p className="min-h-12 text-sm leading-6 text-slate-600">
                        {hotel.description ||
                          "Comfortable rooms and guest services for your stay."}
                      </p>

                      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-luxury-cream px-4 py-4">
                          <p className="text-xs text-slate-500">
                            Starting from
                          </p>
                          <p className="mt-1 font-bold text-luxury-ink">
                            {formatPrice(hotel.startingPrice, hotel.currency)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-luxury-cream px-4 py-4">
                          <p className="text-xs text-slate-500">Check-in</p>
                          <p className="mt-1 font-bold text-luxury-ink">
                            {hotel.checkInTime || "Flexible"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-luxury-stone pt-5">
                        <span className="text-sm font-bold text-luxury-gold">
                          View hotel details
                        </span>

                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-luxury-navy text-sm font-bold text-white transition group-hover:bg-luxury-gold">
                          →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white">
          <div className="luxury-container grid gap-5 py-14 md:grid-cols-3">
            {[
              {
                title: "Compare hotels",
                text: "Review locations, star ratings, room categories, and starting prices.",
              },
              {
                title: "Check availability",
                text: "Search dates and guest counts before continuing to booking.",
              },
              {
                title: "Manage reservations",
                text: "Use your guest account or public lookup to view and pay bookings.",
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
