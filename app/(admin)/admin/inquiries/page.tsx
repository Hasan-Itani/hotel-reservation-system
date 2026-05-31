import { redirect } from "next/navigation";
import { AdminInquiriesClient } from "@/components/inquiries/AdminInquiriesClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import { canViewGuests } from "@/lib/frontend/permissions";
import type { AdminHotelInquiriesResponse } from "@/lib/frontend/types";

type AdminInquiriesPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

export default async function AdminInquiriesPage({
  searchParams,
}: AdminInquiriesPageProps) {
  const user = await getServerAuthUser();

  if (!user) {
    redirect(`/guest/login?next=${encodeURIComponent("/admin/inquiries")}`);
  }

  const hotels = await getServerHotels();
  const params = await searchParams;

  const selectedHotelId = params?.hotelId || hotels[0]?.id || "";
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  if (!selectedHotel) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Inquiries</h1>
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
            You need HOTEL_ADMIN, MANAGER, or RECEPTIONIST access to view hotel
            inquiries.
          </p>
        </CardContent>
      </Card>
    );
  }

  let inquiries: AdminHotelInquiriesResponse["inquiries"] = [];
  let loadError = "";

  try {
    const data = await serverFetchJson<AdminHotelInquiriesResponse>(
      `/api/admin/hotels/${selectedHotel.id}/inquiries`,
    );

    inquiries = data.inquiries;
  } catch (error: unknown) {
    if (error instanceof ServerApiError) {
      loadError = error.message;
    } else if (error instanceof Error) {
      loadError = error.message;
    } else {
      loadError = "Unable to load inquiries";
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Inquiries</h1>
          <p className="mt-2 text-sm text-danger">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminInquiriesClient
      hotel={selectedHotel}
      initialInquiries={inquiries}
    />
  );
}