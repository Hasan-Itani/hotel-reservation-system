import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { HotelSubnav } from "@/components/public/HotelSubnav";
import { Badge } from "@/components/ui/Badge";
import type { PublicHotelDetailResponse } from "@/lib/frontend/types";
import type { Metadata } from "next";
import { buildHotelMetadata } from "@/lib/frontend/public-metadata";

type HotelLocationPageProps = {
  params: Promise<{
    slug: string;
  }>;
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

async function getHotel(slug: string) {
  const baseUrl = await getBaseUrl();

  const response = await fetch(`${baseUrl}/api/public/hotels/${slug}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error("Unable to load hotel");
  }

  const data = (await response.json()) as PublicHotelDetailResponse;
  return data.hotel;
}

export async function generateMetadata({
  params,
}: HotelLocationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  return buildHotelMetadata({
    hotel,
    pageTitle: "Location",
    description: `Find ${hotel.name} in ${hotel.city}, ${hotel.country}. View address, map, and contact details.`,
    path: `/hotels/${hotel.slug}/location`,
  });
}

function getFullAddress(input: {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  country: string;
}) {
  return [
    input.addressLine1,
    input.addressLine2,
    input.city,
    input.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export default async function HotelLocationPage({
  params,
}: HotelLocationPageProps) {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  const fullAddress = getFullAddress({
    addressLine1: hotel.addressLine1,
    addressLine2: hotel.addressLine2,
    city: hotel.city,
    country: hotel.country,
  });

  const encodedAddress = encodeURIComponent(fullAddress);
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
  const mapOpenUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />
      <HotelSubnav hotelSlug={hotel.slug} active="location" />

      <main className="flex-1">
        <section className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_38%,#ffffff_100%)]">
          <div className="luxury-container py-10 lg:py-16">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/hotels/${hotel.slug}`}
                className="rounded-full border border-luxury-stone bg-white/80 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm transition hover:border-luxury-gold hover:text-luxury-ink"
              >
                {hotel.name}
              </Link>

              <Badge variant="luxury">{hotel.city}</Badge>

              {hotel.starRating ? (
                <Badge variant="warning">{hotel.starRating} stars</Badge>
              ) : null}
            </div>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Location
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl lg:text-6xl">
                Find your way to {hotel.name}.
              </h1>

              <p className="max-w-3xl text-sm leading-7 text-slate-600 lg:ml-auto">
                View the hotel address, contact details, and map location. This
                map uses the saved hotel address. For an exact pin, add latitude
                and longitude fields later.
              </p>
            </div>
          </div>
        </section>

        <section className="luxury-container py-10 lg:py-14">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <aside className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="border-b border-luxury-stone p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Address
                </p>

                <h2 className="mt-3 text-2xl font-black tracking-tight text-luxury-ink">
                  {hotel.city}, {hotel.country}
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {fullAddress}
                </p>
              </div>

              <div className="grid gap-4 p-6 sm:p-8">
                <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Hotel
                  </p>
                  <p className="mt-2 text-sm font-black text-luxury-ink">
                    {hotel.name}
                  </p>
                </div>

                <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Phone
                  </p>
                  <p className="mt-2 break-all text-sm font-black text-luxury-ink">
                    {hotel.phone || "Phone not available"}
                  </p>
                </div>

                <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Email
                  </p>
                  <p className="mt-2 break-all text-sm font-black text-luxury-ink">
                    {hotel.email || "Email not available"}
                  </p>
                </div>

                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <a
                    href={mapOpenUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                  >
                    Open in Maps
                  </a>

                  <Link
                    href={`/hotels/${hotel.slug}#availability`}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                  >
                    Check rooms
                  </Link>
                </div>
              </div>
            </aside>

            <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="h-[520px] bg-slate-200">
                <iframe
                  title={`${hotel.name} location map`}
                  src={mapEmbedUrl}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  sandbox="allow-scripts allow-popups"
                  allowFullScreen
                />
              </div>
            </section>
          </div>
        </section>

        <section className="bg-white">
          <div className="luxury-container grid gap-6 py-12 md:grid-cols-3">
            {[
              {
                title: "Address-based map",
                text: "The map is generated from the saved hotel address.",
              },
              {
                title: "Exact pin later",
                text: "Add latitude and longitude to the Hotel model for exact map position.",
              },
              {
                title: "Multiple hotels",
                text: "Each hotel slug shows its own saved address and map page.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-luxury-stone bg-luxury-cream p-6"
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
