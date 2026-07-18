import { redirect } from "next/navigation";
import { AdminGuestsClient } from "@/components/guests/AdminGuestsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import {
  canUnlockGuestAccounts,
  canViewGuests,
} from "@/lib/frontend/permissions";
import type { AdminGuestsResponse } from "@/lib/frontend/types";

type GuestsPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

export default async function GuestsPage({ searchParams }: GuestsPageProps) {
  const user = await getServerAuthUser();

  if (!user) {
    redirect(`/guest/login?next=${encodeURIComponent("/admin/guests")}`);
  }

  const hotels = await getServerHotels();
  const params = await searchParams;

  const selectedHotelId = params?.hotelId || hotels[0]?.id || "";
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  if (!selectedHotel) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Guests</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No hotel is available for this account.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canViewGuests(user, selectedHotel.id)) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need HOTEL_ADMIN, MANAGER, or RECEPTIONIST access to view
            guests.
          </p>
        </CardContent>
      </Card>
    );
  }

  let guests: AdminGuestsResponse["guests"] = [];
  let loadError = "";

  try {
    const data = await serverFetchJson<AdminGuestsResponse>(
      `/api/admin/hotels/${selectedHotel.id}/guests`,
    );

    guests = data.guests;
  } catch (error: unknown) {
    if (error instanceof ServerApiError) {
      loadError = error.message;
    } else if (error instanceof Error) {
      loadError = error.message;
    } else {
      loadError = "Unable to load guests";
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Guests</h1>
          <p className="mt-2 text-sm text-danger">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminGuestsClient
      hotel={selectedHotel}
      initialGuests={guests}
      canUnlockGuestAccounts={canUnlockGuestAccounts(user, selectedHotel.id)}
    />
  );
}
