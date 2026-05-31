"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import { formatMoney, formatNumber } from "@/lib/frontend/format";
import type {
    DeletedRoomTypeResponse,
    Hotel,
    RoomType,
    RoomTypeResponse,
} from "@/lib/frontend/types";

type RoomTypesClientProps = {
    hotel: Hotel;
    initialRoomTypes: RoomType[];
};

type RoomTypeFormState = {
    id?: string;
    name: string;
    slug: string;
    description: string;
    basePrice: string;
    capacityAdults: string;
    capacityChildren: string;
    bedType: string;
    roomSizeSqm: string;
};

const emptyForm: RoomTypeFormState = {
    name: "",
    slug: "",
    description: "",
    basePrice: "",
    capacityAdults: "2",
    capacityChildren: "0",
    bedType: "",
    roomSizeSqm: "",
};

function toNumber(value: string) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        return 0;
    }

    return numberValue;
}

function optionalString(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function nullableString(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function nullableNumber(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    return toNumber(trimmed);
}

function roomTypeToForm(roomType: RoomType): RoomTypeFormState {
    return {
        id: roomType.id,
        name: roomType.name,
        slug: roomType.slug,
        description: roomType.description || "",
        basePrice: String(roomType.basePrice),
        capacityAdults: String(roomType.capacityAdults),
        capacityChildren: String(roomType.capacityChildren),
        bedType: roomType.bedType || "",
        roomSizeSqm: roomType.roomSizeSqm === null ? "" : String(roomType.roomSizeSqm),
    };
}

export function RoomTypesClient({
    hotel,
    initialRoomTypes,
}: RoomTypesClientProps) {
    const router = useRouter();

    const [roomTypes, setRoomTypes] = useState(initialRoomTypes);
    const [form, setForm] = useState<RoomTypeFormState>(emptyForm);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState("");
    const formRef = useRef<HTMLDivElement | null>(null);
    const isEditing = !!form.id;

    const sortedRoomTypes = useMemo(() => {
        return [...roomTypes].sort((a, b) => a.name.localeCompare(b.name));
    }, [roomTypes]);

    function updateForm<Key extends keyof RoomTypeFormState>(
        key: Key,
        value: RoomTypeFormState[Key]
    ) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    function openCreateForm() {
        setError("");
        setForm(emptyForm);
        setIsFormOpen(true);
    }

    function openEditForm(roomType: RoomType) {
        setError("");
        setForm(roomTypeToForm(roomType));
        setIsFormOpen(true);

        window.setTimeout(() => {
            formRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 0);
    }

    function closeForm() {
        setError("");
        setForm(emptyForm);
        setIsFormOpen(false);
    }

    function buildCreatePayload() {
        const payload: Record<string, unknown> = {
            name: form.name.trim(),
            basePrice: toNumber(form.basePrice),
            capacityAdults: toNumber(form.capacityAdults),
            capacityChildren: toNumber(form.capacityChildren),
            amenityIds: [],
            images: [],
        };

        const slug = optionalString(form.slug);
        const description = optionalString(form.description);
        const bedType = optionalString(form.bedType);
        const roomSizeSqm = nullableNumber(form.roomSizeSqm);

        if (slug) payload.slug = slug;
        if (description) payload.description = description;
        if (bedType) payload.bedType = bedType;
        if (roomSizeSqm !== null) payload.roomSizeSqm = roomSizeSqm;

        return payload;
    }

    function buildUpdatePayload() {
        return {
            name: form.name.trim(),
            slug: form.slug.trim(),
            description: nullableString(form.description),
            basePrice: toNumber(form.basePrice),
            capacityAdults: toNumber(form.capacityAdults),
            capacityChildren: toNumber(form.capacityChildren),
            bedType: nullableString(form.bedType),
            roomSizeSqm: nullableNumber(form.roomSizeSqm),
        };
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");

        if (!form.name.trim()) {
            setError("Room type name is required");
            return;
        }

        if (toNumber(form.basePrice) <= 0) {
            setError("Base price must be greater than 0");
            return;
        }

        if (toNumber(form.capacityAdults) < 1) {
            setError("Adult capacity must be at least 1");
            return;
        }

        if (toNumber(form.capacityChildren) < 0) {
            setError("Children capacity cannot be negative");
            return;
        }

        setIsSubmitting(true);

        try {
            if (isEditing && form.id) {
                const data = await clientFetchJson<RoomTypeResponse>(
                    `/api/admin/hotels/${hotel.id}/room-types/${form.id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify(buildUpdatePayload()),
                    }
                );

                setRoomTypes((current) =>
                    current.map((item) =>
                        item.id === data.roomType.id ? data.roomType : item
                    )
                );
            } else {
                const data = await clientFetchJson<RoomTypeResponse>(
                    `/api/admin/hotels/${hotel.id}/room-types`,
                    {
                        method: "POST",
                        body: JSON.stringify(buildCreatePayload()),
                    }
                );

                setRoomTypes((current) => [...current, data.roomType]);
            }

            closeForm();
            router.refresh();
        } catch (caughtError: unknown) {
            if (caughtError instanceof FrontendApiError) {
                setError(caughtError.message);
            } else {
                setError("Unable to save room type");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    async function deleteRoomType(roomType: RoomType) {
        const confirmed = window.confirm(
            `Delete "${roomType.name}"? This will fail if rooms or reservations still use it.`
        );

        if (!confirmed) {
            return;
        }

        setDeletingId(roomType.id);
        setError("");

        try {
            await clientFetchJson<DeletedRoomTypeResponse>(
                `/api/admin/hotels/${hotel.id}/room-types/${roomType.id}`,
                {
                    method: "DELETE",
                }
            );

            setRoomTypes((current) =>
                current.filter((item) => item.id !== roomType.id)
            );

            router.refresh();
        } catch (caughtError: unknown) {
            if (caughtError instanceof FrontendApiError) {
                setError(caughtError.message);
            } else {
                setError("Unable to delete room type");
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
                        Room Types
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage room categories, pricing, capacity, beds, and basic details
                        for {hotel.name}.
                    </p>
                </div>

                <Button onClick={openCreateForm}>New Room Type</Button>
            </section>

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
                                        {isEditing ? "Edit Room Type" : "Create Room Type"}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Amenities and images will be handled in a later pass.
                                    </p>
                                </div>

                                <Button variant="ghost" onClick={closeForm}>
                                    Cancel
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleSubmit}>
                                <Input
                                    label="Name"
                                    name="name"
                                    required
                                    value={form.name}
                                    onChange={(event) => updateForm("name", event.target.value)}
                                    placeholder="Deluxe King Room"
                                />

                                <Input
                                    label="Slug"
                                    name="slug"
                                    value={form.slug}
                                    onChange={(event) => updateForm("slug", event.target.value)}
                                    placeholder="deluxe-king-room"
                                />

                                <div className="lg:col-span-2">
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-medium text-foreground">
                                            Description
                                        </span>
                                        <textarea
                                            name="description"
                                            value={form.description}
                                            onChange={(event) =>
                                                updateForm("description", event.target.value)
                                            }
                                            placeholder="Short description for this room type"
                                            className="min-h-24 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                        />
                                    </label>
                                </div>

                                <Input
                                    label={`Base Price (${hotel.currency})`}
                                    name="basePrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    value={form.basePrice}
                                    onChange={(event) =>
                                        updateForm("basePrice", event.target.value)
                                    }
                                    placeholder="150"
                                />

                                <Input
                                    label="Bed Type"
                                    name="bedType"
                                    value={form.bedType}
                                    onChange={(event) => updateForm("bedType", event.target.value)}
                                    placeholder="King Bed"
                                />

                                <Input
                                    label="Adult Capacity"
                                    name="capacityAdults"
                                    type="number"
                                    min="1"
                                    step="1"
                                    required
                                    value={form.capacityAdults}
                                    onChange={(event) =>
                                        updateForm("capacityAdults", event.target.value)
                                    }
                                />

                                <Input
                                    label="Children Capacity"
                                    name="capacityChildren"
                                    type="number"
                                    min="0"
                                    step="1"
                                    required
                                    value={form.capacityChildren}
                                    onChange={(event) =>
                                        updateForm("capacityChildren", event.target.value)
                                    }
                                />

                                <Input
                                    label="Room Size SQM"
                                    name="roomSizeSqm"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.roomSizeSqm}
                                    onChange={(event) =>
                                        updateForm("roomSizeSqm", event.target.value)
                                    }
                                    placeholder="35"
                                />

                                <div className="flex items-end gap-3 lg:col-span-2">
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting
                                            ? "Saving..."
                                            : isEditing
                                                ? "Save Changes"
                                                : "Create Room Type"}
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
                                {sortedRoomTypes.length} room type
                                {sortedRoomTypes.length === 1 ? "" : "s"} found.
                            </p>
                        </div>

                        <Badge variant="primary">{hotel.currency}</Badge>
                    </div>
                </CardHeader>

                <CardContent>
                    {sortedRoomTypes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                            <p className="text-sm font-semibold text-foreground">
                                No room types yet
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Create the first room type for this hotel.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="py-3 pr-4 font-semibold">Room Type</th>
                                        <th className="py-3 pr-4 font-semibold">Price</th>
                                        <th className="py-3 pr-4 font-semibold">Capacity</th>
                                        <th className="py-3 pr-4 font-semibold">Bed</th>
                                        <th className="py-3 pr-4 font-semibold">Size</th>
                                        <th className="py-3 pr-4 font-semibold">Usage</th>
                                        <th className="py-3 pr-4 font-semibold">Amenities</th>
                                        <th className="py-3 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {sortedRoomTypes.map((roomType) => {
                                        const roomsCount = roomType._count?.rooms ?? 0;
                                        const reservationLinksCount = roomType._count?.reservationRooms ?? 0;
                                        const isUsed = roomsCount > 0 || reservationLinksCount > 0;

                                        return (
                                            <tr key={roomType.id} className="border-b border-border">
                                                <td className="py-4 pr-4 align-top">
                                                    <p className="font-semibold text-foreground">
                                                        {roomType.name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {roomType.slug}
                                                    </p>
                                                    {roomType.description ? (
                                                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                                            {roomType.description}
                                                        </p>
                                                    ) : null}
                                                </td>

                                                <td className="py-4 pr-4 align-top text-sm font-semibold text-foreground">
                                                    {formatMoney(roomType.basePrice, hotel.currency)}
                                                </td>

                                                <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                                                    <p>{roomType.capacityAdults} adult(s)</p>
                                                    <p>{roomType.capacityChildren} child(ren)</p>
                                                </td>

                                                <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                                                    {roomType.bedType || "-"}
                                                </td>

                                                <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                                                    {roomType.roomSizeSqm
                                                        ? `${formatNumber(roomType.roomSizeSqm)} sqm`
                                                        : "-"}
                                                </td>

                                                <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                                                    <p>{roomType._count?.rooms ?? 0} room(s)</p>
                                                    <p>{roomType._count?.reservationRooms ?? 0} reservation link(s)</p>
                                                </td>

                                                <td className="py-4 pr-4 align-top">
                                                    {roomType.amenities.length > 0 ? (
                                                        <div className="flex max-w-xs flex-wrap gap-2">
                                                            {roomType.amenities.map((amenity) => (
                                                                <Badge key={amenity.id}>{amenity.name}</Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">
                                                            -
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-4 align-top">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => openEditForm(roomType)}
                                                        >
                                                            Edit
                                                        </Button>

                                                        <Button
                                                            variant="danger"
                                                            onClick={() => deleteRoomType(roomType)}
                                                            disabled={deletingId === roomType.id || isUsed}
                                                            title={
                                                                isUsed
                                                                    ? "Cannot delete a room type that has rooms or reservation history"
                                                                    : "Delete room type"
                                                            }
                                                        >
                                                            {deletingId === roomType.id ? "Deleting..." : "Delete"}
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