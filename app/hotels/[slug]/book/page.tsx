import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BookingForm } from "@/components/public/BookingForm";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import type {
  PublicHotelDetailResponse,
  PublicRoomTypesResponse,
} from "@/lib/frontend/types";

type BookingPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    roomTypeId?: string;
    checkInDate?: string;
    checkOutDate?: string;
    adults?: string;
    children?: string;
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

export default async function BookingPage({
  params,
  searchParams,
}: BookingPageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const queryString = new URLSearchParams(
    Object.entries(query || {}).reduce<Record<string, string>>(
      (result, [key, value]) => {
        if (typeof value === "string") {
          result[key] = value;
        }

        return result;
      },
      {},
    ),
  ).toString();

  const nextPath = queryString
    ? `/hotels/${slug}/book?${queryString}`
    : `/hotels/${slug}/book`;

  const user = await getServerAuthUser();

  if (!user) {
    redirect(`/guest/login?next=${encodeURIComponent(nextPath)}`);
  }

  const [hotel, roomTypes] = await Promise.all([
    getHotel(slug),
    getRoomTypes(slug),
  ]);

  const roomTypeId = query?.roomTypeId || "";
  const checkInDate = query?.checkInDate || "";
  const checkOutDate = query?.checkOutDate || "";
  const adults = query?.adults || "2";
  const children = query?.children || "0";

  const roomType =
    roomTypes.find((item) => item.id === roomTypeId && item.totalRooms > 0) ||
    null;

  if (!roomType || !checkInDate || !checkOutDate || !adults || !children) {
    return (
      <div className="min-h-screen bg-luxury-cream text-luxury-ink">
        <PublicHeader />

        <main className="luxury-container py-10 lg:py-16">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
            <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Booking selection
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                Booking selection missing.
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                Go back to the hotel page, search availability, and choose an
                available room type before booking.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                <p className="text-sm font-bold text-luxury-ink">
                  {hotel.name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Availability must be checked before opening the booking form.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/hotels/${hotel.slug}#availability`}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                >
                  Search availability
                </Link>

                <Link
                  href={`/hotels/${hotel.slug}`}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                >
                  Back to hotel
                </Link>
              </div>
            </div>
          </div>
        </main>

        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="luxury-container py-10 lg:py-16">
        <div className="mb-8">
          <Link
            href={`/hotels/${hotel.slug}#availability`}
            className="inline-flex rounded-full border border-luxury-stone bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-luxury-gold hover:text-luxury-ink"
          >
            Back to availability
          </Link>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
            Complete booking
          </p>

          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl">
            Secure your stay at {hotel.name}.
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Review your selected room, confirm guest details, and create your
            reservation.
          </p>
        </div>

        <BookingForm
          user={user}
          hotelSlug={hotel.slug}
          hotelName={hotel.name}
          currency={hotel.currency}
          roomType={roomType}
          initialCheckInDate={checkInDate}
          initialCheckOutDate={checkOutDate}
          initialAdults={adults}
          initialChildren={children}
        />
      </main>

      <PublicFooter />
    </div>
  );
}