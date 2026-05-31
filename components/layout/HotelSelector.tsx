"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Hotel } from "@/lib/frontend/types";

type HotelSelectorProps = {
  hotels: Hotel[];
};

export function HotelSelector({ hotels }: HotelSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedHotelId = searchParams.get("hotelId") || hotels[0]?.id || "";

  function handleChange(nextHotelId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextHotelId) {
      params.set("hotelId", nextHotelId);
    } else {
      params.delete("hotelId");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  if (hotels.length === 0) {
    return (
      <div className="rounded-xl border border-warning-soft bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
        No hotels assigned
      </div>
    );
  }

  return (
    <label className="flex items-center gap-3">
      <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
        Hotel
      </span>

      <select
        value={selectedHotelId}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 w-full min-w-0 rounded-xl border border-border bg-white px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft sm:min-w-52"
      >
        {hotels.map((hotel) => (
          <option key={hotel.id} value={hotel.id}>
            {hotel.name} — {hotel.city}
          </option>
        ))}
      </select>
    </label>
  );
}