import { Suspense } from "react";
import { ReservationsClient } from "@/components/reservations/ReservationsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { requireAdminPageAccess } from "@/lib/frontend/admin-page-access";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import type {
    AdminReservationSummariesResponse,
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
    const query = new URLSearchParams({ view: "summary" });

    if (params?.status) query.set("status", params.status);
    if (params?.guestEmail) query.set("guestEmail", params.guestEmail);
    if (params?.checkInFrom) query.set("checkInFrom", params.checkInFrom);
    if (params?.checkInTo) query.set("checkInTo", params.checkInTo);
    if (params?.checkOutFrom) query.set("checkOutFrom", params.checkOutFrom);
    if (params?.checkOutTo) query.set("checkOutTo", params.checkOutTo);

    return `/api/admin/hotels/${hotelId}/reservations?${query.toString()}`;
}

export default async function ReservationsPage({
    searchParams,
}: ReservationsPageProps) {
    const params = await searchParams;
    const { selectedHotel } = await requireAdminPageAccess("/admin/reservations", params?.hotelId);

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

    const reservationsPath = buildReservationsPath(selectedHotel.id, params);
    let reservations: AdminReservationSummariesResponse["reservations"] = [];
    let rooms: RoomsResponse["rooms"] = [];
    let loadError = "";

    try {
        const [reservationsData, roomsData] = await Promise.all([
            serverFetchJson<AdminReservationSummariesResponse>(
                reservationsPath,
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
        <Suspense
            fallback={
                <Card>
                    <CardContent>Loading reservations&hellip;</CardContent>
                </Card>
            }
        >
            <ReservationsClient
                key={reservationsPath}
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
        </Suspense>
    );
}
