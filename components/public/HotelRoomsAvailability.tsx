"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
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
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getRoomSizeLabel(roomSizeSqm: DisplayRoomType["roomSizeSqm"]) {
  if (!roomSizeSqm) {
    return "-";
  }

  return `${roomSizeSqm} sqm`;
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
    <section id="rooms" className="bg-luxury-cream">
      <div className="luxury-container py-12 lg:py-16">
        <div ref={availabilityRef} id="availability">
          <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
            <div className="grid gap-8 p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Live availability
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
                  Search dates before booking.
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Choose your stay dates and guest count. Available room types
                  will update using the hotel reservation system.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-3xl bg-luxury-cream p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Room types
                    </p>
                    <p className="mt-2 text-2xl font-black text-luxury-ink">
                      {roomTypes.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-luxury-cream p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Guests
                    </p>
                    <p className="mt-2 text-2xl font-black text-luxury-ink">
                      {form.adults} adult{form.adults === "1" ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={searchAvailability}
                >
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-luxury-ink">
                      Check-in
                    </span>
                    <input
                      type="date"
                      min={getTodayDate()}
                      value={form.checkInDate}
                      onChange={(event) =>
                        updateForm("checkInDate", event.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-luxury-ink">
                      Check-out
                    </span>
                    <input
                      type="date"
                      min={form.checkInDate || getTodayDate()}
                      value={form.checkOutDate}
                      onChange={(event) =>
                        updateForm("checkOutDate", event.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-luxury-ink">
                      Adults
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={form.adults}
                      onChange={(event) =>
                        updateForm("adults", event.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-luxury-ink">
                      Children
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={form.children}
                      onChange={(event) =>
                        updateForm("children", event.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
                    />
                  </label>

                  <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
                    >
                      {isSearching ? "Searching..." : "Search availability"}
                    </button>

                    <button
                      type="button"
                      onClick={clearSearch}
                      className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                    >
                      Clear
                    </button>
                  </div>
                </form>

                {selectedRoomTypeId && selectedRoomTypeName ? (
                  <div className="mt-5 flex flex-col justify-between gap-3 rounded-3xl border border-luxury-gold-soft bg-luxury-gold-soft px-5 py-4 text-sm sm:flex-row sm:items-center">
                    <p className="font-bold text-luxury-ink">
                      Checking availability for: {selectedRoomTypeName}
                    </p>

                    <button
                      type="button"
                      onClick={() => setSelectedRoomTypeId("")}
                      className="text-left text-sm font-black text-luxury-gold transition hover:text-luxury-ink"
                    >
                      Search all room types
                    </button>
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-5 rounded-3xl border border-danger-soft bg-danger-soft px-5 py-4 text-sm font-bold text-danger">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Rooms and suites
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
              Choose the room that fits your stay.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              {isShowingAvailability && availability
                ? `Availability for ${availability.checkInDate} → ${availability.checkOutDate}.`
                : "Review room categories, capacity, amenities, and starting prices before searching dates."}
            </p>
          </div>

          {isShowingAvailability && availableCount !== null ? (
            <Badge variant={availableCount > 0 ? "success" : "danger"}>
              {availableCount} available type{availableCount === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge>
              {roomTypes.length} room type{roomTypes.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {displayRoomTypes.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-luxury-stone bg-white p-8 shadow-sm">
            <p className="text-sm font-black text-luxury-ink">
              No room types available.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Try different dates or add public room types from the admin panel.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {displayRoomTypes.map((roomType) => {
              const image = getPrimaryImage(roomType);
              const isAvailable =
                !isShowingAvailability || roomType.isAvailable === true;

              const bookingHref = `/hotels/${hotelSlug}/book?roomTypeId=${roomType.id}&checkInDate=${form.checkInDate}&checkOutDate=${form.checkOutDate}&adults=${form.adults}&children=${form.children}`;

              return (
                <article
                  key={roomType.id}
                  className={[
                    "overflow-hidden rounded-[2rem] border bg-white shadow-xl shadow-slate-900/5 transition",
                    isAvailable
                      ? "border-luxury-stone"
                      : "border-danger-soft opacity-75",
                  ].join(" ")}
                >
                  <div className="grid lg:grid-cols-[360px_1fr]">
                    <div className="relative h-72 bg-slate-200 lg:h-full">
                      {image ? (
                        <img
                          src={image.url}
                          alt={image.altText || roomType.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 px-6 text-center">
                          <div>
                            <p className="text-sm font-black text-slate-600">
                              Room Image
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Add images later
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute left-4 top-4">
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
                    </div>

                    <div className="flex flex-col p-6 lg:p-8">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h3 className="text-2xl font-black tracking-tight text-luxury-ink">
                            {roomType.name}
                          </h3>

                          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                            {roomType.description ||
                              "Comfortable room for your stay."}
                          </p>
                        </div>

                        <div className="shrink-0 rounded-3xl bg-luxury-cream px-5 py-4 xl:text-right">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                            Nightly price
                          </p>
                          <p className="mt-2 text-2xl font-black text-luxury-ink">
                            {formatMoney(roomType.basePrice, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-3xl border border-luxury-stone bg-white px-4 py-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Guests
                          </p>
                          <p className="mt-2 text-sm font-black text-luxury-ink">
                            {roomType.capacityAdults} adult
                            {roomType.capacityAdults === 1 ? "" : "s"},{" "}
                            {roomType.capacityChildren} child
                            {roomType.capacityChildren === 1 ? "" : "ren"}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-luxury-stone bg-white px-4 py-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Bed
                          </p>
                          <p className="mt-2 text-sm font-black text-luxury-ink">
                            {roomType.bedType || "-"}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-luxury-stone bg-white px-4 py-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Size
                          </p>
                          <p className="mt-2 text-sm font-black text-luxury-ink">
                            {getRoomSizeLabel(roomType.roomSizeSqm)}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-luxury-stone bg-white px-4 py-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Rooms
                          </p>
                          <p className="mt-2 text-sm font-black text-luxury-ink">
                            {isShowingAvailability
                              ? `${roomType.availableRooms ?? 0} / ${
                                  roomType.totalRooms
                                }`
                              : roomType.totalRooms}
                          </p>
                        </div>
                      </div>

                      {roomType.amenities && roomType.amenities.length > 0 ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {roomType.amenities.slice(0, 8).map((amenity) => (
                            <Badge key={amenity.id}>{amenity.name}</Badge>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-7 flex flex-col gap-3 border-t border-luxury-stone pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm leading-6 text-slate-600">
                          {isShowingAvailability
                            ? isAvailable
                              ? "This room type is available for your selected stay."
                              : "This room type is unavailable for the selected dates."
                            : "Search your dates to confirm live availability before booking."}
                        </p>

                        {isShowingAvailability ? (
                          <Link
                            href={bookingHref}
                            className={[
                              "inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-bold shadow-sm transition",
                              isAvailable
                                ? "bg-luxury-navy text-white hover:bg-luxury-ink"
                                : "pointer-events-none bg-slate-100 text-slate-400",
                            ].join(" ")}
                            aria-disabled={!isAvailable}
                          >
                            {isAvailable ? "Continue booking" : "Unavailable"}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => checkSpecificRoom(roomType.id)}
                            className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                          >
                            Check this room
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}