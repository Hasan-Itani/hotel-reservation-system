"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { formatMoney } from "@/lib/frontend/format";
import type {
    PublicAvailabilityResponse,
    PublicAvailabilityRoomType,
    PublicRoomType,
} from "@/lib/frontend/types";

type HotelRoomsAvailabilityProps = {
    hotelSlug: string;
    currency: string;
    roomTypes: PublicRoomType[];
};

type SearchFormState = {
    checkInDate: string;
    checkOutDate: string;
    adults: string;
    children: string;
};

type DisplayRoomType = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    basePrice: PublicRoomType["basePrice"] | PublicAvailabilityRoomType["basePrice"];
    capacityAdults: number;
    capacityChildren: number;
    bedType: string | null;
    roomSizeSqm: PublicRoomType["roomSizeSqm"] | PublicAvailabilityRoomType["roomSizeSqm"];
    images: PublicRoomType["images"];
    amenities?: PublicRoomType["amenities"];
    totalRooms: number;
    reservedRooms?: number;
    availableRooms?: number;
    isAvailable?: boolean;
};

const defaultForm: SearchFormState = {
    checkInDate: "",
    checkOutDate: "",
    adults: "2",
    children: "0",
};

function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
}

function numberValue(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getPrimaryImage(roomType: DisplayRoomType) {
    return (
        roomType.images.find((image) => image.isPrimary) ||
        roomType.images[0] ||
        null
    );
}

export function HotelRoomsAvailability({
    hotelSlug,
    currency,
    roomTypes,
}: HotelRoomsAvailabilityProps) {
    const [form, setForm] = useState<SearchFormState>(defaultForm);
    const [availability, setAvailability] =
        useState<PublicAvailabilityResponse | null>(null);
    const [error, setError] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [selectedRoomTypeId, setSelectedRoomTypeId] = useState("");
    const availabilityRef = useRef<HTMLDivElement | null>(null);

    const isShowingAvailability = availability !== null;

    const displayRoomTypes: DisplayRoomType[] = useMemo(() => {
        const baseRoomTypes = availability
            ? availability.roomTypes.filter((roomType) => roomType.totalRooms > 0)
            : roomTypes
                .filter((roomType) => roomType.totalRooms > 0)
                .map((roomType) => ({
                    ...roomType,
                    totalRooms: roomType.totalRooms,
                }));

        if (!selectedRoomTypeId) {
            return baseRoomTypes;
        }

        return baseRoomTypes.filter((roomType) => roomType.id === selectedRoomTypeId);
    }, [availability, roomTypes, selectedRoomTypeId]);

    const availableCount = useMemo(() => {
        if (!availability) {
            return null;
        }

        return displayRoomTypes.filter((roomType) => roomType.isAvailable).length;
    }, [availability, displayRoomTypes]);

    const selectedRoomTypeName = useMemo(() => {
        const allRoomTypes = availability?.roomTypes ?? roomTypes;

        return (
            allRoomTypes.find((roomType) => roomType.id === selectedRoomTypeId)?.name ||
            ""
        );
    }, [availability, roomTypes, selectedRoomTypeId]);

    function updateForm<Key extends keyof SearchFormState>(
        key: Key,
        value: SearchFormState[Key],
    ) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    function clearSearch() {
        setForm(defaultForm);
        setAvailability(null);
        setSelectedRoomTypeId("");
        setError("");
    }

    function checkSpecificRoom(roomTypeId: string) {
        setSelectedRoomTypeId(roomTypeId);
        setError("");

        window.setTimeout(() => {
            availabilityRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 0);
    }

    async function searchAvailability(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");

        if (!form.checkInDate) {
            setError("Choose a check-in date");
            return;
        }

        if (!form.checkOutDate) {
            setError("Choose a check-out date");
            return;
        }

        if (form.checkOutDate <= form.checkInDate) {
            setError("Check-out date must be after check-in date");
            return;
        }

        if (numberValue(form.adults) < 1) {
            setError("Adults must be at least 1");
            return;
        }

        if (numberValue(form.children) < 0) {
            setError("Children cannot be negative");
            return;
        }

        const params = new URLSearchParams({
            checkInDate: form.checkInDate,
            checkOutDate: form.checkOutDate,
            adults: form.adults,
            children: form.children,
        });

        setIsSearching(true);

        try {
            const response = await fetch(
                `/api/public/hotels/${hotelSlug}/availability?${params.toString()}`,
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Unable to check availability");
                return;
            }

            setAvailability(data as PublicAvailabilityResponse);
        } catch {
            setError("Unable to check availability");
        } finally {
            setIsSearching(false);
        }
    }

    return (
        <section
            id="rooms"
            className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
        >
            <div ref={availabilityRef}>
                <Card id="availability">
                    <CardHeader>
                        <h2 className="text-lg font-bold text-foreground">
                            Search availability
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Search dates and guest count. The room list below will update.
                        </p>
                    </CardHeader>

                    <CardContent>
                        <form
                            className="grid gap-4 md:grid-cols-5"
                            onSubmit={searchAvailability}
                        >
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-foreground">
                                    Check-in
                                </span>
                                <input
                                    type="date"
                                    min={getTodayDate()}
                                    value={form.checkInDate}
                                    onChange={(event) =>
                                        updateForm("checkInDate", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-foreground">
                                    Check-out
                                </span>
                                <input
                                    type="date"
                                    min={form.checkInDate || getTodayDate()}
                                    value={form.checkOutDate}
                                    onChange={(event) =>
                                        updateForm("checkOutDate", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-foreground">
                                    Adults
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={form.adults}
                                    onChange={(event) => updateForm("adults", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-foreground">
                                    Children
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    max={20}
                                    value={form.children}
                                    onChange={(event) => updateForm("children", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
                                />
                            </label>

                            <div className="flex items-end gap-2">
                                <Button
                                    type="submit"
                                    className="h-11 flex-1"
                                    disabled={isSearching}
                                >
                                    {isSearching ? "Searching..." : "Search"}
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-11"
                                    onClick={clearSearch}
                                >
                                    Clear
                                </Button>
                            </div>
                        </form>

                        {selectedRoomTypeId && selectedRoomTypeName ? (
                            <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-primary-soft bg-primary-soft px-4 py-3 text-sm sm:flex-row sm:items-center">
                                <p className="font-medium text-primary">
                                    Checking availability for: {selectedRoomTypeName}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => setSelectedRoomTypeId("")}
                                    className="text-left text-sm font-bold text-primary hover:text-primary-hover"
                                >
                                    Search all room types
                                </button>
                            </div>
                        ) : null}

                        {error ? (
                            <div className="mt-4 rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                                {error}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
            <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Rooms and suites
                    </h2>

                    <p className="mt-2 text-sm text-muted-foreground">
                        {isShowingAvailability && availability
                            ? `Availability for ${availability.checkInDate} → ${availability.checkOutDate}`
                            : "Review room categories, capacity, amenities, and starting prices."}
                    </p>
                </div>

                {isShowingAvailability && availableCount !== null ? (
                    <Badge variant={availableCount > 0 ? "success" : "danger"}>
                        {availableCount} available type{availableCount === 1 ? "" : "s"}
                    </Badge>
                ) : (
                    <Badge>{roomTypes.length} room type{roomTypes.length === 1 ? "" : "s"}</Badge>
                )}
            </div>

            {displayRoomTypes.length === 0 ? (
                <Card className="mt-6">
                    <CardContent>
                        <p className="text-sm font-semibold text-foreground">
                            No room types available.
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Try different dates or add room types from the admin panel.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    {displayRoomTypes.map((roomType) => {
                        const image = getPrimaryImage(roomType);
                        const isAvailable =
                            !isShowingAvailability || roomType.isAvailable === true;

                        const bookingHref = `/hotels/${hotelSlug}/book?roomTypeId=${roomType.id}&checkInDate=${form.checkInDate}&checkOutDate=${form.checkOutDate}&adults=${form.adults}&children=${form.children}`;

                        return (
                            <div
                                key={roomType.id}
                                className={[
                                    "overflow-hidden rounded-card border bg-white shadow-sm",
                                    isAvailable ? "border-border" : "border-danger-soft opacity-75",
                                ].join(" ")}
                            >
                                <div className="grid md:grid-cols-[260px_1fr]">
                                    <div className="flex h-64 items-center justify-center bg-slate-200 md:h-full">
                                        {image ? (
                                            <img
                                                src={image.url}
                                                alt={image.altText || roomType.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="px-6 text-center">
                                                <p className="text-sm font-bold text-slate-600">
                                                    Room Image
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Add images later
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-lg font-bold text-foreground">
                                                    {roomType.name}
                                                </h3>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {roomType.description ||
                                                        "Comfortable room for your stay."}
                                                </p>
                                            </div>

                                            {isShowingAvailability ? (
                                                <Badge variant={isAvailable ? "success" : "danger"}>
                                                    {roomType.availableRooms ?? 0} available
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant={roomType.totalRooms > 0 ? "success" : "danger"}
                                                >
                                                    {roomType.totalRooms > 0
                                                        ? `${roomType.totalRooms} rooms`
                                                        : "Unavailable"}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                                            <div className="rounded-xl bg-surface-muted px-3 py-3">
                                                <p className="text-xs text-muted-foreground">Guests</p>
                                                <p className="mt-1 font-bold text-foreground">
                                                    {roomType.capacityAdults} adult(s),{" "}
                                                    {roomType.capacityChildren} child(ren)
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-surface-muted px-3 py-3">
                                                <p className="text-xs text-muted-foreground">Bed</p>
                                                <p className="mt-1 font-bold text-foreground">
                                                    {roomType.bedType || "-"}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-surface-muted px-3 py-3">
                                                <p className="text-xs text-muted-foreground">Rooms</p>
                                                <p className="mt-1 font-bold text-foreground">
                                                    {isShowingAvailability
                                                        ? `${roomType.availableRooms ?? 0} / ${roomType.totalRooms}`
                                                        : roomType.totalRooms}
                                                </p>
                                            </div>
                                        </div>

                                        {roomType.amenities && roomType.amenities.length > 0 ? (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {roomType.amenities.slice(0, 6).map((amenity) => (
                                                    <Badge key={amenity.id}>{amenity.name}</Badge>
                                                ))}
                                            </div>
                                        ) : null}

                                        <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Nightly price
                                                </p>
                                                <p className="text-lg font-bold text-foreground">
                                                    {formatMoney(roomType.basePrice, currency)}
                                                </p>
                                            </div>

                                            {isShowingAvailability ? (
                                                <Link
                                                    href={bookingHref}
                                                    className={[
                                                        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-bold transition",
                                                        isAvailable
                                                            ? "bg-primary text-white hover:bg-primary-hover"
                                                            : "pointer-events-none bg-surface-muted text-muted-foreground",
                                                    ].join(" ")}
                                                    aria-disabled={!isAvailable}
                                                >
                                                    {isAvailable ? "Continue booking" : "Unavailable"}
                                                </Link>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    className="h-10"
                                                    onClick={() => checkSpecificRoom(roomType.id)}
                                                >
                                                    Check this room
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}