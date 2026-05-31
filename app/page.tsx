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
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border bg-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.45),_transparent_35%),linear-gradient(135deg,_#020617,_#0f172a_45%,_#1e3a8a)]" />

          <div className="relative mx-auto grid min-h-[520px] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div>
              <Badge variant="primary">Hotel booking platform</Badge>

              <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Find the right hotel stay with fast booking and clear prices.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Browse hotels, compare room types, check availability, and reserve
                your stay through a clean guest booking experience.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/hotels"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
                >
                  Browse Hotels
                </Link>

                <Link
                  href="/bookings/lookup"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Find My Booking
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="rounded-[1.5rem] bg-white p-5">
                <p className="text-sm font-bold text-foreground">
                  Search your stay
                </p>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Destination
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      Beirut, Byblos, Zahle
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Check-in
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        Select date
                      </p>
                    </div>

                    <div className="rounded-xl border border-border px-4 py-3">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Check-out
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        Select date
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/hotels"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-hover"
                  >
                    Start Searching
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Featured Hotels
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose from available hotels and continue to room selection.
              </p>
            </div>

            <Link
              href="/hotels"
              className="text-sm font-bold text-primary hover:text-primary-hover"
            >
              View all hotels
            </Link>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                  className="group overflow-hidden rounded-card border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                >
                  <div className="flex h-48 items-center justify-center bg-slate-200">
                    {hotel.primaryImage ? (
                      <img
                        src={hotel.primaryImage.url}
                        alt={hotel.primaryImage.altText || hotel.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="px-6 text-center">
                        <p className="text-sm font-bold text-slate-600">
                          Hotel Image
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Add room type images later
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary">
                          {hotel.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {hotel.city}, {hotel.country}
                        </p>
                      </div>

                      {hotel.starRating ? (
                        <Badge variant="warning">{hotel.starRating} stars</Badge>
                      ) : null}
                    </div>

                    <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
                      {hotel.description || "Comfortable rooms and hotel services."}
                    </p>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Starting from
                        </p>
                        <p className="text-base font-bold text-foreground">
                          {formatPrice(hotel.startingPrice, hotel.currency)}
                        </p>
                      </div>

                      <span className="text-sm font-bold text-primary">
                        View hotel
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
            {[
              {
                title: "Search availability",
                text: "Find available rooms by date, guest count, and hotel.",
              },
              {
                title: "Book with clear pricing",
                text: "See room prices, guest capacity, taxes, and total before confirming.",
              },
              {
                title: "Manage your stay",
                text: "Guests can later lookup reservations and complete payments.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-card border border-border bg-surface p-5 shadow-sm"
              >
                <h3 className="text-base font-bold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
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