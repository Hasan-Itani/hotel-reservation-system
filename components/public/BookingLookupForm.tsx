"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

  return (
    <form className="grid gap-4" onSubmit={lookupBooking}>
      {error ? (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      <Input
        label="Reservation Number"
        name="reservationNumber"
        value={form.reservationNumber}
        onChange={(event) =>
          updateForm("reservationNumber", event.target.value)
        }
        placeholder="RSV-20260524-ABC123"
        required
      />

      <Input
        label="Guest Email"
        name="guestEmail"
        type="email"
        value={form.guestEmail}
        onChange={(event) => updateForm("guestEmail", event.target.value)}
        placeholder="guest@example.com"
        required
      />

      <Button type="submit" className="h-11" disabled={isSearching}>
        {isSearching ? "Searching..." : "Find booking"}
      </Button>
    </form>
  );
}