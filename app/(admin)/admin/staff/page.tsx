import { StaffClient } from "@/components/staff/StaffClient";
import { Card, CardContent } from "@/components/ui/Card";
import { requireAdminPageAccess } from "@/lib/frontend/admin-page-access";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import type { StaffListResponse } from "@/lib/frontend/types";

type StaffPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = await searchParams;
  const { user, selectedHotel } = await requireAdminPageAccess("/admin/staff", params?.hotelId);

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
