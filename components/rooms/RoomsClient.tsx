"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import { formatMoney } from "@/lib/frontend/format";
import type {
  DeletedRoomResponse,
  Hotel,
  ManageableRoomStatus,
  Room,
  RoomResponse,
  RoomStatus,
  RoomType,
} from "@/lib/frontend/types";

type RoomsClientProps = {
  hotel: Hotel;
  initialRooms: Room[];
  roomTypes: RoomType[];
};

type RoomFormState = {
  id?: string;
  roomTypeId: string;
  roomNumber: string;
  floor: string;
  status: RoomStatus;
  notes: string;
};

const manageableStatuses: ManageableRoomStatus[] = [
  "AVAILABLE",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
  "CLEANING",
];

function createEmptyForm(defaultRoomTypeId: string): RoomFormState {
  return {
    roomTypeId: defaultRoomTypeId,
    roomNumber: "",
    floor: "",
    status: "AVAILABLE",
    notes: "",
  };
}

function nullableNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const numberValue = Number(trimmed);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function nullableString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function roomToForm(room: Room): RoomFormState {
  return {
    id: room.id,
    roomTypeId: room.roomTypeId,
    roomNumber: room.roomNumber,
    floor: room.floor === null ? "" : String(room.floor),
    status: room.status,
    notes: room.notes || "",
  };
}

function getStatusBadgeVariant(
  status: RoomStatus
): "success" | "warning" | "danger" | "primary" | "default" {
  if (status === "AVAILABLE") return "success";
  if (status === "CLEANING") return "primary";
  if (status === "MAINTENANCE") return "warning";
  if (status === "OUT_OF_SERVICE") return "danger";
  if (status === "OCCUPIED") return "default";
  return "default";
}

function formatStatus(status: RoomStatus) {
  return status.replaceAll("_", " ");
}

