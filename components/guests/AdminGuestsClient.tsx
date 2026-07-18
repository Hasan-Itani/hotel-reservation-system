"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { clientFetchJson } from "@/lib/frontend/api-client";
import { formatMoney } from "@/lib/frontend/format";
import type {
  AdminGuestUnlockResponse,
  AdminGuestListItem,
  Hotel,
  ReservationStatus,
} from "@/lib/frontend/types";

type AdminGuestsClientProps = {
  hotel: Hotel;
  initialGuests: AdminGuestListItem[];
  canUnlockGuestAccounts: boolean;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

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

function formatStatus(status: ReservationStatus | string) {
  return status.replaceAll("_", " ");
}

function getStatusBadgeVariant(
  status: ReservationStatus | string,
): "success" | "warning" | "danger" | "primary" | "default" {
  if (status === "PENDING") return "warning";
  if (status === "CONFIRMED") return "primary";
  if (status === "CHECKED_IN") return "success";
  if (status === "CHECKED_OUT") return "default";
  if (status === "CANCELLED") return "danger";
  if (status === "NO_SHOW") return "danger";
  return "default";
}

export function AdminGuestsClient({
  hotel,
  initialGuests,
  canUnlockGuestAccounts,
}: AdminGuestsClientProps) {
  const [guests, setGuests] = useState(initialGuests);
  const [search, setSearch] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  const filteredGuests = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return guests;
    }

    return guests.filter((guest) => {
      const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();

      return (
        fullName.includes(value) ||
        guest.email.toLowerCase().includes(value) ||
        (guest.phone || "").toLowerCase().includes(value)
      );
    });
  }, [guests, search]);

  async function handleUnlock(guest: AdminGuestListItem) {
    if (!canUnlockGuestAccounts || !guest.userId || !guest.canUnlock) {
      return;
    }

    setActionMessage("");
    setActionError("");
    setUnlockingUserId(guest.userId);

    try {
      const data = await clientFetchJson<AdminGuestUnlockResponse>(
        `/api/admin/hotels/${hotel.id}/guests/${guest.userId}/unlock`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      setGuests((currentGuests) =>
        currentGuests.map((item) =>
          item.userId === data.guest.id
            ? {
                ...item,
                failedLoginAttempts: data.guest.failedLoginAttempts,
                lockedUntil: data.guest.lockedUntil,
                canUnlock: false,
              }
            : item,
        ),
      );
      setActionMessage(data.message);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to unlock account",
      );
    } finally {
      setUnlockingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Guests
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            View guest accounts and reservation history for {hotel.name}.
          </p>
        </div>

        <Badge variant="primary">
          {guests.length} guest{guests.length === 1 ? "" : "s"}
        </Badge>
      </section>

      {actionMessage ? (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {actionMessage}
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {actionError}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">Search</h2>
        </CardHeader>

        <CardContent>
          <Input
            label="Search guests"
            name="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or phone"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Guest List
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredGuests.length} result
                {filteredGuests.length === 1 ? "" : "s"} found.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-w-0">
          {filteredGuests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                No guests found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Guests appear here after they create reservations for this hotel.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {filteredGuests.map((guest) => (
                  <div
                    key={guest.key}
                    className="rounded-xl border border-border bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-foreground">
                          {guest.firstName} {guest.lastName}
                        </p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {guest.email}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {guest.phone || "No phone"}
                        </p>
                      </div>

                      <Badge variant={guest.accountLinked ? "success" : "warning"}>
                        {guest.accountLinked ? "Account" : "Fallback"}
                      </Badge>
                    </div>

                    {guest.lockedUntil ? (
                      <div className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-3 py-3">
                        <p className="text-xs font-bold text-danger">
                          Account locked until {formatDateTime(guest.lockedUntil)}
                        </p>
                        {canUnlockGuestAccounts &&
                        guest.canUnlock &&
                        guest.userId ? (
                          <Button
                            variant="secondary"
                            className="mt-3 w-full"
                            disabled={unlockingUserId === guest.userId}
                            onClick={() => handleUnlock(guest)}
                          >
                            {unlockingUserId === guest.userId
                              ? "Unlocking..."
                              : "Unlock account"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-surface-muted px-3 py-3">
                        <p className="text-muted-foreground">Reservations</p>
                        <p className="mt-1 font-bold text-foreground">
                          {guest.totalReservations}
                        </p>
                      </div>

                      <div className="rounded-xl bg-surface-muted px-3 py-3">
                        <p className="text-muted-foreground">Paid</p>
                        <p className="mt-1 font-bold text-foreground">
                          {formatMoney(
                            guest.totalPaid,
                            guest.latestReservation?.currency || hotel.currency,
                          )}
                        </p>
                      </div>
                    </div>

                    {guest.latestReservation ? (
                      <div className="mt-4 rounded-xl border border-border p-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-foreground">
                              Latest reservation
                            </p>
                            <p className="mt-1 break-all text-muted-foreground">
                              {guest.latestReservation.reservationNumber}
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {formatDate(guest.latestReservation.checkInDate)} →{" "}
                              {formatDate(guest.latestReservation.checkOutDate)}
                            </p>
                          </div>

                          <Badge
                            variant={getStatusBadgeVariant(
                              guest.latestReservation.status,
                            )}
                          >
                            {formatStatus(guest.latestReservation.status)}
                          </Badge>
                        </div>

                        <Link
                          href={`/admin/reservations?hotelId=${hotel.id}&guestEmail=${encodeURIComponent(
                            guest.email,
                          )}`}
                          className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-white"
                        >
                          View reservations
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-semibold">Guest</th>
                      <th className="py-3 pr-4 font-semibold">Account</th>
                      <th className="py-3 pr-4 font-semibold">Reservations</th>
                      <th className="py-3 pr-4 font-semibold">Paid</th>
                      <th className="py-3 pr-4 font-semibold">Latest</th>
                      <th className="w-48 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredGuests.map((guest) => (
                      <tr key={guest.key} className="border-b border-border">
                        <td className="py-4 pr-4 align-top">
                          <p className="font-semibold text-foreground">
                            {guest.firstName} {guest.lastName}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {guest.email}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {guest.phone || "No phone"}
                          </p>
                        </td>

                        <td className="py-4 pr-4 align-top">
                          <Badge
                            variant={guest.accountLinked ? "success" : "warning"}
                          >
                            {guest.accountLinked ? "Linked account" : "Fallback"}
                          </Badge>
                          {guest.accountCreatedAt ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Joined {formatDate(guest.accountCreatedAt)}
                            </p>
                          ) : null}
                          {guest.lockedUntil ? (
                            <p className="mt-2 text-xs font-semibold text-danger">
                              Locked until {formatDateTime(guest.lockedUntil)}
                            </p>
                          ) : null}
                        </td>

                        <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                          <p className="font-bold text-foreground">
                            {guest.totalReservations}
                          </p>
                          <p>
                            Booked{" "}
                            {formatMoney(
                              guest.totalBooked,
                              guest.latestReservation?.currency ||
                                hotel.currency,
                            )}
                          </p>
                        </td>

                        <td className="py-4 pr-4 align-top text-sm font-semibold text-foreground">
                          {formatMoney(
                            guest.totalPaid,
                            guest.latestReservation?.currency || hotel.currency,
                          )}
                        </td>

                        <td className="py-4 pr-4 align-top">
                          {guest.latestReservation ? (
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant={getStatusBadgeVariant(
                                    guest.latestReservation.status,
                                  )}
                                >
                                  {formatStatus(guest.latestReservation.status)}
                                </Badge>
                              </div>
                              <p className="mt-2 break-all text-xs font-semibold text-foreground">
                                {guest.latestReservation.reservationNumber}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(
                                  guest.latestReservation.checkInDate,
                                )}{" "}
                                →{" "}
                                {formatDate(
                                  guest.latestReservation.checkOutDate,
                                )}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              -
                            </span>
                          )}
                        </td>

                        <td className="w-48 py-4 text-right align-top">
                          <div className="ml-auto flex w-48 flex-col gap-2">
                            {canUnlockGuestAccounts &&
                            guest.canUnlock &&
                            guest.userId ? (
                              <Button
                                variant="secondary"
                                className="w-full whitespace-nowrap"
                                disabled={unlockingUserId === guest.userId}
                                onClick={() => handleUnlock(guest)}
                              >
                                {unlockingUserId === guest.userId
                                  ? "Unlocking..."
                                  : "Unlock account"}
                              </Button>
                            ) : null}

                            <Link
                              href={`/admin/reservations?hotelId=${hotel.id}&guestEmail=${encodeURIComponent(
                                guest.email,
                              )}`}
                              className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                            >
                              View reservations
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
