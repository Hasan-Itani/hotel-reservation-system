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

export default async function HotelsPage() {
  const hotels = await getPublicHotels();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main>
        <section className="border-b border-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <Badge variant="primary">Hotels</Badge>

            <div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  Browse available hotels and choose your next stay.
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  Compare hotels, explore room types, check prices, and continue
                  to availability and booking.
                </p>
              </div>

              <Link
                href="/bookings/lookup"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-bold text-foreground transition hover:bg-surface-muted"
              >
                Find My Booking
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {hotels.map((hotel) => (
                <Link
                  key={hotel.id}
                  href={`/hotels/${hotel.slug}`}
                  className="group overflow-hidden rounded-card border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                >
                  <div className="flex h-56 items-center justify-center bg-slate-200">
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
                          Add room images later
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-foreground group-hover:text-primary">
                          {hotel.name}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {hotel.city}, {hotel.country}
                        </p>
                      </div>

                      {hotel.starRating ? (
                        <Badge variant="warning">{hotel.starRating} stars</Badge>
                      ) : null}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {hotel.description ||
                        "Comfortable rooms and guest services for your stay."}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-surface-muted px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Starting from
                        </p>
                        <p className="mt-1 font-bold text-foreground">
                          {formatPrice(hotel.startingPrice, hotel.currency)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-surface-muted px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Room types
                        </p>
                        <p className="mt-1 font-bold text-foreground">
                          {hotel.roomTypeCount}
                        </p>
                      </div>
                    </div>

                    <p className="mt-5 text-sm font-bold text-primary">
                      View hotel details
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}