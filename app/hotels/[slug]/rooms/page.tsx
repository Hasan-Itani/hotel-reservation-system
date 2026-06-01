import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { HotelSubnav } from "@/components/public/HotelSubnav";
import { Badge } from "@/components/ui/Badge";
import type {
  PublicHotelDetailResponse,
  PublicRoomType,
  PublicRoomTypesResponse,
} from "@/lib/frontend/types";
import type { Metadata } from "next";
import { buildHotelMetadata } from "@/lib/frontend/public-metadata";

type HotelRoomsPageProps = {
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
}: HotelRoomsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  return buildHotelMetadata({
    hotel,
    pageTitle: "Rooms and Suites",
    description: `View rooms and suites at ${hotel.name}, including capacity, beds, room details, prices, and availability.`,
    path: `/hotels/${hotel.slug}/rooms`,
  });
}

async function getRoomTypes(slug: string) {
  const baseUrl = await getBaseUrl();

  const response = await fetch(
    `${baseUrl}/api/public/hotels/${slug}/room-types`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as PublicRoomTypesResponse;
  return data.roomTypes;
}

function getPrimaryRoomImage(roomType: PublicRoomType) {
  return (
    roomType.images.find((image) => image.isPrimary) ||
    roomType.images[0] ||
    null
  );
}

function toNumber(value: PublicRoomType["basePrice"]) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(amount);
}

function getRoomSizeLabel(roomSizeSqm: PublicRoomType["roomSizeSqm"]) {
  if (!roomSizeSqm) {
    return "Size available on request";
  }

  return `${roomSizeSqm} sqm`;
}

export default async function HotelRoomsPage({ params }: HotelRoomsPageProps) {
  const { slug } = await params;

  const [hotel, roomTypes] = await Promise.all([
    getHotel(slug),
    getRoomTypes(slug),
  ]);

  const publicRoomTypes = roomTypes.filter((roomType) => roomType.totalRooms > 0);

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />
      <HotelSubnav hotelSlug={hotel.slug} active="rooms" />

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
              Rooms and suites
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl lg:text-6xl">
                Choose the room that fits your stay.
              </h1>

              <p className="max-w-3xl text-sm leading-7 text-slate-600 lg:ml-auto">
                Explore room categories, capacity, amenities, and nightly
                pricing. When ready, return to live availability to select dates
                and continue booking.
              </p>
            </div>
          </div>
        </section>

        <section className="luxury-container py-10 lg:py-14">
          {publicRoomTypes.length === 0 ? (
            <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="p-6 sm:p-8">
                <p className="text-sm font-black text-luxury-ink">
                  No public room types are available yet.
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Add room types from the admin panel to show room options here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-8">
              {publicRoomTypes.map((roomType) => {
                const image = getPrimaryRoomImage(roomType);

                return (
                  <article
                    key={roomType.id}
                    className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5"
                  >
                    <div className="grid lg:grid-cols-[420px_1fr]">
                      <div className="relative h-80 bg-slate-200 lg:h-full">
                        {image ? (
                          <Image
                            src={image.url}
                            alt={image.altText || roomType.name}
                            fill
                            sizes="(max-width: 1024px) 100vw, 420px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 px-6 text-center">
                            <div>
                              <p className="text-sm font-black text-slate-600">
                                Room image
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Add images from the admin panel.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="absolute left-4 top-4">
                          <Badge variant="success">
                            {roomType.totalRooms} room
                            {roomType.totalRooms === 1 ? "" : "s"}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-col p-6 sm:p-8">
                        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                              Room category
                            </p>

                            <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                              {roomType.name}
                            </h2>

                            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                              {roomType.description ||
                                "Comfortable room category for a clear and easy stay."}
                            </p>
                          </div>

                          <div className="shrink-0 rounded-3xl bg-luxury-cream px-5 py-4 xl:text-right">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                              From
                            </p>
                            <p className="mt-2 text-2xl font-black text-luxury-ink">
                              {formatCurrency(
                                toNumber(roomType.basePrice),
                                hotel.currency,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              per night
                            </p>
                          </div>
                        </div>

                        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-3xl border border-luxury-stone bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                              Guests
                            </p>
                            <p className="mt-2 text-sm font-black text-luxury-ink">
                              {roomType.capacityAdults} adult
                              {roomType.capacityAdults === 1 ? "" : "s"},{" "}
                              {roomType.capacityChildren} child
                              {roomType.capacityChildren === 1 ? "" : "ren"}
                            </p>
                          </div>

                          <div className="rounded-3xl border border-luxury-stone bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                              Bed
                            </p>
                            <p className="mt-2 text-sm font-black text-luxury-ink">
                              {roomType.bedType || "Bed type available on request"}
                            </p>
                          </div>

                          <div className="rounded-3xl border border-luxury-stone bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                              Size
                            </p>
                            <p className="mt-2 text-sm font-black text-luxury-ink">
                              {getRoomSizeLabel(roomType.roomSizeSqm)}
                            </p>
                          </div>

                          <div className="rounded-3xl border border-luxury-stone bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                              Inventory
                            </p>
                            <p className="mt-2 text-sm font-black text-luxury-ink">
                              {roomType.totalRooms} room
                              {roomType.totalRooms === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>

                        {roomType.amenities && roomType.amenities.length > 0 ? (
                          <div className="mt-6 flex flex-wrap gap-2">
                            {roomType.amenities.slice(0, 10).map((amenity) => (
                              <Badge key={amenity.id}>{amenity.name}</Badge>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-8 flex flex-col gap-3 border-t border-luxury-stone pt-6 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm leading-6 text-slate-600">
                            Search your dates to confirm live availability
                            before booking.
                          </p>

                          <Link
                            href={`/hotels/${hotel.slug}#availability`}
                            className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                          >
                            Check availability
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white">
          <div className="luxury-container grid gap-6 py-12 md:grid-cols-3">
            {[
              {
                title: "Live room search",
                text: "Use date and guest filters before continuing to booking.",
              },
              {
                title: "Clear capacity",
                text: "Review adults, children, beds, size, and amenities before choosing.",
              },
              {
                title: "Secure checkout",
                text: "Create the reservation from your guest account and continue to payment.",
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
