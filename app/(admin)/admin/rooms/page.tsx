import { RoomsClient } from "@/components/rooms/RoomsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { requireAdminPageAccess } from "@/lib/frontend/admin-page-access";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import type {
  RoomsResponse,
  RoomTypesResponse,
} from "@/lib/frontend/types";

type RoomsPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const params = await searchParams;
  const { selectedHotel } = await requireAdminPageAccess("/admin/rooms", params?.hotelId);

  if (!selectedHotel) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Rooms</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No hotel is available for this account.
          </p>
        </CardContent>
      </Card>
    );
  }

  let rooms: RoomsResponse["rooms"] = [];
  let roomTypes: RoomTypesResponse["roomTypes"] = [];
  let loadError = "";

  try {
    const [roomsData, roomTypesData] = await Promise.all([
      serverFetchJson<RoomsResponse>(
        `/api/admin/hotels/${selectedHotel.id}/rooms`
      ),
      serverFetchJson<RoomTypesResponse>(
        `/api/admin/hotels/${selectedHotel.id}/room-types`
      ),
    ]);

    rooms = roomsData.rooms;
    roomTypes = roomTypesData.roomTypes;
  } catch (error: unknown) {
    if (error instanceof ServerApiError) {
      loadError = error.message;
    } else if (error instanceof Error) {
      loadError = error.message;
    } else {
      loadError = "Unable to load rooms";
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Rooms</h1>
          <p className="mt-2 text-sm text-danger">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <RoomsClient
      hotel={selectedHotel}
      initialRooms={rooms}
      roomTypes={roomTypes}
    />
  );
}