export function RoomsClient({
  hotel,
  initialRooms,
  roomTypes,
}: RoomsClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);

  const defaultRoomTypeId = roomTypes[0]?.id || "";

  const [rooms, setRooms] = useState(initialRooms);
  const [form, setForm] = useState<RoomFormState>(
    createEmptyForm(defaultRoomTypeId)
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const isEditing = !!form.id;

  const editingRoom = useMemo(() => {
    if (!form.id) return null;
    return rooms.find((room) => room.id === form.id) || null;
  }, [form.id, rooms]);

  const isEditingOccupiedRoom = editingRoom?.status === "OCCUPIED";

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const floorA = a.floor ?? 999999;
      const floorB = b.floor ?? 999999;

      if (floorA !== floorB) {
        return floorA - floorB;
      }

      return a.roomNumber.localeCompare(b.roomNumber, undefined, {
        numeric: true,
      });
    });
  }, [rooms]);

  function scrollToForm() {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function updateForm<Key extends keyof RoomFormState>(
    key: Key,
    value: RoomFormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreateForm() {
    setError("");
    setForm(createEmptyForm(defaultRoomTypeId));
    setIsFormOpen(true);
    scrollToForm();
  }

  function openEditForm(room: Room) {
    setError("");
    setForm(roomToForm(room));
    setIsFormOpen(true);
    scrollToForm();
  }

  function closeForm() {
    setError("");
    setForm(createEmptyForm(defaultRoomTypeId));
    setIsFormOpen(false);
  }

  function buildCreatePayload() {
    const payload: Record<string, unknown> = {
      roomTypeId: form.roomTypeId,
      roomNumber: form.roomNumber.trim(),
      floor: nullableNumber(form.floor),
      status: form.status,
    };

    const notes = optionalString(form.notes);

    if (notes) {
      payload.notes = notes;
    }

    return payload;
  }

  function buildUpdatePayload() {
    const payload: Record<string, unknown> = {
      floor: nullableNumber(form.floor),
      notes: nullableString(form.notes),
    };

    if (!isEditingOccupiedRoom) {
      payload.roomTypeId = form.roomTypeId;
      payload.roomNumber = form.roomNumber.trim();

      if (form.status !== "OCCUPIED") {
        payload.status = form.status;
      }
    }

    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (roomTypes.length === 0) {
      setError("Create a room type before creating rooms");
      return;
    }

    if (!form.roomTypeId) {
      setError("Room type is required");
      return;
    }

    if (!form.roomNumber.trim()) {
      setError("Room number is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && form.id) {
        const data = await clientFetchJson<RoomResponse>(
          `/api/admin/hotels/${hotel.id}/rooms/${form.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(buildUpdatePayload()),
          }
        );

        setRooms((current) =>
          current.map((room) => (room.id === data.room.id ? data.room : room))
        );
      } else {
        const data = await clientFetchJson<RoomResponse>(
          `/api/admin/hotels/${hotel.id}/rooms`,
          {
            method: "POST",
            body: JSON.stringify(buildCreatePayload()),
          }
        );

        setRooms((current) => [...current, data.room]);
      }

      closeForm();
      router.refresh();
    } catch (caughtError: unknown) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to save room");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteRoom(room: Room) {
    const confirmed = window.confirm(
      `Delete room "${room.roomNumber}"? This will fail if the room is not AVAILABLE or has reservation history.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(room.id);
    setError("");

    try {
      await clientFetchJson<DeletedRoomResponse>(
        `/api/admin/hotels/${hotel.id}/rooms/${room.id}`,
        {
          method: "DELETE",
        }
      );

      setRooms((current) => current.filter((item) => item.id !== room.id));
      router.refresh();
    } catch (caughtError: unknown) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to delete room");
      }
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Rooms
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage room numbers, room types, floors, statuses, and notes for{" "}
            {hotel.name}.
          </p>
        </div>

        <Button onClick={openCreateForm} disabled={roomTypes.length === 0}>
          New Room
        </Button>
      </section>

      {roomTypes.length === 0 ? (
        <div className="rounded-xl border border-warning-soft bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          Create at least one room type before creating rooms.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      {isFormOpen ? (
        <div ref={formRef}>
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {isEditing ? "Edit Room" : "Create Room"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    OCCUPIED is controlled by reservations and cannot be set
                    manually.
                  </p>
                </div>

                <Button variant="ghost" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    Room Type
                  </span>

                  <select
                    value={form.roomTypeId}
                    disabled={isEditingOccupiedRoom}
                    onChange={(event) =>
                      updateForm("roomTypeId", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:bg-surface-muted disabled:text-muted-foreground"
                  >
                    {roomTypes.map((roomType) => (
                      <option key={roomType.id} value={roomType.id}>
                        {roomType.name} —{" "}
                        {formatMoney(roomType.basePrice, hotel.currency)}
                      </option>
                    ))}
                  </select>

                  {isEditingOccupiedRoom ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Room type cannot be changed while the room is OCCUPIED.
                    </p>
                  ) : null}
                </label>

                <Input
                  label="Room Number"
                  name="roomNumber"
                  required
                  maxLength={20}
                  value={form.roomNumber}
                  disabled={isEditingOccupiedRoom}
                  onChange={(event) =>
                    updateForm("roomNumber", event.target.value)
                  }
                  placeholder="101"
                />

                <Input
                  label="Floor"
                  name="floor"
                  type="number"
                  step="1"
                  value={form.floor}
                  onChange={(event) => updateForm("floor", event.target.value)}
                  placeholder="1"
                />

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    Status
                  </span>

                  <select
                    value={form.status}
                    disabled={isEditingOccupiedRoom}
                    onChange={(event) =>
                      updateForm("status", event.target.value as RoomStatus)
                    }
                    className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:bg-surface-muted disabled:text-muted-foreground"
                  >
                    {isEditingOccupiedRoom ? (
                      <option value="OCCUPIED">OCCUPIED</option>
                    ) : (
                      manageableStatuses.map((status) => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))
                    )}
                  </select>

                  {isEditingOccupiedRoom ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      OCCUPIED can only be changed by reservation check-in or
                      check-out.
                    </p>
                  ) : null}
                </label>

                <div className="lg:col-span-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground">
                      Notes
                    </span>

                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={(event) =>
                        updateForm("notes", event.target.value)
                      }
                      placeholder="Internal notes about this room"
                      className="min-h-24 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary-soft"
                    />
                  </label>
                </div>

                <div className="flex items-end gap-3 lg:col-span-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Saving..."
                      : isEditing
                        ? "Save Changes"
                        : "Create Room"}
                  </Button>

                  <Button variant="secondary" onClick={closeForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {hotel.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {sortedRooms.length} room{sortedRooms.length === 1 ? "" : "s"}{" "}
                found.
              </p>
            </div>

            <Badge variant="primary">{hotel.currency}</Badge>
          </div>
        </CardHeader>

        <CardContent>
          {sortedRooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                No rooms yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the first physical room for this hotel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4 font-semibold">Room</th>
                    <th className="py-3 pr-4 font-semibold">Room Type</th>
                    <th className="py-3 pr-4 font-semibold">Floor</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Price</th>
                    <th className="py-3 pr-4 font-semibold">Capacity</th>
                    <th className="py-3 pr-4 font-semibold">Notes</th>
                    <th className="py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedRooms.map((room) => {
                    const canDelete = room.status === "AVAILABLE";

                    return (
                      <tr key={room.id} className="border-b border-border">
                        <td className="py-4 pr-4 align-top">
                          <p className="font-semibold text-foreground">
                            Room {room.roomNumber}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            ID: {room.id.slice(0, 8)}
                          </p>
                        </td>

                        <td className="py-4 pr-4 align-top">
                          <p className="text-sm font-semibold text-foreground">
                            {room.roomType.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {room.roomType.slug}
                          </p>
                        </td>

                        <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                          {room.floor ?? "-"}
                        </td>

                        <td className="py-4 pr-4 align-top">
                          <Badge variant={getStatusBadgeVariant(room.status)}>
                            {formatStatus(room.status)}
                          </Badge>
                        </td>

                        <td className="py-4 pr-4 align-top text-sm font-semibold text-foreground">
                          {formatMoney(room.roomType.basePrice, hotel.currency)}
                        </td>

                        <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                          <p>{room.roomType.capacityAdults} adult(s)</p>
                          <p>{room.roomType.capacityChildren} child(ren)</p>
                        </td>

                        <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                          {room.notes || "-"}
                        </td>

                        <td className="py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => openEditForm(room)}
                            >
                              Edit
                            </Button>

                            <Button
                              variant="danger"
                              onClick={() => deleteRoom(room)}
                              disabled={deletingId === room.id || !canDelete}
                              title={
                                canDelete
                                  ? "Delete room"
                                  : "Only AVAILABLE rooms can be deleted"
                              }
                            >
                              {deletingId === room.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}