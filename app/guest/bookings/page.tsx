import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import { serverFetchJson } from "@/lib/frontend/api-server";
import { formatMoney } from "@/lib/frontend/format";
import type {
  GuestBookingsResponse,
  PublicBookingDetails,
  ReservationStatus,
} from "@/lib/frontend/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
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
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge variant="success">Guest account</Badge>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              My reservations
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              View bookings linked to your guest account.
            </p>
          </div>

          <Link
            href="/hotels"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
          >
            Book another stay
          </Link>
        </section>

        <section className="mt-8">
          {data.bookings.length === 0 ? (
            <Card>
              <CardContent>
                <h2 className="text-lg font-bold text-foreground">
                  No reservations yet
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Reservations created before guest-login booking was enabled may
                  not appear here. You can still find them through booking
                  lookup.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/hotels"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
                  >
                    Browse hotels
                  </Link>

                  <Link
                    href="/bookings/lookup"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                  >
                    Use booking lookup
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {data.bookings.map((booking) => {
                const remaining = getRemainingAmount(booking);
                const canPay =
                  remaining > 0 &&
                  ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(
                    booking.status,
                  );

                return (
                  <Card key={booking.reservationNumber}>
                    <CardHeader>
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
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

                          <h2 className="mt-3 break-all text-xl font-bold text-foreground">
                            {booking.reservationNumber}
                          </h2>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {booking.hotel?.name || "Hotel booking"} ·{" "}
                            {formatDate(booking.checkInDate)} →{" "}
                            {formatDate(booking.checkOutDate)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:items-end">
                          <Link
                            href={`/bookings/${booking.reservationNumber}`}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                          >
                            View details
                          </Link>

                          {canPay ? (
                            <Link
                              href={`/bookings/${booking.reservationNumber}/pay`}
                              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
                            >
                              Pay booking
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-surface-muted px-4 py-3">
                          <p className="text-xs text-muted-foreground">Guest</p>
                          <p className="mt-1 text-sm font-bold text-foreground">
                            {booking.guestFirstName} {booking.guestLastName}
                          </p>
                        </div>

                        <div className="rounded-xl bg-surface-muted px-4 py-3">
                          <p className="text-xs text-muted-foreground">Rooms</p>
                          <p className="mt-1 text-sm font-bold text-foreground">
                            {booking.rooms.length}
                          </p>
                        </div>

                        <div className="rounded-xl bg-surface-muted px-4 py-3">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="mt-1 text-sm font-bold text-foreground">
                            {formatMoney(booking.total, booking.currency)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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