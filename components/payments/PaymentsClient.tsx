"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import { decimalToNumber, formatMoney } from "@/lib/frontend/format";
import type {
  Hotel,
  Payment,
  PaymentMutationResponse,
  PaymentReservationSummary,
  PaymentStatus,
  PaymentStatusAction,
  Reservation,
  ReservationPaymentsResponse,
} from "@/lib/frontend/types";

type PaymentsClientProps = {
  hotel: Hotel;
  reservations: Reservation[];
  initialPaymentReservation: ReservationPaymentsResponse["reservation"] | null;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function getPaymentBadgeVariant(
  status: PaymentStatus,
): "success" | "warning" | "danger" | "primary" | "default" {
  if (status === "PAID") return "success";
  if (status === "PENDING") return "warning";
  if (status === "FAILED") return "danger";
  if (status === "REFUNDED") return "default";
  if (status === "PARTIALLY_REFUNDED") return "primary";
  return "default";
}

function getReservationBadgeVariant(
  status: string,
): "success" | "warning" | "danger" | "primary" | "default" {
  if (status === "PENDING") return "warning";
  if (status === "CONFIRMED") return "primary";
  if (status === "CHECKED_IN") return "success";
  if (status === "CHECKED_OUT") return "default";
  if (status === "CANCELLED") return "danger";
  if (status === "NO_SHOW") return "danger";
  return "default";
}

function calculatePaidAmount(payments: Payment[]) {
  return payments.reduce((sum, payment) => {
    if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
      return sum;
    }

    return sum + (decimalToNumber(payment.amount) || 0);
  }, 0);
}

function calculateRemainingBalance(
  reservation: PaymentReservationSummary | null,
) {
  if (!reservation) return 0;

  const total = decimalToNumber(reservation.total) || 0;
  const paid = calculatePaidAmount(reservation.payments || []);
  const remaining = total - paid;

  return remaining > 0 ? remaining : 0;
}

