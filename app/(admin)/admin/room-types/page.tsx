import { redirect } from "next/navigation";
import { RoomTypesClient } from "@/components/room-types/RoomTypesClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import { canManageHotelSetup } from "@/lib/frontend/permissions";
import type { RoomTypesResponse } from "@/lib/frontend/types";

type RoomTypesPageProps = {
    searchParams?: Promise<{
        hotelId?: string;
    }>;
};

export default async function RoomTypesPage({
    searchParams,
}: RoomTypesPageProps) {
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
                    <h1 className="text-xl font-bold text-foreground">Room Types</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        No hotel is available for this account.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const canManage = canManageHotelSetup(user, selectedHotel.id);

    if (!canManage) {
        return (
            <Card>
                <CardContent>
                    <h1 className="text-xl font-bold text-foreground">Access denied</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        You need HOTEL_ADMIN or MANAGER access to manage room types.
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