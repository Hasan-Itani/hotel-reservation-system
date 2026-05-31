import Link from "next/link";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicPaymentForm } from "@/components/public/PublicPaymentForm";
import { Card, CardContent } from "@/components/ui/Card";
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
      <div className="min-h-screen bg-background">
        <PublicHeader />

        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Card>
            <CardContent>
              <h1 className="text-xl font-bold text-foreground">
                Booking not found
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>

              <Link
                href="/bookings/lookup"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
              >
                Try booking lookup
              </Link>
            </CardContent>
          </Card>
        </main>

        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <PublicPaymentForm
          booking={booking}
          accessGuestEmail={guestEmail || undefined}
        />
      </main>

      <PublicFooter />
    </div>
  );
}