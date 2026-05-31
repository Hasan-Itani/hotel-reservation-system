"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Pay booking
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete payment for reservation {booking.reservationNumber}.
              </p>
            </div>

            <Badge variant={getStatusBadgeVariant(reservationStatus)}>
              {formatStatus(reservationStatus)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {resultMessage ? (
            <div
              className={[
                "mb-5 rounded-xl border px-4 py-4 text-sm font-medium",
                lastPaymentStatus === "PAID"
                  ? "border-success-soft bg-success-soft text-success"
                  : "border-danger-soft bg-danger-soft text-danger",
              ].join(" ")}
            >
              <p>{resultMessage}</p>

              {lastPaymentStatus === "PAID" ? (
                <Link
                  href={bookingDetailsHref}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-success transition hover:brightness-95"
                >
                  View booking details
                </Link>
              ) : null}
            </div>
          ) : null}

          {!canPay ? (
            <div className="rounded-xl border border-border bg-surface-muted px-4 py-6">
              <p className="text-sm font-bold text-foreground">
                Payment is not available
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {remaining <= 0
                  ? "This booking is fully paid."
                  : "This booking status does not allow new payments."}
              </p>

              <Link
                href={bookingDetailsHref}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
              >
                Back to booking details
              </Link>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={submitPayment}>
              <Input
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
              />

              <Input
                label="Card Holder Name"
                name="cardHolderName"
                value={form.cardHolderName}
                onChange={(event) =>
                  updateForm("cardHolderName", event.target.value)
                }
                required
              />

              <Input
                label="Card Number"
                name="cardNumber"
                value={form.cardNumber}
                onChange={(event) =>
                  updateForm("cardNumber", event.target.value)
                }
                placeholder="4242424242424242"
                required
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Expiry Month"
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

                <Input
                  label="Expiry Year"
                  name="expiryYear"
                  type="number"
                  min="2026"
                  max="2100"
                  value={form.expiryYear}
                  onChange={(event) =>
                    updateForm("expiryYear", event.target.value)
                  }
                  required
                />

                <Input
                  label="CVV"
                  name="cvv"
                  value={form.cvv}
                  onChange={(event) => updateForm("cvv", event.target.value)}
                  required
                />
              </div>

              <div className="rounded-xl border border-warning-soft bg-warning-soft px-4 py-3 text-sm text-warning">
                Test card: <strong>4242424242424242</strong>. Failed card:
                <strong> 4000000000000002</strong>.
              </div>

              <Button type="submit" className="h-11" disabled={isSubmitting}>
                {isSubmitting ? "Processing..." : "Pay booking"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-24">
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">
            Payment summary
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.hotel?.name || "Hotel booking"}
          </p>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            <div className="rounded-xl bg-surface-muted px-4 py-3">
              <p className="text-xs text-muted-foreground">Reservation</p>
              <p className="mt-1 break-all text-sm font-bold text-foreground">
                {booking.reservationNumber}
              </p>
            </div>

            <div className="rounded-xl bg-surface-muted px-4 py-3">
              <p className="text-xs text-muted-foreground">Guest</p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {booking.guestFirstName} {booking.guestLastName}
              </p>
              <p className="break-all text-sm text-muted-foreground">
                {booking.guestEmail}
              </p>
            </div>

            <div className="border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3 text-muted-foreground">
                <span>Total</span>
                <span>{formatMoney(paymentSummary.total, booking.currency)}</span>
              </div>

              <div className="mt-2 flex justify-between gap-3 text-muted-foreground">
                <span>Paid</span>
                <span>{formatMoney(paymentSummary.paid, booking.currency)}</span>
              </div>

              <div className="mt-2 flex justify-between gap-3 text-base font-bold text-foreground">
                <span>Remaining</span>
                <span>
                  {formatMoney(paymentSummary.remaining, booking.currency)}
                </span>
              </div>
            </div>

            <Link
              href={bookingDetailsHref}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
            >
              Back to booking details
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}