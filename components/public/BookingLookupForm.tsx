"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicBookingLookupResponse } from "@/lib/frontend/types";

type LookupFormState = {
  reservationNumber: string;
  guestEmail: string;
};

const defaultForm: LookupFormState = {
  reservationNumber: "",
  guestEmail: "",
};

export function BookingLookupForm() {
  const router = useRouter();

  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  function updateForm<Key extends keyof LookupFormState>(
    key: Key,
    value: LookupFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function lookupBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const reservationNumber = form.reservationNumber.trim().toUpperCase();
    const guestEmail = form.guestEmail.trim().toLowerCase();

    if (!reservationNumber) {
      setError("Reservation number is required");
      return;
    }

    if (!guestEmail) {
      setError("Guest email is required");
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch("/api/public/bookings/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationNumber,
          guestEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Booking not found");
        return;
      }

      const lookupData = data as PublicBookingLookupResponse;

      router.push(
        `/bookings/${lookupData.booking.reservationNumber}?guestEmail=${encodeURIComponent(
          guestEmail,
        )}`,
      );
    } catch {
      setError("Unable to look up booking");
    } finally {
      setIsSearching(false);
    }
  }

  const inputClassName =
    "h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft";

  return (
    <form className="grid gap-5" onSubmit={lookupBooking}>
      {error ? (
        <div className="rounded-3xl border border-danger-soft bg-danger-soft px-5 py-4 text-sm font-bold text-danger">
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Reservation number
        </span>
        <input
          name="reservationNumber"
          value={form.reservationNumber}
          onChange={(event) =>
            updateForm("reservationNumber", event.target.value)
          }
          placeholder="RSV-20260524-ABC123"
          required
          className={inputClassName}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Guest email
        </span>
        <input
          name="guestEmail"
          type="email"
          value={form.guestEmail}
          onChange={(event) => updateForm("guestEmail", event.target.value)}
          placeholder="guest@example.com"
          required
          className={inputClassName}
        />
      </label>

      <button
        type="submit"
        disabled={isSearching}
        className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
      >
        {isSearching ? "Searching..." : "Find booking"}
      </button>
    </form>
  );
}