function isFinalReservationStatus(status: string) {
  return ["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(status);
}

function getAllowedPaymentActions(
  payment: Payment,
  reservationStatus: string
): PaymentStatusAction[] {
  const reservationIsFinal = isFinalReservationStatus(reservationStatus);

  if (payment.status === "PENDING") {
    return reservationIsFinal ? [] : ["MARK_PAID", "MARK_FAILED"];
  }

  if (payment.status === "FAILED") {
    return reservationIsFinal ? [] : ["MARK_PAID"];
  }

  if (payment.status === "PAID") {
    return ["MARK_REFUNDED"];
  }

  if (payment.status === "PARTIALLY_REFUNDED") {
    return ["MARK_REFUNDED"];
  }

  return [];
}

function getActionLabel(action: PaymentStatusAction) {
  if (action === "MARK_PAID") return "Mark paid";
  if (action === "MARK_FAILED") return "Mark failed";
  if (action === "MARK_REFUNDED") return "Refund";
  if (action === "MARK_PARTIALLY_REFUNDED") return "Partial refund";
  return action;
}

function getActionVariant(
  action: PaymentStatusAction,
): "primary" | "secondary" | "danger" {
  if (action === "MARK_FAILED" || action === "MARK_REFUNDED") return "danger";
  if (action === "MARK_PARTIALLY_REFUNDED") return "secondary";
  return "primary";
}

function canAcceptNewPayment(status: string) {
  return ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(status);
}

export function PaymentsClient({
  hotel,
  reservations,
  initialPaymentReservation,
}: PaymentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentDetailsRef = useRef<HTMLDivElement | null>(null);

  const [paymentReservation, setPaymentReservation] =
    useState(initialPaymentReservation);
  const [selectedReservationId, setSelectedReservationId] = useState(
    initialPaymentReservation?.id || reservations[0]?.id || "",
  );
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoadingReservation, setIsLoadingReservation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState("");



  const sortedReservations = useMemo(() => {
    return [...reservations].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [reservations]);

  const payments = paymentReservation?.payments || [];
  const paidAmount = calculatePaidAmount(payments);
  const remainingBalance = calculateRemainingBalance(paymentReservation);

  function scrollToPaymentDetails() {
    window.setTimeout(() => {
      paymentDetailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function updateForm<Key extends keyof PaymentFormState>(
    key: Key,
    value: PaymentFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function loadReservationPayments(reservationId: string) {
    setSelectedReservationId(reservationId);
    setError("");
    setIsLoadingReservation(true);
    setIsFormOpen(false);

    const params = new URLSearchParams(searchParams.toString());
    params.set("hotelId", hotel.id);
    params.set("reservationId", reservationId);

    router.push(`/admin/payments?${params.toString()}`, {
      scroll: false,
    });

    try {
      const data = await clientFetchJson<ReservationPaymentsResponse>(
        `/api/admin/hotels/${hotel.id}/reservations/${reservationId}/payments`,
      );

      setPaymentReservation(data.reservation);
      scrollToPaymentDetails();
    } catch (caughtError: unknown) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to load reservation payments");
      }
    } finally {
      setIsLoadingReservation(false);
    }
  }

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedReservationId) {
      setError("Select a reservation first");
      return;
    }

    if (!paymentReservation) {
      setError("Load a reservation before creating payment");
      return;
    }

    if (!canAcceptNewPayment(paymentReservation.status)) {
      setError("This reservation status does not allow accepting payment");
      return;
    }

    if (remainingBalance <= 0) {
      setError("This reservation is already fully paid");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        cardHolderName: form.cardHolderName.trim(),
        cardNumber: form.cardNumber.trim(),
        expiryMonth: Number(form.expiryMonth),
        expiryYear: Number(form.expiryYear),
        cvv: form.cvv.trim(),
      };

      if (form.amount.trim()) {
        body.amount = Number(form.amount);
      }

      const data = await clientFetchJson<PaymentMutationResponse>(
        `/api/admin/hotels/${hotel.id}/reservations/${selectedReservationId}/payments`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      setPaymentReservation((current) => {
        if (!current) return current;

        return {
          ...current,
          status: data.reservation?.status || current.status,
          payments: [data.payment, ...current.payments],
        };
      });

      setForm(emptyForm);
      setIsFormOpen(false);
      router.refresh();
    } catch (caughtError: unknown) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to create payment");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updatePaymentStatus(payment: Payment, action: PaymentStatusAction) {
    const confirmed = window.confirm(
      `Apply "${getActionLabel(action)}" to this payment?`,
    );

    if (!confirmed) return;

    setError("");
    setActionLoading(`${payment.id}:${action}`);

    try {
      const data = await clientFetchJson<PaymentMutationResponse>(
        `/api/admin/hotels/${hotel.id}/reservations/${selectedReservationId}/payments/${payment.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action }),
        },
      );

      setPaymentReservation((current) => {
        if (!current) return current;

        return {
          ...current,
          status: data.reservation?.status || current.status,
          payments: current.payments.map((item) =>
            item.id === data.payment.id ? data.payment : item,
          ),
        };
      });

      router.refresh();
    } catch (caughtError: unknown) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to update payment");
      }
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage reservation payments for {hotel.name}.
          </p>
        </div>

        <Badge variant="primary">{hotel.currency}</Badge>
      </section>

      {error ? (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.05fr)] xl:items-start">
        <Card className="min-w-0 xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
          <CardHeader>
            <h2 className="text-base font-bold text-foreground">
              Reservations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a reservation to view and create payments.
            </p>
          </CardHeader>

          <CardContent className="min-w-0 xl:max-h-[calc(100vh-15rem)] xl:overflow-y-auto">
            {sortedReservations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No reservations found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payments require an existing reservation.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedReservations.map((reservation) => {
                  const isSelected = reservation.id === selectedReservationId;

                  return (
                    <button
                      key={reservation.id}
                      type="button"
                      onClick={() => loadReservationPayments(reservation.id)}
                      className={[
                        "w-full rounded-xl border px-4 py-3 text-left transition",
                        isSelected
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-white hover:bg-surface-muted",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {reservation.reservationNumber}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {reservation.guestFirstName}{" "}
                            {reservation.guestLastName}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {reservation.guestEmail}
                          </p>
                        </div>

                        <Badge variant={getReservationBadgeVariant(reservation.status)}>
                          {formatStatus(reservation.status)}
                        </Badge>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {formatMoney(reservation.total, reservation.currency)}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-primary">
                        Tap to view payment details
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div ref={paymentDetailsRef} className="min-w-0">
          <Card className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Payment Details
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {paymentReservation
                      ? paymentReservation.reservationNumber
                      : "Select a reservation"}
                  </p>
                </div>

                {paymentReservation ? (
                  <Badge variant={getReservationBadgeVariant(paymentReservation.status)}>
                    {formatStatus(paymentReservation.status)}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              {isLoadingReservation ? (
                <p className="text-sm text-muted-foreground">Loading payments...</p>
              ) : !paymentReservation ? (
                <p className="text-sm text-muted-foreground">
                  Select a reservation to view payments.
                </p>
              ) : (
                <div className="space-y-6">
                  <section className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-surface-muted p-4">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Total
                      </p>
                      <p className="mt-2 text-lg font-bold text-foreground">
                        {formatMoney(paymentReservation.total, paymentReservation.currency)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface-muted p-4">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Paid
                      </p>
                      <p className="mt-2 text-lg font-bold text-foreground">
                        {formatMoney(paidAmount, paymentReservation.currency)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface-muted p-4">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Remaining
                      </p>
                      <p className="mt-2 text-lg font-bold text-foreground">
                        {formatMoney(remainingBalance, paymentReservation.currency)}
                      </p>
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          Add Mock Card Payment
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Leave amount empty to pay remaining balance. Cards ending
                          with 0000 fail.
                        </p>
                      </div>

                      <Button
                        onClick={() => setIsFormOpen((current) => !current)}
                        disabled={
                          !canAcceptNewPayment(paymentReservation.status) ||
                          remainingBalance <= 0
                        }
                        title={
                          remainingBalance <= 0
                            ? "This reservation is already fully paid"
                            : !canAcceptNewPayment(paymentReservation.status)
                              ? "This reservation status does not allow new payments"
                              : "Create payment"
                        }
                      >
                        {isFormOpen ? "Close" : "New Payment"}
                      </Button>
                    </div>

                    {isFormOpen ? (
                      <form className="grid gap-4 sm:grid-cols-2" onSubmit={createPayment}>
                        <Input
                          label={`Amount (${paymentReservation.currency})`}
                          name="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.amount}
                          onChange={(event) => updateForm("amount", event.target.value)}
                          placeholder={String(remainingBalance || "")}
                        />

                        <Input
                          label="Card Holder Name"
                          name="cardHolderName"
                          required
                          value={form.cardHolderName}
                          onChange={(event) =>
                            updateForm("cardHolderName", event.target.value)
                          }
                          placeholder="Maya Khoury"
                        />

                        <Input
                          label="Card Number"
                          name="cardNumber"
                          required
                          value={form.cardNumber}
                          onChange={(event) =>
                            updateForm("cardNumber", event.target.value)
                          }
                          placeholder="4242424242424242"
                        />

                        <Input
                          label="CVV"
                          name="cvv"
                          required
                          value={form.cvv}
                          onChange={(event) => updateForm("cvv", event.target.value)}
                          placeholder="123"
                        />

                        <Input
                          label="Expiry Month"
                          name="expiryMonth"
                          type="number"
                          min="1"
                          max="12"
                          required
                          value={form.expiryMonth}
                          onChange={(event) =>
                            updateForm("expiryMonth", event.target.value)
                          }
                        />

                        <Input
                          label="Expiry Year"
                          name="expiryYear"
                          type="number"
                          min="2026"
                          max="2100"
                          required
                          value={form.expiryYear}
                          onChange={(event) =>
                            updateForm("expiryYear", event.target.value)
                          }
                        />

                        <div className="flex gap-3 sm:col-span-2">
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Processing..." : "Create Payment"}
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setForm(emptyForm)}
                          >
                            Reset
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </section>

                  <section className="border-t border-border pt-5">
                    <p className="mb-3 text-sm font-bold text-foreground">
                      Payments
                    </p>

                    {payments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-foreground">
                          No payments yet
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add a mock payment for this reservation.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="rounded-xl border border-border bg-white p-4"
                          >
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                              <div>
                                <p className="text-sm font-bold text-foreground">
                                  {formatMoney(payment.amount, payment.currency)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {payment.provider}{" "}
                                  {payment.methodLabel ? `• ${payment.methodLabel}` : ""}
                                  {payment.cardLast4 ? ` • **** ${payment.cardLast4}` : ""}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Created: {formatDateTime(payment.createdAt)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Paid: {formatDateTime(payment.paidAt)}
                                </p>
                                {payment.providerReference ? (
                                  <p className="mt-1 break-all text-xs text-muted-foreground">
                                    Ref: {payment.providerReference}
                                  </p>
                                ) : null}
                              </div>

                              <Badge variant={getPaymentBadgeVariant(payment.status)}>
                                {formatStatus(payment.status)}
                              </Badge>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {getAllowedPaymentActions(payment, paymentReservation.status).length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No actions available.
                                </p>
                              ) : (
                                getAllowedPaymentActions(payment, paymentReservation.status).map((action) => (
                                  <Button
                                    key={action}
                                    variant={getActionVariant(action)}
                                    onClick={() => updatePaymentStatus(payment, action)}
                                    disabled={actionLoading === `${payment.id}:${action}`}
                                  >
                                    {actionLoading === `${payment.id}:${action}`
                                      ? "Working..."
                                      : getActionLabel(action)}
                                  </Button>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}