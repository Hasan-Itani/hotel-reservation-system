import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import { serverFetchJson } from "@/lib/frontend/api-server";
import { formatMoney } from "@/lib/frontend/format";
import type {
  GuestBookingsResponse,
  PublicBookingDetails,
  ReservationStatus,
} from "@/lib/frontend/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guest Reservations",
  description:
    "View hotel reservations linked to your guest account and continue payments.",
};

const publicDateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function formatDate(value: string) {
  return publicDateFormatter.format(new Date(value));
}

function formatStatus(status: ReservationStatus) {
  return status.replaceAll("_", " ");
}

function getStatusBadgeVariant(
  status: ReservationStatus,
): "success" | "warning" | "danger" | "primary" | "default" {
  if (status === "PENDING") return "warning";
  if (status === "CONFIRMED") return "primary";
  if (status === "CHECKED_IN") return "success";
  if (status === "CHECKED_OUT") return "default";
  if (status === "CANCELLED") return "danger";
  if (status === "NO_SHOW") return "danger";

  return "default";
}

function getPaidAmount(booking: PublicBookingDetails) {
  if (booking.paymentSummary) {
    return Number(booking.paymentSummary.paid);
  }

  return (
    booking.payments
      ?.filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0
  );
}

function getRemainingAmount(booking: PublicBookingDetails) {
  if (booking.paymentSummary) {
    return Number(booking.paymentSummary.remaining);
  }

  return Math.max(0, Number(booking.total) - getPaidAmount(booking));
}

export default async function GuestBookingsPage() {
  const user = await getServerAuthUser();

  if (!user) {
    redirect("/guest/login?next=/guest/bookings");
  }

  const data = await serverFetchJson<GuestBookingsResponse>(
    "/api/guest/bookings",
  );

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex-1">
        <section className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_38%,#ffffff_100%)]">
          <div className="luxury-container flex flex-col justify-between gap-6 py-10 sm:flex-row sm:items-end lg:py-14">
            <div>
              <Badge variant="success">Guest account</Badge>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl">
                My reservations
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                View bookings linked to your guest account, check balances, and
                continue payments.
              </p>
            </div>

            <Link
              href="/hotels"
              className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
            >
              Book another stay
            </Link>
          </div>
        </section>

        <section className="luxury-container py-10 lg:py-12">
          {data.bookings.length === 0 ? (
            <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="border-b border-luxury-stone p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Reservations
                </p>

                <h2 className="mt-3 text-2xl font-black tracking-tight text-luxury-ink">
                  No reservations yet.
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Reservations created before guest-login booking was enabled may
                  not appear here. You can still find them through booking
                  lookup.
                </p>
              </div>

              <div className="flex flex-col gap-3 p-6 sm:flex-row sm:p-8">
                <Link
                  href="/hotels"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                >
                  Browse hotels
                </Link>

                <Link
                  href="/bookings/lookup"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                >
                  Use booking lookup
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              {data.bookings.map((booking) => {
                const remaining = getRemainingAmount(booking);
                const canPay =
                  remaining > 0 &&
                  ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(
                    booking.status,
                  );

                return (
                  <article
                    key={booking.reservationNumber}
                    className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5"
                  >
                    <div className="border-b border-luxury-stone p-6 sm:p-8">
                      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={getStatusBadgeVariant(booking.status)}
                            >
                              {formatStatus(booking.status)}
                            </Badge>

                            {remaining <= 0 ? (
                              <Badge variant="success">Paid</Badge>
                            ) : (
                              <Badge variant="warning">
                                {formatMoney(remaining, booking.currency)} due
                              </Badge>
                            )}
                          </div>

                          <h2 className="mt-4 break-all text-2xl font-black tracking-tight text-luxury-ink">
                            {booking.reservationNumber}
                          </h2>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {booking.hotel?.name || "Hotel booking"} ·{" "}
                            {formatDate(booking.checkInDate)} →{" "}
                            {formatDate(booking.checkOutDate)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                          <Link
                            href={`/bookings/${booking.reservationNumber}`}
                            className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                          >
                            View details
                          </Link>

                          {canPay ? (
                            <Link
                              href={`/bookings/${booking.reservationNumber}/pay`}
                              className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                            >
                              Pay booking
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
                      <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Guest
                        </p>

                        <p className="mt-2 text-sm font-black text-luxury-ink">
                          {booking.guestFirstName} {booking.guestLastName}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Rooms
                        </p>

                        <p className="mt-2 text-sm font-black text-luxury-ink">
                          {booking.rooms.length}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Total
                        </p>

                        <p className="mt-2 text-sm font-black text-luxury-ink">
                          {formatMoney(booking.total, booking.currency)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
