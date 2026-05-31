"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/frontend/format";
import type {
    AuthUser,
    PublicBookingCreateResponse,
    PublicReservationSummary,
    PublicRoomType,
} from "@/lib/frontend/types";

type BookingFormProps = {
    user: AuthUser;
    hotelSlug: string;
    hotelName: string;
    currency: string;
    roomType: PublicRoomType;
    initialCheckInDate: string;
    initialCheckOutDate: string;
    initialAdults: string;
    initialChildren: string;
};

type GuestFormState = {
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    guestPhone: string;
    specialRequests: string;
};

const defaultGuestForm: GuestFormState = {
    guestFirstName: "",
    guestLastName: "",
    guestEmail: "",
    guestPhone: "",
    specialRequests: "",
};

function calculateNights(checkInDate: string, checkOutDate: string) {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    const diffMs = checkOut.getTime() - checkIn.getTime();
    const nights = diffMs / (1000 * 60 * 60 * 24);

    if (!Number.isFinite(nights) || nights < 1) {
        return 0;
    }

    return Math.round(nights);
}

function numberValue(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatPublicDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(new Date(value));
}

export function BookingForm({
    user,
    hotelSlug,
    hotelName,
    currency,
    roomType,
    initialCheckInDate,
    initialCheckOutDate,
    initialAdults,
    initialChildren,
}: BookingFormProps) {
    const [guestForm, setGuestForm] = useState<GuestFormState>({
        guestFirstName: user.firstName,
        guestLastName: user.lastName,
        guestEmail: user.email,
        guestPhone: user.phone || "",
        specialRequests: "",
    });
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reservation, setReservation] =
        useState<PublicReservationSummary | null>(null);

    const [copiedReservationNumber, setCopiedReservationNumber] = useState(false);

    const adults = numberValue(initialAdults);
    const children = numberValue(initialChildren);
    const totalGuests = adults + children;
    const nights = calculateNights(initialCheckInDate, initialCheckOutDate);

    const estimatedSubtotal = useMemo(() => {
        return nights * Number(roomType.basePrice || 0);
    }, [nights, roomType.basePrice]);

    function updateGuestForm<Key extends keyof GuestFormState>(
        key: Key,
        value: GuestFormState[Key],
    ) {
        setGuestForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    function fallbackCopyText(text: string) {
        const textarea = document.createElement("textarea");

        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";

        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);

        const copied = document.execCommand("copy");

        document.body.removeChild(textarea);

        return copied;
    }

    async function copyReservationNumber(reservationNumber: string) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(reservationNumber);
            } else {
                const copied = fallbackCopyText(reservationNumber);

                if (!copied) {
                    throw new Error("Fallback copy failed");
                }
            }

            setCopiedReservationNumber(true);

            window.setTimeout(() => {
                setCopiedReservationNumber(false);
            }, 2000);
        } catch {
            setError(
                "Copy failed. Long-press the reservation number and copy it manually.",
            );
        }
    }

    async function submitBooking(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");

        if (!guestForm.guestFirstName.trim()) {
            setError("First name is required");
            return;
        }

        if (!guestForm.guestLastName.trim()) {
            setError("Last name is required");
            return;
        }

        if (!guestForm.guestEmail.trim()) {
            setError("Email is required");
            return;
        }

        if (!initialCheckInDate || !initialCheckOutDate || nights < 1) {
            setError("Invalid stay dates. Go back and search availability again.");
            return;
        }

        if (adults < 1) {
            setError("Adults must be at least 1");
            return;
        }

        if (totalGuests < 1) {
            setError("Guest count is invalid");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`/api/public/hotels/${hotelSlug}/book`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    guestFirstName: guestForm.guestFirstName.trim(),
                    guestLastName: guestForm.guestLastName.trim(),
                    guestEmail: user.email,
                    guestPhone: guestForm.guestPhone.trim() || null,
                    specialRequests: guestForm.specialRequests.trim() || null,
                    checkInDate: initialCheckInDate,
                    checkOutDate: initialCheckOutDate,
                    adults,
                    children,
                    rooms: [
                        {
                            roomTypeId: roomType.id,
                            guests: totalGuests,
                        },
                    ],
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Unable to create booking");
                return;
            }

            const bookingData = data as PublicBookingCreateResponse;
            setReservation(bookingData.reservation);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
            setError("Unable to create booking");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (reservation) {
        return (
            <Card>
                <CardHeader>
                    <Badge variant="success">Booking created</Badge>
                    <h1 className="mt-3 text-2xl font-bold text-foreground">
                        Reservation confirmed
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Save this reservation number. You will use it to lookup your booking.
                    </p>
                </CardHeader>

                <CardContent>
                    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                        <div className="space-y-4">
                            <div className="rounded-xl border border-border bg-surface-muted p-4">
                                <p className="text-xs font-medium uppercase text-muted-foreground">
                                    Reservation number
                                </p>

                                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="select-all break-all text-2xl font-bold text-foreground">
                                        {reservation.reservationNumber}
                                    </p>

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => copyReservationNumber(reservation.reservationNumber)}
                                    >
                                        {copiedReservationNumber ? "Copied" : "Copy"}
                                    </Button>
                                </div>

                                <p className="mt-3 text-sm text-muted-foreground">
                                    Save this number. You need it to find your booking later.
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-border p-4">
                                    <p className="text-sm font-bold text-foreground">Guest</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {reservation.guestFirstName} {reservation.guestLastName}
                                    </p>
                                    <p className="break-all text-sm text-muted-foreground">
                                        {reservation.guestEmail}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-border p-4">
                                    <p className="text-sm font-bold text-foreground">Stay</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {formatPublicDate(reservation.checkInDate)} →{" "}
                                        {formatPublicDate(reservation.checkOutDate)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {reservation.adults} adult(s), {reservation.children} child(ren)
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border p-4">
                                <p className="text-sm font-bold text-foreground">Room</p>
                                {reservation.rooms.map((room) => (
                                    <p
                                        key={room.roomType.id}
                                        className="mt-1 text-sm text-muted-foreground"
                                    >
                                        {room.roomType.name} — {formatMoney(room.nightlyPrice, currency)}
                                        /night
                                    </p>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-white p-4">
                            <p className="text-sm font-bold text-foreground">Price summary</p>

                            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <div className="flex justify-between gap-3">
                                    <span>Subtotal</span>
                                    <span>{formatMoney(reservation.subtotal, reservation.currency)}</span>
                                </div>

                                <div className="flex justify-between gap-3">
                                    <span>Taxes</span>
                                    <span>{formatMoney(reservation.taxes, reservation.currency)}</span>
                                </div>

                                <div className="flex justify-between gap-3">
                                    <span>Service fee</span>
                                    <span>
                                        {formatMoney(reservation.serviceFee, reservation.currency)}
                                    </span>
                                </div>

                                <div className="border-t border-border pt-3">
                                    <div className="flex justify-between gap-3 text-base font-bold text-foreground">
                                        <span>Total</span>
                                        <span>{formatMoney(reservation.total, reservation.currency)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-3">
                                <Link
                                    href={`/bookings/${reservation.reservationNumber}?guestEmail=${encodeURIComponent(
                                        reservation.guestEmail,
                                    )}`}
                                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
                                >
                                    View booking details
                                </Link>

                                <Link
                                    href={`/hotels/${hotelSlug}`}
                                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                                >
                                    Back to hotel
                                </Link>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
            <Card>
                <CardHeader>
                    <h1 className="text-2xl font-bold text-foreground">
                        Complete your booking
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Enter guest details. Availability will be checked again before the booking is created.
                    </p>
                </CardHeader>

                <CardContent>
                    {error ? (
                        <div className="mb-5 rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                            {error}
                        </div>
                    ) : null}

                    <form className="grid gap-4" onSubmit={submitBooking}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="First Name"
                                name="guestFirstName"
                                value={guestForm.guestFirstName}
                                onChange={(event) =>
                                    updateGuestForm("guestFirstName", event.target.value)
                                }
                                required
                            />

                            <Input
                                label="Last Name"
                                name="guestLastName"
                                value={guestForm.guestLastName}
                                onChange={(event) =>
                                    updateGuestForm("guestLastName", event.target.value)
                                }
                                required
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Email"
                                name="guestEmail"
                                type="email"
                                value={user.email}
                                readOnly
                                className="bg-surface-muted"
                                required
                            />

                            <p className="mt-2 text-xs text-muted-foreground sm:col-span-2">
                                This booking will be linked to your signed-in account.
                            </p>

                            <Input
                                label="Phone"
                                name="guestPhone"
                                value={guestForm.guestPhone}
                                onChange={(event) =>
                                    updateGuestForm("guestPhone", event.target.value)
                                }
                                placeholder="+961..."
                            />
                        </div>

                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-foreground">
                                Special Requests
                            </span>
                            <textarea
                                value={guestForm.specialRequests}
                                onChange={(event) =>
                                    updateGuestForm("specialRequests", event.target.value)
                                }
                                rows={5}
                                className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                placeholder="Arrival time, room preference, notes..."
                            />
                        </label>

                        <Button type="submit" className="h-11" disabled={isSubmitting}>
                            {isSubmitting ? "Creating booking..." : "Confirm booking"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="lg:sticky lg:top-24">
                <CardHeader>
                    <h2 className="text-base font-bold text-foreground">
                        Booking summary
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{hotelName}</p>
                </CardHeader>

                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-foreground">
                                {roomType.name}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {roomType.description || "Selected room type"}
                            </p>
                        </div>

                        <div className="grid gap-3 text-sm">
                            <div className="rounded-xl bg-surface-muted px-3 py-3">
                                <p className="text-xs text-muted-foreground">Dates</p>
                                <p className="mt-1 font-bold text-foreground">
                                    {formatPublicDate(initialCheckInDate)} →{" "}
                                    {formatPublicDate(initialCheckOutDate)}
                                </p>
                            </div>

                            <div className="rounded-xl bg-surface-muted px-3 py-3">
                                <p className="text-xs text-muted-foreground">Guests</p>
                                <p className="mt-1 font-bold text-foreground">
                                    {adults} adult(s), {children} child(ren)
                                </p>
                            </div>

                            <div className="rounded-xl bg-surface-muted px-3 py-3">
                                <p className="text-xs text-muted-foreground">Nights</p>
                                <p className="mt-1 font-bold text-foreground">{nights}</p>
                            </div>
                        </div>

                        <div className="border-t border-border pt-4">
                            <div className="flex justify-between gap-3 text-sm text-muted-foreground">
                                <span>Nightly price</span>
                                <span>{formatMoney(roomType.basePrice, currency)}</span>
                            </div>

                            <div className="mt-2 flex justify-between gap-3 text-sm text-muted-foreground">
                                <span>Estimated subtotal</span>
                                <span>{formatMoney(estimatedSubtotal, currency)}</span>
                            </div>

                            <p className="mt-3 text-xs text-muted-foreground">
                                Final price is calculated by the backend when booking is created.
                            </p>
                        </div>

                        <Link
                            href={`/hotels/${hotelSlug}#availability`}
                            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                        >
                            Change selection
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}