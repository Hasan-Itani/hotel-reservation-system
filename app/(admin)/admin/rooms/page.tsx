import { redirect } from "next/navigation";
import { RoomsClient } from "@/components/rooms/RoomsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import { canManageRooms } from "@/lib/frontend/permissions";
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
          <h1 className="text-xl font-bold text-foreground">Rooms</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No hotel is available for this account.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canManageRooms(user, selectedHotel.id)) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need HOTEL_ADMIN or MANAGER access to manage rooms.
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