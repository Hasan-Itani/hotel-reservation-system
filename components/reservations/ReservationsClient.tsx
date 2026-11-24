"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import { formatMoney } from "@/lib/frontend/format";
import type {
  AdminReservationSummary,
  Hotel,
  Reservation,
  ReservationResponse,
  ReservationRoom,
  ReservationStatus,
  ReservationStatusAction,
  Room,
} from "@/lib/frontend/types";

type ReservationFilters = {
  status: string;
  guestEmail: string;
  checkInFrom: string;
  checkInTo: string;
  checkOutFrom: string;
  checkOutTo: string;
};

type ReservationsClientProps = {
  hotel: Hotel;
  initialReservations: AdminReservationSummary[];
  rooms: Room[];
  initialFilters: ReservationFilters;
};

type RoomAssignments = Record<string, string>;

type ReservationDetailsState =
  | { id: string; state: "loading" }
  | { id: string; state: "ready"; reservation: Reservation }
  | { id: string; state: "error"; message: string };

type PendingReservationAction = {
  reservation: Reservation;
  action: ReservationStatusAction;
  cancellationReason: string;
};

const reservationStatuses: Array<ReservationStatus | ""> = [
  "",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

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

function getAllowedActions(status: ReservationStatus): ReservationStatusAction[] {
  if (status === "PENDING") {
    return ["CONFIRM", "CANCEL", "NO_SHOW"];
  }

  if (status === "CONFIRMED") {
    return ["CHECK_IN", "CANCEL", "NO_SHOW"];
  }

  if (status === "CHECKED_IN") {
    return ["CHECK_OUT"];
  }

  return [];
}

function getActionLabel(action: ReservationStatusAction) {
  if (action === "CONFIRM") return "Confirm";
  if (action === "CANCEL") return "Cancel";
  if (action === "CHECK_IN") return "Check in";
  if (action === "CHECK_OUT") return "Check out";
  if (action === "NO_SHOW") return "No-show";
  return action;
}

function getActionVariant(
  action: ReservationStatusAction,
): "primary" | "secondary" | "danger" {
  if (action === "CANCEL" || action === "NO_SHOW") return "danger";
  if (action === "CHECK_OUT") return "secondary";
  return "primary";
}

function getGuestName(reservation: AdminReservationSummary) {
  return `${reservation.guestFirstName} ${reservation.guestLastName}`;
}

function getAvailableRoomsForReservationRoom(
  rooms: Room[],
  reservationRoom: ReservationRoom,
) {
  return rooms.filter(
    (room) =>
      room.roomTypeId === reservationRoom.roomTypeId &&
      room.status === "AVAILABLE",
  );
}

function revealCheckInForm(form: HTMLElement | null, panel: HTMLDivElement | null) {
  if (!form) return;

  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
  form.focus({ preventScroll: true });

  if (panel && window.matchMedia("(min-width: 80rem)").matches) {
    panel.scrollBy({
      top: form.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16,
      behavior,
    });
  } else {
    form.scrollIntoView({ block: "start", behavior });
  }
}

export function ReservationsClient({
  hotel,
  initialReservations,
  rooms,
  initialFilters,
}: ReservationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const detailsContentRef = useRef<HTMLDivElement | null>(null);
  const checkInFormRef = useRef<HTMLElement | null>(null);

  const detailsRequest = useRef<AbortController | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [details, setDetails] = useState<ReservationDetailsState | null>(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [checkInReservationId, setCheckInReservationId] = useState("");
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignments>({});
  const [pendingReservationAction, setPendingReservationAction] =
    useState<PendingReservationAction | null>(null);

  useEffect(() => () => detailsRequest.current?.abort(), []);

  useEffect(() => {
    if (checkInReservationId) {
      revealCheckInForm(checkInFormRef.current, detailsContentRef.current);
    }
  }, [checkInReservationId]);

  const selectedReservation = details?.state === "ready" ? details.reservation : null;

  async function selectReservation(reservationId: string) {
    const panel = detailsRef.current;
    if (panel && !window.matchMedia("(min-width: 80rem)").matches) {
      panel.focus({ preventScroll: true });
      const bounds = panel.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) {
        panel.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "start",
        });
      }
    }

    if (details?.id === reservationId && details.state !== "error") return;

    if (detailsContentRef.current) detailsContentRef.current.scrollTop = 0;

    detailsRequest.current?.abort();
    const request = new AbortController();
    detailsRequest.current = request;
    setDetails({ id: reservationId, state: "loading" });
    setError("");
    setCheckInReservationId("");
    setRoomAssignments({});
    setPendingReservationAction(null);

    try {
      const data = await clientFetchJson<ReservationResponse>(
        `/api/admin/hotels/${hotel.id}/reservations/${reservationId}`,
        { signal: request.signal },
      );
      if (!request.signal.aborted) {
        setDetails({ id: reservationId, state: "ready", reservation: data.reservation });
      }
    } catch (caughtError) {
      if (!request.signal.aborted) {
        setDetails({
          id: reservationId,
          state: "error",
          message: caughtError instanceof FrontendApiError
            ? caughtError.message
            : "Unable to load reservation details. Please try again.",
        });
      }
    }
  }

  function updateFilter<Key extends keyof ReservationFilters>(
    key: Key,
    value: ReservationFilters[Key],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams(searchParams.toString());
    params.set("hotelId", hotel.id);

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`/admin/reservations?${params.toString()}`, {
      scroll: false,
    });

    router.refresh();
  }

  function clearFilters() {
    const emptyFilters = {
      status: "",
      guestEmail: "",
      checkInFrom: "",
      checkInTo: "",
      checkOutFrom: "",
      checkOutTo: "",
    };

    setFilters(emptyFilters);

    router.push(`/admin/reservations?hotelId=${hotel.id}`, {
      scroll: false,
    });

    router.refresh();
  }

  function replaceReservation(updatedReservation: Reservation) {
    setDetails((current) =>
      current?.id === updatedReservation.id && current.state === "ready"
        ? { ...current, reservation: { ...updatedReservation, checkInDateReached: current.reservation.checkInDateReached } }
        : current,
    );
  }

  function startCheckIn(reservation: Reservation) {
    if (reservation.checkInDateReached === false) return;

    if (checkInReservationId === reservation.id) {
      revealCheckInForm(checkInFormRef.current, detailsContentRef.current);
      return;
    }

    const nextAssignments: RoomAssignments = {};

    for (const reservationRoom of reservation.reservationRooms) {
      const firstAvailableRoom = getAvailableRoomsForReservationRoom(
        rooms,
        reservationRoom,
      )[0];

      nextAssignments[reservationRoom.id] = firstAvailableRoom?.id || "";
    }

    setError("");
    setPendingReservationAction(null);
    setCheckInReservationId(reservation.id);
    setRoomAssignments(nextAssignments);
  }

  function requestSimpleAction(
    reservation: Reservation,
    action: ReservationStatusAction,
  ) {
    setError("");
    setCheckInReservationId("");
    setRoomAssignments({});
    setPendingReservationAction({
      reservation,
      action,
      cancellationReason: "",
    });
  }

  async function runSimpleAction(
    reservation: Reservation,
    action: ReservationStatusAction,
    cancellationReason = "",
  ) {
    setError("");

    setActionLoading(`${reservation.id}:${action}`);

    try {
      const body: Record<string, unknown> = {
        action,
      };

      if (action === "CANCEL") {
        body.cancellationReason = cancellationReason.trim() || null;
      }

      const data = await clientFetchJson<ReservationResponse>(
        `/api/admin/hotels/${hotel.id}/reservations/${reservation.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );

      replaceReservation(data.reservation);
      setPendingReservationAction(null);
      router.refresh();
    } catch (caughtError: unknown) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to update reservation");
      }
    } finally {
      setActionLoading("");
    }
  }

  async function submitCheckIn(reservation: Reservation) {
    setError("");

    const assignments = reservation.reservationRooms.map((reservationRoom) => ({
      reservationRoomId: reservationRoom.id,
      roomId: roomAssignments[reservationRoom.id] || "",
    }));

    if (assignments.some((assignment) => !assignment.roomId)) {
      setError("Assign a room for every reservation room before check-in");
      return;
    }

    setActionLoading(`${reservation.id}:CHECK_IN`);

    try {
      const data = await clientFetchJson<ReservationResponse>(
        `/api/admin/hotels/${hotel.id}/reservations/${reservation.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action: "CHECK_IN",
            roomAssignments: assignments,
          }),
        },
      );

      replaceReservation(data.reservation);
      setCheckInReservationId("");
      setRoomAssignments({});
      setPendingReservationAction(null);
      router.refresh();
    } catch (caughtError: unknown) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to check in reservation");
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
            Reservations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View reservations, filter them, and run status actions for{" "}
            {hotel.name}.
          </p>
        </div>

        <Badge variant="primary">{hotel.currency}</Badge>
      </section>

      {error ? (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">Filters</h2>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
            onSubmit={applyFilters}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Status
              </span>
              <select
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
              >
                {reservationStatuses.map((status) => (
                  <option key={status || "ALL"} value={status}>
                    {status ? formatStatus(status) : "All statuses"}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Guest Email"
              name="guestEmail"
              type="email"
              value={filters.guestEmail}
              onChange={(event) =>
                updateFilter("guestEmail", event.target.value)
              }
              placeholder="guest@example.com"
            />

            <Input
              label="Check-in From"
              name="checkInFrom"
              type="date"
              value={filters.checkInFrom}
              onChange={(event) =>
                updateFilter("checkInFrom", event.target.value)
              }
            />

            <Input
              label="Check-in To"
              name="checkInTo"
              type="date"
              value={filters.checkInTo}
              onChange={(event) =>
                updateFilter("checkInTo", event.target.value)
              }
            />

            <Input
              label="Check-out From"
              name="checkOutFrom"
              type="date"
              value={filters.checkOutFrom}
              onChange={(event) =>
                updateFilter("checkOutFrom", event.target.value)
              }
            />

            <Input
              label="Check-out To"
              name="checkOutTo"
              type="date"
              value={filters.checkOutTo}
              onChange={(event) =>
                updateFilter("checkOutTo", event.target.value)
              }
            />

            <div className="flex gap-3 md:col-span-2 xl:col-span-6">
              <Button type="submit">Apply Filters</Button>
              <Button type="button" variant="secondary" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start">
        <Card className="min-w-0 xl:col-start-2 xl:row-start-1">
          <CardHeader>
            <h2 className="text-base font-bold text-foreground">Reservation List</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {initialReservations.length} reservation
              {initialReservations.length === 1 ? "" : "s"} found.
            </p>
          </CardHeader>

          <CardContent className="max-h-[60vh] min-w-0 overflow-y-auto">
            {initialReservations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">No reservations found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try changing the filters.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {initialReservations.map((reservation) => (
                  <li key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {reservation.reservationNumber}
                      </p>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {getGuestName(reservation)}
                      </p>
                    </div>
                    <Button
                      variant={details?.id === reservation.id ? "primary" : "secondary"}
                      aria-label={`Details for ${reservation.reservationNumber}, ${getGuestName(reservation)}`}
                      aria-controls="reservation-details"
                      aria-pressed={details?.id === reservation.id}
                      disabled={Boolean(actionLoading)}
                      onClick={() => void selectReservation(reservation.id)}
                    >
                      Details
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div
          ref={detailsRef}
          id="reservation-details"
          role="region"
          aria-labelledby="reservation-details-heading"
          tabIndex={-1}
          className="min-w-0 scroll-mt-24 xl:col-start-1 xl:row-start-1"
        >
          <Card className="min-w-0 xl:flex xl:h-[65vh] xl:flex-col">
            <CardHeader className="shrink-0">
              <h2 id="reservation-details-heading" className="text-base font-bold text-foreground">
                Reservation Details
              </h2>
            </CardHeader>

            <div
              ref={detailsContentRef}
              className="min-h-0 p-5 xl:flex-1 xl:overflow-y-auto"
            >
              {details?.state === "loading" ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading reservation details…
                </p>
              ) : details?.state === "error" ? (
                <div className="space-y-3">
                  <p role="alert" className="text-sm text-danger">{details.message}</p>
                  <Button variant="secondary" onClick={() => void selectReservation(details.id)}>
                    Retry
                  </Button>
                </div>
              ) : !selectedReservation ? (
                <p className="text-sm text-muted-foreground">
                  Select a reservation to view details.
                </p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="break-all text-lg font-bold text-foreground">
                          {selectedReservation.reservationNumber}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {getGuestName(selectedReservation)}
                        </p>
                      </div>

                      <Badge
                        variant={getStatusBadgeVariant(
                          selectedReservation.status,
                        )}
                      >
                        {formatStatus(selectedReservation.status)}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm">
                      <div>
                        <p className="font-medium text-foreground">Contact</p>
                        <p className="break-all text-muted-foreground">
                          {selectedReservation.guestEmail}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedReservation.guestPhone || "-"}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-foreground">Stay</p>
                        <p className="text-muted-foreground">
                          {formatDate(selectedReservation.checkInDate)} →{" "}
                          {formatDate(selectedReservation.checkOutDate)}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedReservation.adults} adult(s),{" "}
                          {selectedReservation.children} child(ren)
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-foreground">Money</p>
                        <p className="text-muted-foreground">
                          Subtotal:{" "}
                          {formatMoney(
                            selectedReservation.subtotal,
                            selectedReservation.currency,
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          Taxes:{" "}
                          {formatMoney(
                            selectedReservation.taxes,
                            selectedReservation.currency,
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          Service fee:{" "}
                          {formatMoney(
                            selectedReservation.serviceFee,
                            selectedReservation.currency,
                          )}
                        </p>
                        <p className="font-semibold text-foreground">
                          Total:{" "}
                          {formatMoney(
                            selectedReservation.total,
                            selectedReservation.currency,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-foreground">Timeline</p>
                        <p className="text-muted-foreground">
                          Confirmed:{" "}
                          {formatDateTime(selectedReservation.confirmedAt)}
                        </p>
                        <p className="text-muted-foreground">
                          Checked in:{" "}
                          {formatDateTime(selectedReservation.checkedInAt)}
                        </p>
                        <p className="text-muted-foreground">
                          Checked out:{" "}
                          {formatDateTime(selectedReservation.checkedOutAt)}
                        </p>
                        <p className="text-muted-foreground">
                          Cancelled:{" "}
                          {formatDateTime(selectedReservation.cancelledAt)}
                        </p>
                        <p className="text-muted-foreground">
                          No-show:{" "}
                          {formatDateTime(selectedReservation.noShowAt)}
                        </p>
                      </div>

                      {selectedReservation.specialRequests ? (
                        <div>
                          <p className="font-medium text-foreground">
                            Special Requests
                          </p>
                          <p className="text-muted-foreground">
                            {selectedReservation.specialRequests}
                          </p>
                        </div>
                      ) : null}

                      {selectedReservation.cancellationReason ? (
                        <div>
                          <p className="font-medium text-foreground">
                            Cancellation Reason
                          </p>
                          <p className="text-muted-foreground">
                            {selectedReservation.cancellationReason}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-border pt-5">
                    <p className="mb-3 text-sm font-bold text-foreground">
                      Reservation Rooms
                    </p>

                    <div className="space-y-3">
                      {selectedReservation.reservationRooms.map(
                        (reservationRoom) => (
                          <div
                            key={reservationRoom.id}
                            className="rounded-xl border border-border bg-surface-muted p-3"
                          >
                            <p className="text-sm font-semibold text-foreground">
                              {reservationRoom.roomType.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Guests: {reservationRoom.guests} | Nightly:{" "}
                              {formatMoney(
                                reservationRoom.nightlyPrice,
                                selectedReservation.currency,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Assigned room:{" "}
                              {reservationRoom.room
                                ? `Room ${reservationRoom.room.roomNumber}`
                                : "Not assigned"}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-5">
                    <p className="mb-3 text-sm font-bold text-foreground">
                      Status Actions
                    </p>

                    {pendingReservationAction?.reservation.id ===
                    selectedReservation.id ? (
                      <div className="mb-4 rounded-xl border border-warning-soft bg-warning-soft/50 p-4">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground">
                              Apply{" "}
                              {getActionLabel(pendingReservationAction.action)}{" "}
                              to reservation{" "}
                              {
                                pendingReservationAction.reservation
                                  .reservationNumber
                              }
                              ?
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              This updates the reservation status immediately.
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => setPendingReservationAction(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant={getActionVariant(
                                pendingReservationAction.action,
                              )}
                              onClick={() =>
                                runSimpleAction(
                                  pendingReservationAction.reservation,
                                  pendingReservationAction.action,
                                  pendingReservationAction.cancellationReason,
                                )
                              }
                              disabled={
                                actionLoading ===
                                `${pendingReservationAction.reservation.id}:${pendingReservationAction.action}`
                              }
                            >
                              {actionLoading ===
                              `${pendingReservationAction.reservation.id}:${pendingReservationAction.action}`
                                ? "Working..."
                                : getActionLabel(
                                    pendingReservationAction.action,
                                  )}
                            </Button>
                          </div>
                        </div>

                        {pendingReservationAction.action === "CANCEL" ? (
                          <label className="mt-4 block">
                            <span className="mb-2 block text-sm font-medium text-foreground">
                              Cancellation reason
                            </span>
                            <textarea
                              value={
                                pendingReservationAction.cancellationReason
                              }
                              onChange={(event) =>
                                setPendingReservationAction((current) =>
                                  current
                                    ? {
                                        ...current,
                                        cancellationReason:
                                          event.target.value,
                                      }
                                    : current,
                                )
                              }
                              placeholder="Optional internal cancellation reason"
                              className="min-h-24 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary-soft"
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedReservation.checkInDateReached === false && getAllowedActions(selectedReservation.status).includes("CHECK_IN") ? (
                      <p className="mb-2 text-sm text-muted-foreground">
                        Check-in opens on the scheduled arrival date.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {getAllowedActions(selectedReservation.status).length ===
                      0 ? (
                        <p className="text-sm text-muted-foreground">
                          No actions available for this status.
                        </p>
                      ) : (
                        getAllowedActions(selectedReservation.status).map(
                          (action) =>
                            action === "CHECK_IN" ? (
                              <Button
                                key={action}
                                onClick={() => startCheckIn(selectedReservation)}
                                disabled={
                                  selectedReservation.checkInDateReached === false ||
                                  actionLoading ===
                                  `${selectedReservation.id}:${action}`
                                }
                              >
                                Check in
                              </Button>
                            ) : (
                              <Button
                                key={action}
                                variant={getActionVariant(action)}
                                onClick={() =>
                                  requestSimpleAction(
                                    selectedReservation,
                                    action,
                                  )
                                }
                                disabled={
                                  actionLoading ===
                                  `${selectedReservation.id}:${action}`
                                }
                              >
                                {actionLoading ===
                                `${selectedReservation.id}:${action}`
                                  ? "Working..."
                                  : getActionLabel(action)}
                              </Button>
                            ),
                        )
                      )}
                    </div>
                  </div>

                  {checkInReservationId === selectedReservation.id ? (
                    <section
                      ref={checkInFormRef}
                      tabIndex={-1}
                      aria-labelledby="check-in-room-assignments"
                      className="scroll-mt-24 rounded-xl border border-border bg-surface-muted p-4"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 id="check-in-room-assignments" className="text-sm font-bold text-foreground">
                            Room Assignments for Check-in
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Every reservation room must get an AVAILABLE
                            physical room of the same room type.
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          onClick={() => {
                            setCheckInReservationId("");
                            setRoomAssignments({});
                          }}
                        >
                          Cancel
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {selectedReservation.reservationRooms.map(
                          (reservationRoom) => {
                            const availableRooms =
                              getAvailableRoomsForReservationRoom(
                                rooms,
                                reservationRoom,
                              );

                            return (
                              <label
                                key={reservationRoom.id}
                                className="block"
                              >
                                <span className="mb-2 block text-sm font-medium text-foreground">
                                  {reservationRoom.roomType.name}
                                </span>

                                <p className="mb-2 text-xs text-muted-foreground">
                                  {availableRooms.length} available room
                                  {availableRooms.length === 1 ? "" : "s"} found
                                  for this room type. Backend will validate again
                                  on check-in.
                                </p>

                                <select
                                  value={
                                    roomAssignments[reservationRoom.id] || ""
                                  }
                                  onChange={(event) =>
                                    setRoomAssignments((current) => ({
                                      ...current,
                                      [reservationRoom.id]: event.target.value,
                                    }))
                                  }
                                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                >
                                  <option value="">Select room</option>
                                  {availableRooms.map((room) => (
                                    <option key={room.id} value={room.id}>
                                      Room {room.roomNumber}
                                      {room.floor !== null
                                        ? ` — Floor ${room.floor}`
                                        : ""}{" "}
                                      — AVAILABLE
                                    </option>
                                  ))}
                                </select>

                                {availableRooms.length === 0 ? (
                                  <p className="mt-2 text-xs text-danger">
                                    No available room exists for this room type.
                                  </p>
                                ) : null}
                              </label>
                            );
                          },
                        )}

                        <Button
                          onClick={() => submitCheckIn(selectedReservation)}
                          disabled={
                            actionLoading ===
                            `${selectedReservation.id}:CHECK_IN`
                          }
                        >
                          {actionLoading ===
                          `${selectedReservation.id}:CHECK_IN`
                            ? "Checking in..."
                            : "Confirm Check-in"}
                        </Button>
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
