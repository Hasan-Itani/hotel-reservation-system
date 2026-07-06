"use client";

import type {
  FormEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
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

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helperText?: string;
};

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  helperText?: string;
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

function getFriendlyBookingError(response: Response, data: unknown) {
  const fallbackMessage =
    "We could not create your booking right now. Please try again.";

  if (response.status >= 500) {
    return (
      "We could not create your booking because something went wrong on our side. Please try again in a moment."
    );
  }

  if (response.status === 409) {
    return (
      "This room may no longer be available for your selected dates. Please refresh availability and choose again."
    );
  }

  if (response.status === 401) {
    return "Please sign in again before completing your booking.";
  }

  if (response.status === 429) {
    return "Too many booking attempts. Please wait a few minutes and try again.";
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string" &&
    data.error.trim()
  ) {
    const rawMessage = data.error.trim();

    if (/internal server error/i.test(rawMessage)) {
      return fallbackMessage;
    }

    return rawMessage;
  }

  return fallbackMessage;
}

function FormInput({
  label,
  helperText,
  className = "",
  ...props
}: FormInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-luxury-ink">
        {label}
      </span>

      <input
        {...props}
        className={[
          "h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          className,
        ].join(" ")}
      />

      {helperText ? (
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}

function FormTextarea({
  label,
  helperText,
  className = "",
  ...props
}: FormTextareaProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-luxury-ink">
        {label}
      </span>

      <textarea
        {...props}
        className={[
          "w-full rounded-2xl border border-luxury-stone bg-white px-4 py-3 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft",
          className,
        ].join(" ")}
      />

      {helperText ? (
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          {helperText}
        </span>
      ) : null}
    </label>
  );
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

    if (!user.email.trim()) {
      setError("Signed-in account email is missing");
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
        setError(getFriendlyBookingError(response, data));
        return;
      }

      const bookingData = data as PublicBookingCreateResponse;
      setReservation(bookingData.reservation);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(
        "We could not reach the booking service. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (reservation) {
    return (
      <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
        <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
          <Badge variant="success">Booking created</Badge>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
            Reservation confirmed.
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Save your reservation number. You can use your guest account to view
            booking details and continue to payment.
          </p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px] lg:p-8">
          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-luxury-stone bg-luxury-cream p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Reservation number
              </p>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="select-all break-all text-3xl font-black tracking-tight text-luxury-ink">
                  {reservation.reservationNumber}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    copyReservationNumber(reservation.reservationNumber)
                  }
                  className="inline-flex h-11 items-center justify-center rounded-full border border-luxury-stone bg-white px-5 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                >
                  {copiedReservationNumber ? "Copied" : "Copy"}
                </button>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Keep this number for support and public booking lookup.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-luxury-stone bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Guest
                </p>
                <p className="mt-2 text-sm font-black text-luxury-ink">
                  {reservation.guestFirstName} {reservation.guestLastName}
                </p>
                <p className="mt-1 break-all text-sm text-slate-600">
                  {reservation.guestEmail}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-luxury-stone bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Stay
                </p>
                <p className="mt-2 text-sm font-black text-luxury-ink">
                  {formatPublicDate(reservation.checkInDate)} →{" "}
                  {formatPublicDate(reservation.checkOutDate)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {reservation.adults} adult(s), {reservation.children}{" "}
                  child(ren)
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-luxury-stone bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Room
              </p>

              <div className="mt-3 grid gap-3">
                {reservation.rooms.map((room) => (
                  <div
                    key={room.roomType.id}
                    className="rounded-2xl bg-luxury-cream px-4 py-3"
                  >
                    <p className="text-sm font-black text-luxury-ink">
                      {room.roomType.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatMoney(room.nightlyPrice, currency)} / night
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-luxury-stone bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Price summary
            </p>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between gap-3">
                <span>Subtotal</span>
                <span>
                  {formatMoney(reservation.subtotal, reservation.currency)}
                </span>
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

              <div className="border-t border-luxury-stone pt-4">
                <div className="flex justify-between gap-3 text-lg font-black text-luxury-ink">
                  <span>Total</span>
                  <span>
                    {formatMoney(reservation.total, reservation.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <Link
                href={`/bookings/${reservation.reservationNumber}/pay`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
              >
                Pay now
              </Link>

              <Link
                href={`/bookings/${reservation.reservationNumber}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
              >
                View booking details
              </Link>

              <Link
                href={`/hotels/${hotelSlug}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
              >
                Back to hotel
              </Link>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
      <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
        <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
            Guest details
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
            Complete your booking.
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Enter guest details. Availability is checked again before the
            reservation is created.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {error ? (
            <div className="mb-6 rounded-3xl border border-danger-soft bg-danger-soft px-5 py-4 text-sm font-bold text-danger">
              {error}
            </div>
          ) : null}

          <form className="grid gap-5" onSubmit={submitBooking}>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormInput
                label="First name"
                name="guestFirstName"
                value={guestForm.guestFirstName}
                onChange={(event) =>
                  updateGuestForm("guestFirstName", event.target.value)
                }
                required
              />

              <FormInput
                label="Last name"
                name="guestLastName"
                value={guestForm.guestLastName}
                onChange={(event) =>
                  updateGuestForm("guestLastName", event.target.value)
                }
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormInput
                label="Email"
                name="guestEmail"
                type="email"
                value={user.email}
                readOnly
                className="bg-slate-50"
                helperText="This booking is linked to your signed-in account."
                required
              />

              <FormInput
                label="Phone"
                name="guestPhone"
                value={guestForm.guestPhone}
                onChange={(event) =>
                  updateGuestForm("guestPhone", event.target.value)
                }
                placeholder="+961..."
              />
            </div>

            <FormTextarea
              label="Special requests"
              value={guestForm.specialRequests}
              onChange={(event) =>
                updateGuestForm("specialRequests", event.target.value)
              }
              rows={5}
              placeholder="Arrival time, room preference, notes..."
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
            >
              {isSubmitting ? "Creating booking..." : "Confirm booking"}
            </button>
          </form>
        </div>
      </section>

      <aside className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5 lg:sticky lg:top-24">
        <div className="border-b border-luxury-stone p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
            Summary
          </p>

          <h2 className="mt-3 text-xl font-black text-luxury-ink">
            Booking summary
          </h2>

          <p className="mt-2 text-sm text-slate-600">{hotelName}</p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-3xl bg-luxury-cream px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Room
            </p>
            <p className="mt-2 text-sm font-black text-luxury-ink">
              {roomType.name}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {roomType.description || "Selected room type"}
            </p>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="rounded-3xl border border-luxury-stone bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Dates
              </p>
              <p className="mt-2 font-black text-luxury-ink">
                {formatPublicDate(initialCheckInDate)} →{" "}
                {formatPublicDate(initialCheckOutDate)}
              </p>
            </div>

            <div className="rounded-3xl border border-luxury-stone bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Guests
              </p>
              <p className="mt-2 font-black text-luxury-ink">
                {adults} adult(s), {children} child(ren)
              </p>
            </div>

            <div className="rounded-3xl border border-luxury-stone bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Nights
              </p>
              <p className="mt-2 font-black text-luxury-ink">{nights}</p>
            </div>
          </div>

          <div className="border-t border-luxury-stone pt-5">
            <div className="flex justify-between gap-3 text-sm text-slate-600">
              <span>Nightly price</span>
              <span>{formatMoney(roomType.basePrice, currency)}</span>
            </div>

            <div className="mt-3 flex justify-between gap-3 text-sm text-slate-600">
              <span>Estimated subtotal</span>
              <span>{formatMoney(estimatedSubtotal, currency)}</span>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Final total is calculated by the backend when the booking is
              created.
            </p>
          </div>

          <Link
            href={`/hotels/${hotelSlug}#availability`}
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
          >
            Change selection
          </Link>
        </div>
      </aside>
    </div>
  );
}
