import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/frontend/format";
import type {
    PublicBookingDetails,
    PublicBookingDetailsResponse,
    ReservationStatus,
} from "@/lib/frontend/types";

export const metadata: Metadata = {
    title: "Booking Details | Hotel System",
    description: "View reservation details, stay information, and payment status.",
};

type BookingDetailsPageProps = {
    params: Promise<{
        reservationNumber: string;
    }>;
    searchParams?: Promise<{
        guestEmail?: string;
    }>;
};

const publicDateFormatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
});

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

function getPaymentBadgeVariant(
    status: string,
): "success" | "warning" | "danger" | "primary" | "default" {
    if (status === "PAID") return "success";
    if (status === "FAILED") return "danger";
    if (status === "REFUNDED") return "default";

    return "warning";
}

function calculatePaidFallback(booking: PublicBookingDetails) {
    if (booking.paymentSummary) {
        return Number(booking.paymentSummary.paid);
    }

    return (
        booking.payments?.reduce((sum, payment) => {
            if (payment.status !== "PAID") {
                return sum;
            }

            return sum + Number(payment.amount);
        }, 0) ?? 0
    );
}

function calculateRemainingFallback(booking: PublicBookingDetails) {
    if (booking.paymentSummary) {
        return Number(booking.paymentSummary.remaining);
    }

    return Math.max(0, Number(booking.total) - calculatePaidFallback(booking));
}

function getBookingDetailsHref(input: {
    reservationNumber: string;
    guestEmail: string;
}) {
    if (!input.guestEmail) {
        return `/bookings/${input.reservationNumber}`;
    }

    return `/bookings/${input.reservationNumber}?guestEmail=${encodeURIComponent(
        input.guestEmail,
    )}`;
}

function getPaymentHref(input: {
    reservationNumber: string;
    guestEmail: string;
}) {
    if (!input.guestEmail) {
        return `/bookings/${input.reservationNumber}/pay`;
    }

    return `/bookings/${input.reservationNumber}/pay?guestEmail=${encodeURIComponent(
        input.guestEmail,
    )}`;
}

