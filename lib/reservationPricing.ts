import { Prisma } from "@prisma/client";
import {
  addMoney,
  isValidMoneyAmount,
  multiplyMoney,
  normalizeMoney,
  roundMoney,
} from "@/lib/money";

type ReservationPricingRoom = {
  roomTypeId: string;
  guests: number;
};

type RoomTypePricingData = {
  basePrice: Prisma.Decimal | number;
};

export function getRoomTypeNightlyPrice(roomType: RoomTypePricingData) {
  return normalizeMoney(roomType.basePrice);
}

export function calculateReservationPricing(input: {
  nights: number;
  rooms: ReservationPricingRoom[];
  roomTypeMap: Map<string, RoomTypePricingData>;
  taxes?: number;
  serviceFee?: number;
  discountAmount?: number;
}) {
  if (!Number.isInteger(input.nights) || input.nights < 1) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: "Reservation must be at least 1 night",
      },
    };
  }

  let subtotal = 0;

  for (const room of input.rooms) {
    const roomType = input.roomTypeMap.get(room.roomTypeId);

    if (!roomType) {
      return {
        ok: false as const,
        status: 400,
        body: {
          error: "Room type pricing data is missing",
          roomTypeId: room.roomTypeId,
        },
      };
    }

    subtotal = addMoney(
      subtotal,
      multiplyMoney(getRoomTypeNightlyPrice(roomType), input.nights),
    );
  }

  const taxes = normalizeMoney(input.taxes ?? 0);
  const serviceFee = normalizeMoney(input.serviceFee ?? 0);
  const discountAmount = normalizeMoney(input.discountAmount ?? 0);

  if (
    !isValidMoneyAmount(subtotal) ||
    !isValidMoneyAmount(taxes) ||
    !isValidMoneyAmount(serviceFee) ||
    !isValidMoneyAmount(discountAmount)
  ) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: "Money values must be valid non-negative numbers",
      },
    };
  }

  const total = roundMoney(subtotal + taxes + serviceFee - discountAmount);

  if (total < 0) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: "Total cannot be negative",
        subtotal,
        taxes,
        serviceFee,
        discountAmount,
      },
    };
  }

  return {
    ok: true as const,
    subtotal,
    taxes,
    serviceFee,
    discountAmount,
    total,
  };
}