import { AdminGuestsClient } from "@/components/guests/AdminGuestsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { requireAdminPageAccess } from "@/lib/frontend/admin-page-access";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import {
  canUnlockGuestAccounts,
} from "@/lib/frontend/permissions";
import type { AdminGuestsResponse } from "@/lib/frontend/types";

type GuestsPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

export default async function GuestsPage({ searchParams }: GuestsPageProps) {
  const params = await searchParams;
  const { user, selectedHotel } = await requireAdminPageAccess("/admin/guests", params?.hotelId);

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
