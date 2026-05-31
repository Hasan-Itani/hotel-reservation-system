"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/frontend/format";
import type {
  PublicBookingDetails,
  PublicBookingPaymentResponse,
  PublicBookingPaymentSummary,
  ReservationStatus,
} from "@/lib/frontend/types";

type PublicPaymentFormProps = {
  booking: PublicBookingDetails;
  accessGuestEmail?: string;
};

type PaymentFormState = {
  amount: string;
  cardHolderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
};

type PaymentInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helperText?: string;
};

const emptyForm: PaymentFormState = {
  amount: "",
  cardHolderName: "",
  cardNumber: "",
  expiryMonth: "12",
  expiryYear: "2027",
  cvv: "123",
};

function canPayReservation(status: ReservationStatus) {
  return ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(status);
}

function formatStatus(status: string) {
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

function fallbackPaymentSummary(booking: PublicBookingDetails) {
  const total = Number(booking.total);

  const paid =
    booking.payments
      ?.filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;

  return {
    total,
    paid,
    remaining: Math.max(0, total - paid),
  };
}

function getPaymentResultMessage(input: {
  paymentStatus: string;
  remaining: number;
  currency: string;
}) {
  if (input.paymentStatus === "PAID") {
    if (input.remaining <= 0) {
      return "Payment received. This booking is now fully paid.";
    }

    return `Payment received. Remaining balance: ${formatMoney(
      input.remaining,
      input.currency,
    )}.`;
  }

  if (input.paymentStatus === "FAILED") {
    return "Payment failed. Try another card or contact the hotel.";
  }

  return "Payment updated.";
}

function PaymentInput({
  label,
  helperText,
  className = "",
  ...props
}: PaymentInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-luxury-ink">
        {label}
      </span>

      <input
        {...props}
        className={[
          "h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft",
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

export function PublicPaymentForm({
  booking,
  accessGuestEmail,
}: PublicPaymentFormProps) {
  const [form, setForm] = useState<PaymentFormState>({
    ...emptyForm,
    cardHolderName: `${booking.guestFirstName} ${booking.guestLastName}`,
  });
  const [paymentSummary, setPaymentSummary] =
    useState<PublicBookingPaymentSummary>(
      booking.paymentSummary || fallbackPaymentSummary(booking),
    );
  const [reservationStatus, setReservationStatus] =
    useState<ReservationStatus>(booking.status);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [lastPaymentStatus, setLastPaymentStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remaining = Number(paymentSummary.remaining);
  const canPay = remaining > 0 && canPayReservation(reservationStatus);
  const currentYear = new Date().getFullYear();

  const bookingDetailsHref = accessGuestEmail
    ? `/bookings/${booking.reservationNumber}?guestEmail=${encodeURIComponent(
        accessGuestEmail,
      )}`
    : `/bookings/${booking.reservationNumber}`;

  function updateForm<Key extends keyof PaymentFormState>(
    key: Key,
    value: PaymentFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setResultMessage("");
    setLastPaymentStatus("");

    if (!canPay) {
      setError("This booking cannot accept payment right now");
      return;
    }

    if (!form.cardHolderName.trim()) {
      setError("Card holder name is required");
      return;
    }

    if (!form.cardNumber.trim()) {
      setError("Card number is required");
      return;
    }

    if (!form.cvv.trim()) {
      setError("CVV is required");
      return;
    }

    if (form.amount.trim()) {
      const amount = Number(form.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      if (amount > remaining) {
        setError("Amount cannot be greater than the remaining balance");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        cardHolderName: form.cardHolderName.trim(),
        cardNumber: form.cardNumber.trim(),
        expiryMonth: Number(form.expiryMonth),
        expiryYear: Number(form.expiryYear),
        cvv: form.cvv.trim(),
      };

      if (accessGuestEmail) {
        body.guestEmail = accessGuestEmail;
      }

      if (form.amount.trim()) {
        body.amount = Number(form.amount);
      }

      const response = await fetch(
        `/api/public/bookings/${booking.reservationNumber}/pay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to process payment");

        if (data.paymentSummary) {
          setPaymentSummary(data.paymentSummary);
        }

        return;
      }

      const paymentData = data as PublicBookingPaymentResponse;

      setPaymentSummary(paymentData.paymentSummary);
      setReservationStatus(paymentData.reservationStatus);
      setLastPaymentStatus(paymentData.payment.status);
      setResultMessage(
        getPaymentResultMessage({
          paymentStatus: paymentData.payment.status,
          remaining: Number(paymentData.paymentSummary.remaining),
          currency: booking.currency,
        }),
      );
      setForm({
        ...emptyForm,
        cardHolderName: `${booking.guestFirstName} ${booking.guestLastName}`,
      });
    } catch {
      setError("Unable to process payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
      <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
        <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                Payment
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                Pay booking
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                Complete payment for reservation{" "}
                <span className="font-bold text-luxury-ink">
                  {booking.reservationNumber}
                </span>
                .
              </p>
            </div>

            <Badge variant={getStatusBadgeVariant(reservationStatus)}>
              {formatStatus(reservationStatus)}
            </Badge>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {resultMessage ? (
            <div
              className={[
                "mb-6 rounded-3xl border px-5 py-4 text-sm font-bold",
                lastPaymentStatus === "PAID"
                  ? "border-success-soft bg-success-soft text-success"
                  : "border-danger-soft bg-danger-soft text-danger",
              ].join(" ")}
            >
              <p>{resultMessage}</p>

              {lastPaymentStatus === "PAID" ? (
                <Link
                  href={bookingDetailsHref}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-success shadow-sm transition hover:brightness-95"
                >
                  View booking details
                </Link>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="mb-6 rounded-3xl border border-danger-soft bg-danger-soft px-5 py-4 text-sm font-bold text-danger">
              {error}
            </div>
          ) : null}

          {!canPay ? (
            <div className="rounded-3xl border border-luxury-stone bg-luxury-cream px-5 py-6">
              <p className="text-sm font-black text-luxury-ink">
                Payment is not available
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {remaining <= 0
                  ? "This booking is fully paid."
                  : "This booking status does not allow new payments."}
              </p>

              <Link
                href={bookingDetailsHref}
                className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
              >
                Back to booking details
              </Link>
            </div>
          ) : (
            <form className="grid gap-5" onSubmit={submitPayment}>
              <PaymentInput
                label={`Amount (${booking.currency})`}
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                placeholder={`Leave empty to pay ${formatMoney(
                  remaining,
                  booking.currency,
                )}`}
                helperText="Leave empty to pay the full remaining balance."
              />

              <PaymentInput
                label="Card holder name"
                name="cardHolderName"
                value={form.cardHolderName}
                onChange={(event) =>
                  updateForm("cardHolderName", event.target.value)
                }
                required
              />

              <PaymentInput
                label="Card number"
                name="cardNumber"
                value={form.cardNumber}
                onChange={(event) =>
                  updateForm("cardNumber", event.target.value)
                }
                placeholder="4242424242424242"
                inputMode="numeric"
                required
              />

              <div className="grid gap-5 sm:grid-cols-3">
                <PaymentInput
                  label="Expiry month"
                  name="expiryMonth"
                  type="number"
                  min="1"
                  max="12"
                  value={form.expiryMonth}
                  onChange={(event) =>
                    updateForm("expiryMonth", event.target.value)
                  }
                  required
                />

                <PaymentInput
                  label="Expiry year"
                  name="expiryYear"
                  type="number"
                  min={currentYear}
                  max="2100"
                  value={form.expiryYear}
                  onChange={(event) =>
                    updateForm("expiryYear", event.target.value)
                  }
                  required
                />

                <PaymentInput
                  label="CVV"
                  name="cvv"
                  value={form.cvv}
                  onChange={(event) => updateForm("cvv", event.target.value)}
                  inputMode="numeric"
                  required
                />
              </div>

              <div className="rounded-3xl border border-warning-soft bg-warning-soft px-5 py-4 text-sm leading-6 text-warning">
                Test card: <strong>4242424242424242</strong>. Failed card:{" "}
                <strong>4000000000000002</strong>.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
              >
                {isSubmitting ? "Processing..." : "Pay booking"}
              </button>
            </form>
          )}
        </div>
      </section>

      <aside className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5 lg:sticky lg:top-24">
        <div className="border-b border-luxury-stone p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
            Summary
          </p>

          <h2 className="mt-3 text-xl font-black text-luxury-ink">
            Payment summary
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {booking.hotel?.name || "Hotel booking"}
          </p>
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

          <div className="rounded-3xl bg-luxury-cream px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Guest
            </p>
            <p className="mt-2 text-sm font-black text-luxury-ink">
              {booking.guestFirstName} {booking.guestLastName}
            </p>
            <p className="mt-1 break-all text-sm text-slate-600">
              {booking.guestEmail}
            </p>
          </div>

          <div className="border-t border-luxury-stone pt-5 text-sm">
            <div className="flex justify-between gap-3 text-slate-600">
              <span>Total</span>
              <span>{formatMoney(paymentSummary.total, booking.currency)}</span>
            </div>

            <div className="mt-3 flex justify-between gap-3 text-slate-600">
              <span>Paid</span>
              <span>{formatMoney(paymentSummary.paid, booking.currency)}</span>
            </div>

            <div className="mt-4 flex justify-between gap-3 text-lg font-black text-luxury-ink">
              <span>Remaining</span>
              <span>
                {formatMoney(paymentSummary.remaining, booking.currency)}
              </span>
            </div>
          </div>

          <Link
            href={bookingDetailsHref}
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
          >
            Back to booking details
          </Link>
        </div>
      </aside>
    </div>
  );
}