function getHotelHref(booking: PublicBookingDetails) {
    if (!booking.hotel?.slug) {
        return "/hotels";
    }

    return `/hotels/${booking.hotel.slug}`;
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
            <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
                <PublicHeader />

                <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
                    <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
                        <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
                            <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                                Booking lookup
                            </p>

                            <h1 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                                Booking not found.
                            </h1>

                            <p className="mt-3 text-sm leading-7 text-slate-600">{error}</p>
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

    const paid = calculatePaidFallback(booking);
    const remaining = calculateRemainingFallback(booking);
    const canPay =
        remaining > 0 &&
        ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status);

    return (
        <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
            <PublicHeader />

            <main className="flex-1">
                <section className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_38%,#ffffff_100%)]">
                    <div className="luxury-container py-10 lg:py-14">
                        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                            <div>
                                <Badge variant={getStatusBadgeVariant(booking.status)}>
                                    {formatStatus(booking.status)}
                                </Badge>

                                <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl">
                                    Booking {booking.reservationNumber}
                                </h1>

                                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                                    {booking.hotel?.name || "Hotel booking"} ·{" "}
                                    {formatDate(booking.checkInDate)} →{" "}
                                    {formatDate(booking.checkOutDate)}
                                </p>
                            </div>

                            <Link
                                href="/bookings/lookup"
                                className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                            >
                                Search another booking
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="luxury-container py-10 lg:py-12">
                    <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
                        <div className="space-y-6">
                            <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
                                <div className="border-b border-luxury-stone p-6">
                                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                                        Guest and stay
                                    </p>

                                    <h2 className="mt-3 text-xl font-black text-luxury-ink">
                                        Reservation details
                                    </h2>
                                </div>

                                <div className="p-6">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                                Guest
                                            </p>

                                            <p className="mt-3 text-sm font-black text-luxury-ink">
                                                {booking.guestFirstName} {booking.guestLastName}
                                            </p>

                                            <p className="mt-1 break-all text-sm text-slate-600">
                                                {booking.guestEmail}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-600">
                                                {booking.guestPhone || "No phone provided"}
                                            </p>
                                        </div>

                                        <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                                Stay
                                            </p>

                                            <p className="mt-3 text-sm font-black text-luxury-ink">
                                                {formatDate(booking.checkInDate)} →{" "}
                                                {formatDate(booking.checkOutDate)}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-600">
                                                {booking.adults} adult(s), {booking.children} child(ren)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-3xl border border-luxury-stone bg-white p-5">
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                            Special requests
                                        </p>

                                        <p className="mt-3 text-sm leading-7 text-slate-600">
                                            {booking.specialRequests || "No special requests."}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
                                <div className="border-b border-luxury-stone p-6">
                                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                                        Rooms
                                    </p>

                                    <h2 className="mt-3 text-xl font-black text-luxury-ink">
                                        Selected room type
                                    </h2>
                                </div>

                                <div className="grid gap-4 p-6">
                                    {booking.rooms.map((room) => (
                                        <div
                                            key={room.roomType.id}
                                            className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5"
                                        >
                                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                                <div>
                                                    <p className="text-lg font-black text-luxury-ink">
                                                        {room.roomType.name}
                                                    </p>

                                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                                        {room.guests} guest(s) · Bed:{" "}
                                                        {room.roomType.bedType || "-"}
                                                    </p>
                                                </div>

                                                <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-luxury-ink shadow-sm">
                                                    {formatMoney(room.nightlyPrice, booking.currency)}
                                                    /night
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
                                <div className="border-b border-luxury-stone p-6">
                                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                                        Payments
                                    </p>

                                    <h2 className="mt-3 text-xl font-black text-luxury-ink">
                                        Payment history
                                    </h2>
                                </div>

                                <div className="p-6">
                                    {!booking.payments || booking.payments.length === 0 ? (
                                        <div className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5">
                                            <p className="text-sm font-bold text-slate-600">
                                                No payments recorded yet.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {booking.payments.map((payment, index) => (
                                                <div
                                                    key={`${payment.createdAt}-${index}`}
                                                    className="rounded-3xl border border-luxury-stone bg-luxury-cream p-5"
                                                >
                                                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                                        <div>
                                                            <p className="text-lg font-black text-luxury-ink">
                                                                {formatMoney(payment.amount, payment.currency)}
                                                            </p>

                                                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                                                {payment.methodLabel || "Payment"}
                                                                {payment.cardLast4
                                                                    ? ` · **** ${payment.cardLast4}`
                                                                    : ""}
                                                            </p>
                                                        </div>

                                                        <Badge variant={getPaymentBadgeVariant(payment.status)}>
                                                            {payment.status.replaceAll("_", " ")}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        <aside className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5 lg:sticky lg:top-24">
                            <div className="border-b border-luxury-stone p-6">
                                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                                    Summary
                                </p>

                                <h2 className="mt-3 text-xl font-black text-luxury-ink">
                                    Payment summary
                                </h2>
                            </div>

                            <div className="space-y-4 p-6">
                                <div className="rounded-3xl bg-luxury-cream px-5 py-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Reservation
                                    </p>

                                    <p className="mt-2 break-all text-sm font-black text-luxury-ink">
                                        {booking.reservationNumber}
                                    </p>
                                </div>

                                <div className="border-t border-luxury-stone pt-5 text-sm">
                                    <div className="flex justify-between gap-3 text-slate-600">
                                        <span>Subtotal</span>
                                        <span>{formatMoney(booking.subtotal, booking.currency)}</span>
                                    </div>

                                    <div className="mt-3 flex justify-between gap-3 text-slate-600">
                                        <span>Taxes</span>
                                        <span>{formatMoney(booking.taxes, booking.currency)}</span>
                                    </div>

                                    <div className="mt-3 flex justify-between gap-3 text-slate-600">
                                        <span>Service fee</span>
                                        <span>
                                            {formatMoney(booking.serviceFee, booking.currency)}
                                        </span>
                                    </div>

                                    <div className="mt-4 border-t border-luxury-stone pt-4">
                                        <div className="flex justify-between gap-3 text-base font-black text-luxury-ink">
                                            <span>Total</span>
                                            <span>{formatMoney(booking.total, booking.currency)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-between gap-3 text-slate-600">
                                        <span>Paid</span>
                                        <span>{formatMoney(paid, booking.currency)}</span>
                                    </div>

                                    <div className="mt-3 flex justify-between gap-3 text-lg font-black text-luxury-ink">
                                        <span>Remaining</span>
                                        <span>{formatMoney(remaining, booking.currency)}</span>
                                    </div>
                                </div>

                                <div className="grid gap-3 pt-2">
                                    {canPay ? (
                                        <Link
                                            href={getPaymentHref({
                                                reservationNumber: booking.reservationNumber,
                                                guestEmail,
                                            })}
                                            className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                                        >
                                            Pay booking
                                        </Link>
                                    ) : null}

                                    <Link
                                        href={getHotelHref(booking)}
                                        className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                                    >
                                        Back to hotel
                                    </Link>

                                    <Link
                                        href={getBookingDetailsHref({
                                            reservationNumber: booking.reservationNumber,
                                            guestEmail,
                                        })}
                                        className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                                    >
                                        Refresh details
                                    </Link>
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    );
}