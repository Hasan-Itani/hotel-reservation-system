import { AdminInquiriesClient } from "@/components/inquiries/AdminInquiriesClient";
import { Card, CardContent } from "@/components/ui/Card";
import { requireAdminPageAccess } from "@/lib/frontend/admin-page-access";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import type { AdminHotelInquiriesResponse } from "@/lib/frontend/types";

type AdminInquiriesPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

export default async function AdminInquiriesPage({
  searchParams,
}: AdminInquiriesPageProps) {
  const params = await searchParams;
  const { selectedHotel } = await requireAdminPageAccess("/admin/inquiries", params?.hotelId);

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
