import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { HotelSubnav } from "@/components/public/HotelSubnav";
import { Badge } from "@/components/ui/Badge";
import type { PublicHotelDetailResponse } from "@/lib/frontend/types";
import { HotelContactForm } from "@/components/public/HotelContactForm";
import type { Metadata } from "next";
import { buildHotelMetadata } from "@/lib/frontend/public-metadata";

type HotelContactPageProps = {
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
}: HotelContactPageProps): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  return buildHotelMetadata({
    hotel,
    pageTitle: "Contact",
    description: `Contact ${hotel.name} for booking questions, reservation support, directions, and hotel inquiries.`,
    path: `/hotels/${hotel.slug}/contact`,
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

function getMailToUrl(input: {
  email?: string | null;
  hotelName: string;
}) {
  if (!input.email) {
    return "";
  }

  const subject = encodeURIComponent(`Inquiry for ${input.hotelName}`);
  return `mailto:${input.email}?subject=${subject}`;
}

function getTelUrl(phone?: string | null) {
  if (!phone) {
    return "";
  }

  return `tel:${phone.replaceAll(" ", "")}`;
}

export default async function HotelContactPage({
  params,
}: HotelContactPageProps) {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  const fullAddress = getFullAddress({
    addressLine1: hotel.addressLine1,
    addressLine2: hotel.addressLine2,
    city: hotel.city,
    country: hotel.country,
  });

  const mapOpenUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    fullAddress,
  )}`;

  const mailToUrl = getMailToUrl({
    email: hotel.email,
    hotelName: hotel.name,
  });

  const telUrl = getTelUrl(hotel.phone);

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />
      <HotelSubnav hotelSlug={hotel.slug} active="contact" />

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

              <Badge variant="primary">{hotel.city}</Badge>

              {hotel.starRating ? (
                <Badge variant="warning">{hotel.starRating} stars</Badge>
              ) : null}
            </div>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Contact us
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl lg:text-6xl">
                Speak with {hotel.name}.
              </h1>

              <p className="max-w-3xl text-sm leading-7 text-slate-600 lg:ml-auto">
                Use the hotel contact details for booking questions, arrival
                information, payment support, or reservation changes.
              </p>
            </div>
          </div>
        </section>

        <section className="luxury-container py-10 lg:py-14">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <aside className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="border-b border-luxury-stone p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Hotel details
                </p>

                <h2 className="mt-3 text-2xl font-black tracking-tight text-luxury-ink">
                  {hotel.name}
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {hotel.description ||
                    "Contact the hotel team for support with your stay."}
                </p>
              </div>

              <div className="grid gap-4 p-6 sm:p-8">
                <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Address
                  </p>

                  <p className="mt-2 text-sm font-black leading-6 text-luxury-ink">
                    {fullAddress}
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
                  {hotel.phone ? (
                    <a
                      href={telUrl}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                    >
                      Call hotel
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-12 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 px-6 text-sm font-bold text-slate-400"
                    >
                      Call unavailable
                    </button>
                  )}

                  {hotel.email ? (
                    <a
                      href={mailToUrl}
                      className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                    >
                      Email hotel
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-12 cursor-not-allowed items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-slate-400"
                    >
                      Email unavailable
                    </button>
                  )}
                </div>
              </div>
            </aside>

            <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Guest support
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                  Need help with a booking?
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Guests can use booking lookup or their guest account to view
                  reservation details and payment status.
                </p>
              </div>

              <div className="grid gap-4 p-6 sm:p-8">
                <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Existing booking
                  </p>

                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Use your reservation number and email to view booking details,
                    payment status, and next steps.
                  </p>

                  <Link
                    href="/bookings/lookup"
                    className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                  >
                    Find booking
                  </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-luxury-stone bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      New reservation
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Search room availability and create a new booking.
                    </p>

                    <Link
                      href={`/hotels/${hotel.slug}#availability`}
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full border border-luxury-stone bg-white px-5 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                    >
                      Check rooms
                    </Link>
                  </div>

                  <div className="rounded-3xl border border-luxury-stone bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Directions
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Open the saved hotel address in Google Maps.
                    </p>

                    <a
                      href={mapOpenUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full border border-luxury-stone bg-white px-5 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                    >
                      Open maps
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="mt-8 overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
            <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Send a message
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                Contact the hotel
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Send a message to the hotel team. Your message will be saved in the
                admin panel as a hotel inquiry.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <HotelContactForm hotelSlug={hotel.slug} />
            </div>
          </section>
        </section>

        <section className="bg-white">
          <div className="luxury-container grid gap-6 py-12 md:grid-cols-3">
            {[
              {
                title: "Booking questions",
                text: "Use booking lookup to check reservation status and payment balance.",
              },
              {
                title: "Hotel contact",
                text: "Call or email the hotel using the saved public hotel details.",
              },
              {
                title: "Directions",
                text: "Open the saved address in maps before travelling.",
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