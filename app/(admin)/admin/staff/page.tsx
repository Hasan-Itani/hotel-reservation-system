import { redirect } from "next/navigation";
import { StaffClient } from "@/components/staff/StaffClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import { canManageStaff } from "@/lib/frontend/permissions";
import type { StaffListResponse } from "@/lib/frontend/types";

type StaffPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const user = await getServerAuthUser();

  if (!user) {
    redirect("/login");
  }

  const hotels = await getServerHotels();
  const params = await searchParams;

  const selectedHotelId = params?.hotelId || hotels[0]?.id || "";
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  if (!selectedHotel) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Staff</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No hotel is available for this account.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canManageStaff(user, selectedHotel.id)) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need HOTEL_ADMIN access to manage staff.
          </p>
        </CardContent>
      </Card>
    );
  }

  let staff: StaffListResponse["staff"] = [];
  let loadError = "";

  try {
    const data = await serverFetchJson<StaffListResponse>(
      `/api/admin/hotels/${selectedHotel.id}/staff`
    );

    staff = data.staff;
  } catch (error: unknown) {
    if (error instanceof ServerApiError) {
      loadError = error.message;
    } else if (error instanceof Error) {
      loadError = error.message;
    } else {
      loadError = "Unable to load staff";
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Staff</h1>
          <p className="mt-2 text-sm text-danger">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <StaffClient
      hotel={selectedHotel}
      currentUser={user}
      initialStaff={staff}
    />
  );
}