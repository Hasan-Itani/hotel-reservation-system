import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHotelAccess } from "@/lib/guards";
import { getRoomTypeAvailabilityForHotel } from "@/lib/reservationAvailability";
import { availabilityQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hotelId: string }> },
) {
  const { hotelId } = await params;

  const auth = await requireHotelAccess(hotelId);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);

  const parsed = availabilityQuerySchema.safeParse({
    checkInDate: url.searchParams.get("checkInDate"),
    checkOutDate: url.searchParams.get("checkOutDate"),
    adults: url.searchParams.get("adults") ?? undefined,
    children: url.searchParams.get("children") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { checkInDate, checkOutDate, adults, children } = parsed.data;

  const hotel = await prisma.hotel.findFirst({
    where: {
      id: hotelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      currency: true,
    },
  });

  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
  }

  const availability = await getRoomTypeAvailabilityForHotel({
    hotelId,
    checkInDate,
    checkOutDate,
    adults,
    children,
  });

  return NextResponse.json({
    hotelId: hotel.id,
    hotelName: hotel.name,
    currency: hotel.currency,
    checkInDate,
    checkOutDate,
    roomTypes: availability.availability,
  });
}