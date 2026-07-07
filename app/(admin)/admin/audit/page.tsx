import { redirect } from "next/navigation";
import { AdminAuditClient } from "@/components/audit/AdminAuditClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import { canViewAudit } from "@/lib/frontend/permissions";
import type { AdminAuditLogsResponse } from "@/lib/frontend/types";

type AdminAuditPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
    action?: string;
    entityType?: string;
    actorUserId?: string;
  }>;
};

function buildAuditPath(
  hotelId: string,
  params: Awaited<AdminAuditPageProps["searchParams"]>,
) {
  const query = new URLSearchParams();

  if (params?.action) query.set("action", params.action);
  if (params?.entityType) query.set("entityType", params.entityType);
  if (params?.actorUserId) query.set("actorUserId", params.actorUserId);

  const suffix = query.toString();

  return suffix
    ? `/api/admin/hotels/${hotelId}/audit?${suffix}`
    : `/api/admin/hotels/${hotelId}/audit`;
}

export default async function AdminAuditPage({
  searchParams,
}: AdminAuditPageProps) {
  const user = await getServerAuthUser();

  if (!user) {
    redirect(`/guest/login?next=${encodeURIComponent("/admin/audit")}`);
  }

  const [hotels, params] = await Promise.all([getServerHotels(), searchParams]);
  const selectedHotelId = params?.hotelId || hotels[0]?.id || "";
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  if (!selectedHotel) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Audit</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No hotel is available for this account.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canViewAudit(user, selectedHotel.id)) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need HOTEL_ADMIN or MANAGER access to view audit history.
          </p>
        </CardContent>
      </Card>
    );
  }

  let auditData: AdminAuditLogsResponse | null = null;
  let loadError = "";

  try {
    auditData = await serverFetchJson<AdminAuditLogsResponse>(
      buildAuditPath(selectedHotel.id, params),
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError) {
      loadError = error.message;
    } else if (error instanceof Error) {
      loadError = error.message;
    } else {
      loadError = "Unable to load audit logs";
    }
  }

  if (loadError || !auditData) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Audit</h1>
          <p className="mt-2 text-sm text-danger">
            {loadError || "Unable to load audit logs"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminAuditClient
      hotel={selectedHotel}
      initialLogs={auditData.logs}
      actionOptions={auditData.filters.actions}
      entityTypeOptions={auditData.filters.entityTypes}
      initialFilters={{
        action: params?.action || "",
        entityType: params?.entityType || "",
        actorUserId: params?.actorUserId || "",
      }}
    />
  );
}
