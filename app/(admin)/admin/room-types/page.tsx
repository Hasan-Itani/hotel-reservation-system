import { RoomTypesClient } from "@/components/room-types/RoomTypesClient";
import { Card, CardContent } from "@/components/ui/Card";
import { requireAdminPageAccess } from "@/lib/frontend/admin-page-access";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import type { RoomTypesResponse } from "@/lib/frontend/types";

type RoomTypesPageProps = {
    searchParams?: Promise<{
        hotelId?: string;
    }>;
};

export default async function RoomTypesPage({
    searchParams,
}: RoomTypesPageProps) {
    const params = await searchParams;
    const { selectedHotel } = await requireAdminPageAccess("/admin/room-types", params?.hotelId);

    if (!selectedHotel) {
        return (
            <Card>
                <CardContent>
                    <h1 className="text-xl font-bold text-foreground">Room Types</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        No hotel is available for this account.
                    </p>
                </CardContent>
            </Card>
        );
    }

    let roomTypes: RoomTypesResponse["roomTypes"] = [];
    let loadError = "";

    try {
        const data = await serverFetchJson<RoomTypesResponse>(
            `/api/admin/hotels/${selectedHotel.id}/room-types`
        );

        roomTypes = data.roomTypes;
    } catch (error: unknown) {
        loadError =
            error instanceof ServerApiError
                ? error.message
                : "Unable to load room types";
    }

    if (loadError) {
        return (
            <Card>
                <CardContent>
                    <h1 className="text-xl font-bold text-foreground">Room Types</h1>
                    <p className="mt-2 text-sm text-danger">{loadError}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <RoomTypesClient hotel={selectedHotel} initialRoomTypes={roomTypes} />
    );
}
