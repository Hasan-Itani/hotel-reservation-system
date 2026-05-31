import Link from "next/link";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicPaymentForm } from "@/components/public/PublicPaymentForm";
import type {
  PublicBookingDetails,
  PublicBookingDetailsResponse,
} from "@/lib/frontend/types";

type PublicPayPageProps = {
  params: Promise<{
    reservationNumber: string;
  }>;
  searchParams?: Promise<{
    guestEmail?: string;
  }>;
};

async function getServerRequestContext() {
  const headerStore = await headers();
  const host = headerStore.get("host");

  if (!host) {
    throw new Error("Unable to resolve host");
  }

  const protocol =
    headerStore.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return {
    baseUrl: `${protocol}://${host}`,
    cookie: headerStore.get("cookie") || "",
  };
}

async function getBooking(input: {
  reservationNumber: string;
  guestEmail?: string;
}): Promise<{
  booking: PublicBookingDetails | null;
  error: string;
}> {
  const { baseUrl, cookie } = await getServerRequestContext();

  const query = input.guestEmail
    ? `?guestEmail=${encodeURIComponent(input.guestEmail)}`
    : "";

  const response = await fetch(
    `${baseUrl}/api/public/bookings/${input.reservationNumber}${query}`,
    {
      cache: "no-store",
      headers: cookie
        ? {
            cookie,
          }
        : undefined,
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      booking: null,
      error: data?.error || "Unable to load booking",
    };
  }

  return {
    booking: (data as PublicBookingDetailsResponse).booking,
    error: "",
  };
}

export default async function PublicPayPage({
  params,
  searchParams,
}: PublicPayPageProps) {
  const { reservationNumber } = await params;
  const query = await searchParams;
  const guestEmail = query?.guestEmail || "";

  const { booking, error } = await getBooking({
    reservationNumber,
    guestEmail,
  });

  if (!booking) {
    return (
      <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
        <PublicHeader />

        <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
            <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Payment lookup
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                Booking not found.
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                {error}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <Link
                href="/bookings/lookup"
                className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
              >
                Try booking lookup
              </Link>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex-1">
        <section className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_38%,#ffffff_100%)]">
          <div className="luxury-container py-10 lg:py-14">
            <Link
              href={`/bookings/${booking.reservationNumber}${
                guestEmail ? `?guestEmail=${encodeURIComponent(guestEmail)}` : ""
              }`}
              className="inline-flex rounded-full border border-luxury-stone bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-luxury-gold hover:text-luxury-ink"
            >
              Back to booking details
            </Link>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Secure payment
            </p>

            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl">
              Complete your payment.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Pay the remaining balance for reservation{" "}
              <span className="font-bold text-luxury-ink">
                {booking.reservationNumber}
              </span>
              .
            </p>
          </div>
        </section>

        <section className="luxury-container py-10 lg:py-12">
          <PublicPaymentForm
            booking={booking}
            accessGuestEmail={guestEmail || undefined}
          />
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}