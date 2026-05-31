import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { HotelSubnav } from "@/components/public/HotelSubnav";
import { Badge } from "@/components/ui/Badge";
import type { PublicHotelDetailResponse } from "@/lib/frontend/types";

type HotelAmenitiesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const amenities = [
  {
    title: "Wellness and spa",
    eyebrow: "Relaxation",
    description:
      "A calm wellness-inspired experience for guests who want quiet, comfort, and restoration during their stay.",
    imageUrl:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Luxury spa and wellness room",
  },
  {
    title: "Pool and leisure",
    eyebrow: "Leisure",
    description:
      "Relax around bright leisure spaces designed for slower mornings, afternoon breaks, and easy hotel days.",
    imageUrl:
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Luxury hotel pool",
  },
  {
    title: "Guest lounge",
    eyebrow: "Comfort",
    description:
      "Comfortable public spaces for waiting, meeting, reading, and relaxing between plans.",
    imageUrl:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Elegant hotel lounge",
  },
  {
    title: "Fitness space",
    eyebrow: "Fitness",
    description:
      "A convenient fitness experience for guests who want to keep their routine while travelling.",
    imageUrl:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Hotel fitness gym",
  },
];

const serviceCards = [
  {
    title: "Live room availability",
    text: "Guests can search dates and room capacity before booking.",
  },
  {
    title: "Guest account access",
    text: "Reservations and payments stay connected to the signed-in guest.",
  },
  {
    title: "Payment management",
    text: "Guests can check remaining balance and continue payment later.",
  },
  {
    title: "Hotel support details",
    text: "Contact and hotel information remain visible across the public flow.",
  },
];

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

export default async function HotelAmenitiesPage({
  params,
}: HotelAmenitiesPageProps) {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />
      <HotelSubnav hotelSlug={hotel.slug} active="amenities" />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-luxury-stone bg-luxury-navy">
          <div className="absolute inset-0">
            <Image
              src={amenities[0].imageUrl}
              alt={amenities[0].imageAlt}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-45"
            />
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,17,31,0.94)_0%,rgba(7,17,31,0.72)_45%,rgba(7,17,31,0.42)_100%)]" />

          <div className="luxury-container relative py-20 lg:py-28">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/hotels/${hotel.slug}`}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white/80 shadow-sm transition hover:bg-white/20 hover:text-white"
              >
                {hotel.name}
              </Link>

              <Badge variant="warning">{hotel.city}</Badge>

              {hotel.starRating ? (
                <Badge variant="warning">{hotel.starRating} stars</Badge>
              ) : null}
            </div>

            <p className="mt-10 text-xs font-bold uppercase tracking-[0.35em] text-luxury-gold-soft">
              Services and amenities
            </p>

            <h1 className="mt-5 max-w-5xl text-5xl font-black uppercase tracking-[0.1em] text-white sm:text-6xl lg:text-7xl">
              Comfort beyond the room.
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-white/75">
              Present wellness, leisure, guest services, and hotel facilities in
              a premium public experience.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/hotels/${hotel.slug}#availability`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-luxury-navy shadow-sm transition hover:bg-luxury-gold-soft"
              >
                Check availability
              </Link>

              <Link
                href={`/hotels/${hotel.slug}/gallery`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-white/20"
              >
                View gallery
              </Link>
            </div>
          </div>
        </section>

        <section className="luxury-container py-12 lg:py-16">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Hotel facilities
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                Amenities designed for a complete stay.
              </h2>
            </div>

            <p className="max-w-3xl text-sm leading-7 text-slate-600 lg:ml-auto">
              This page uses static public content for now. Later we can make
              services and amenities editable from the admin panel.
            </p>
          </div>

          <div className="mt-10 grid gap-8">
            {amenities.map((amenity, index) => (
              <article
                key={amenity.title}
                className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5"
              >
                <div
                  className={[
                    "grid lg:grid-cols-2",
                    index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : "",
                  ].join(" ")}
                >
                  <div className="relative h-80 bg-slate-200 lg:h-full">
                    <Image
                      src={amenity.imageUrl}
                      alt={amenity.imageAlt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 640px"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                      {amenity.eyebrow}
                    </p>

                    <h3 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                      {amenity.title}
                    </h3>

                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      {amenity.description}
                    </p>

                    <div className="mt-7 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Type
                        </p>
                        <p className="mt-2 text-sm font-black text-luxury-ink">
                          Guest service
                        </p>
                      </div>

                      <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Access
                        </p>
                        <p className="mt-2 text-sm font-black text-luxury-ink">
                          Ask the hotel
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white">
          <div className="luxury-container py-12 lg:py-16">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Platform services
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                Built into the reservation system.
              </h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {serviceCards.map((service) => (
                <div
                  key={service.title}
                  className="rounded-[1.5rem] border border-luxury-stone bg-luxury-cream p-6"
                >
                  <p className="text-lg font-black text-luxury-ink">
                    {service.title}
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {service.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-luxury-navy">
          <div className="luxury-container flex flex-col justify-between gap-6 py-12 text-white sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold-soft">
                Ready to stay?
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight">
                Check room availability for {hotel.name}.
              </h2>
            </div>

            <Link
              href={`/hotels/${hotel.slug}#availability`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-luxury-navy shadow-sm transition hover:bg-luxury-gold-soft"
            >
              Search dates
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}