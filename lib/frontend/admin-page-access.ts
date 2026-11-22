import "server-only";

import { redirect } from "next/navigation";
import { getServerAuthUser, getServerHotels } from "./auth-server";
import { canEnterAdmin, canOpenAdminSection } from "./permissions";

export async function requireAdminPageAccess(path: string, hotelId?: string) {
  const user = await getServerAuthUser();
  const requestedHotelId = typeof hotelId === "string" ? hotelId : undefined;

  if (!user) {
    const next = requestedHotelId
      ? `${path}?hotelId=${encodeURIComponent(requestedHotelId)}`
      : path;
    redirect(`/guest/login?next=${encodeURIComponent(next)}`);
  }
  if (!canEnterAdmin(user)) {
    redirect("/guest/account");
  }

  const hotels = await getServerHotels();
  const selectedHotel = requestedHotelId
    ? hotels.find((hotel) => hotel.id === requestedHotelId)
    : hotels[0];

  if (
    (requestedHotelId && !selectedHotel) ||
    !canOpenAdminSection(user, path, selectedHotel?.id)
  ) {
    redirect("/admin?notice=section-unavailable");
  }

  return { user, hotels, selectedHotel };
}
