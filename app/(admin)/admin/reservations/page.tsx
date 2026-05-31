import { redirect } from "next/navigation";
import { ReservationsClient } from "@/components/reservations/ReservationsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import { canManageReservations } from "@/lib/frontend/permissions";
import type {
    ReservationsResponse,
    RoomsResponse,
} from "@/lib/frontend/types";

type ReservationsPageProps = {
    searchParams?: Promise<{
        hotelId?: string;
        status?: string;
        guestEmail?: string;
        checkInFrom?: string;
        checkInTo?: string;
        checkOutFrom?: string;
        checkOutTo?: string;
    }>;
};

function buildReservationsPath(
    hotelId: string,
    params: Awaited<ReservationsPageProps["searchParams"]>,
) {
    const query = new URLSearchParams();

    if (params?.status) query.set("status", params.status);
    if (params?.guestEmail) query.set("guestEmail", params.guestEmail);
    if (params?.checkInFrom) query.set("checkInFrom", params.checkInFrom);
    if (params?.checkInTo) query.set("checkInTo", params.checkInTo);
    if (params?.checkOutFrom) query.set("checkOutFrom", params.checkOutFrom);
    if (params?.checkOutTo) query.set("checkOutTo", params.checkOutTo);

    const suffix = query.toString();

    return suffix
        ? `/api/admin/hotels/${hotelId}/reservations?${suffix}`
        : `/api/admin/hotels/${hotelId}/reservations`;
}

export default async function ReservationsPage({
    searchParams,
}: ReservationsPageProps) {
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
                    <h1 className="text-xl font-bold text-foreground">Reservations</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        No hotel is available for this account.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (!canManageReservations(user, selectedHotel.id)) {
        return (
            <Card>
                <CardContent>
                    <h1 className="text-xl font-bold text-foreground">Access denied</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        You need HOTEL_ADMIN, MANAGER, or RECEPTIONIST access to manage
                        reservations.
                    </p>
                </CardContent>
            </Card>
        );
    }

    let reservations: ReservationsResponse["reservations"] = [];
    let rooms: RoomsResponse["rooms"] = [];
    let loadError = "";

    try {
        const [reservationsData, roomsData] = await Promise.all([
            serverFetchJson<ReservationsResponse>(
                buildReservationsPath(selectedHotel.id, params),
            ),
            serverFetchJson<RoomsResponse>(
                `/api/admin/hotels/${selectedHotel.id}/rooms`,
            ),
        ]);

        reservations = reservationsData.reservations;
        rooms = roomsData.rooms;
    } catch (error: unknown) {
        if (error instanceof ServerApiError) {
            loadError = error.message;
        } else if (error instanceof Error) {
            loadError = error.message;
        } else {
            loadError = "Unable to load reservations";
        }
    }

    if (loadError) {
        return (
            <Card>
                <CardContent>
                    <h1 className="text-xl font-bold text-foreground">Reservations</h1>
                    <p className="mt-2 text-sm text-danger">{loadError}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <ReservationsClient
            hotel={selectedHotel}
            initialReservations={reservations}
            rooms={rooms}
            initialFilters={{
                status: params?.status || "",
                guestEmail: params?.guestEmail || "",
                checkInFrom: params?.checkInFrom || "",
                checkInTo: params?.checkInTo || "",
                checkOutFrom: params?.checkOutFrom || "",
                checkOutTo: params?.checkOutTo || "",
            }}
        />
    );
}