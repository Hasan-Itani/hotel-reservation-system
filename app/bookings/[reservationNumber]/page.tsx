import Link from "next/link";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { formatMoney } from "@/lib/frontend/format";
import type {
    PublicBookingDetails,
    PublicBookingDetailsResponse,
    ReservationStatus,
} from "@/lib/frontend/types";

type BookingDetailsPageProps = {
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

function calculatePaidFallback(booking: PublicBookingDetails) {
    if (booking.paymentSummary) {
        return Number(booking.paymentSummary.paid);
    }

    return (
        booking.payments
            ?.filter((payment) => payment.status === "PAID")
            .reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0
    );
}

function calculateRemainingFallback(booking: PublicBookingDetails) {
    if (booking.paymentSummary) {
        return Number(booking.paymentSummary.remaining);
    }

    return Math.max(0, Number(booking.total) - calculatePaidFallback(booking));
}

export default async function BookingDetailsPage({
    params,
    searchParams,
}: BookingDetailsPageProps) {
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
                                Try again
                            </Link>
                        </CardContent>
                    </Card>
                </main>

                <PublicFooter />
            </div>
        );
    }

    const paid = calculatePaidFallback(booking);
    const remaining = calculateRemainingFallback(booking);
    const canPay =
        remaining > 0 &&
        ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status);

    return (
        <div className="min-h-screen bg-background">
            <PublicHeader />

            <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <Badge variant={getStatusBadgeVariant(booking.status)}>
                            {formatStatus(booking.status)}
                        </Badge>

                        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            Booking {booking.reservationNumber}
                        </h1>

                        <p className="mt-2 text-sm text-muted-foreground">
                            {booking.hotel?.name || "Hotel booking"} ·{" "}
                            {formatDate(booking.checkInDate)} →{" "}
                            {formatDate(booking.checkOutDate)}
                        </p>
                    </div>

                    <Link
                        href="/bookings/lookup"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                    >
                        Search another booking
                    </Link>
                </section>

                <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <h2 className="text-base font-bold text-foreground">
                                    Guest and stay
                                </h2>
                            </CardHeader>

                            <CardContent>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-xl border border-border bg-surface-muted p-4">
                                        <p className="text-sm font-bold text-foreground">Guest</p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {booking.guestFirstName} {booking.guestLastName}
                                        </p>
                                        <p className="break-all text-sm text-muted-foreground">
                                            {booking.guestEmail}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {booking.guestPhone || "No phone provided"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-border bg-surface-muted p-4">
                                        <p className="text-sm font-bold text-foreground">Stay</p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {formatDate(booking.checkInDate)} →{" "}
                                            {formatDate(booking.checkOutDate)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {booking.adults} adult(s), {booking.children} child(ren)
                                        </p>
                                    </div>
                                </div>

                                {booking.specialRequests ? (
                                    <div className="mt-4 rounded-xl border border-border p-4">
                                        <p className="text-sm font-bold text-foreground">
                                            Special requests
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {booking.specialRequests}
                                        </p>
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <h2 className="text-base font-bold text-foreground">Rooms</h2>
                            </CardHeader>

                            <CardContent>
                                <div className="space-y-3">
                                    {booking.rooms.map((room) => (
                                        <div
                                            key={room.roomType.id}
                                            className="rounded-xl border border-border bg-surface-muted p-4"
                                        >
                                            <p className="text-sm font-bold text-foreground">
                                                {room.roomType.name}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {room.guests} guest(s) ·{" "}
                                                {formatMoney(room.nightlyPrice, booking.currency)}
                                                /night
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Bed: {room.roomType.bedType || "-"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <h2 className="text-base font-bold text-foreground">
                                    Payments
                                </h2>
                            </CardHeader>

                            <CardContent>
                                {!booking.payments || booking.payments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No payments recorded yet.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {booking.payments.map((payment, index) => (
                                            <div
                                                key={`${payment.createdAt}-${index}`}
                                                className="rounded-xl border border-border bg-surface-muted p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground">
                                                            {formatMoney(payment.amount, payment.currency)}
                                                        </p>
                                                        <p className="mt-1 text-sm text-muted-foreground">
                                                            {payment.methodLabel || "Payment"}{" "}
                                                            {payment.cardLast4
                                                                ? `· **** ${payment.cardLast4}`
                                                                : ""}
                                                        </p>
                                                    </div>

                                                    <Badge
                                                        variant={
                                                            payment.status === "PAID"
                                                                ? "success"
                                                                : payment.status === "FAILED"
                                                                    ? "danger"
                                                                    : payment.status === "REFUNDED"
                                                                        ? "default"
                                                                        : "warning"
                                                        }
                                                    >
                                                        {payment.status.replaceAll("_", " ")}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="lg:sticky lg:top-24">
                        <CardHeader>
                            <h2 className="text-base font-bold text-foreground">
                                Payment summary
                            </h2>
                        </CardHeader>

                        <CardContent>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div className="flex justify-between gap-3">
                                    <span>Subtotal</span>
                                    <span>{formatMoney(booking.subtotal, booking.currency)}</span>
                                </div>

                                <div className="flex justify-between gap-3">
                                    <span>Taxes</span>
                                    <span>{formatMoney(booking.taxes, booking.currency)}</span>
                                </div>

                                <div className="flex justify-between gap-3">
                                    <span>Service fee</span>
                                    <span>
                                        {formatMoney(booking.serviceFee, booking.currency)}
                                    </span>
                                </div>

                                <div className="border-t border-border pt-3">
                                    <div className="flex justify-between gap-3 font-bold text-foreground">
                                        <span>Total</span>
                                        <span>{formatMoney(booking.total, booking.currency)}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between gap-3">
                                    <span>Paid</span>
                                    <span>{formatMoney(paid, booking.currency)}</span>
                                </div>

                                <div className="flex justify-between gap-3 font-bold text-foreground">
                                    <span>Remaining</span>
                                    <span>{formatMoney(remaining, booking.currency)}</span>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-3">
                                {canPay ? (
                                    <Link
                                        href={
                                            guestEmail
                                                ? `/bookings/${booking.reservationNumber}/pay?guestEmail=${encodeURIComponent(
                                                    guestEmail,
                                                )}`
                                                : `/bookings/${booking.reservationNumber}/pay`
                                        }
                                        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
                                    >
                                        Pay booking
                                    </Link>
                                ) : null}

                                <Link
                                    href={`/hotels/${booking.hotel?.slug || ""}`}
                                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                                >
                                    Back to hotel
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}