import { Prisma } from "@prisma/client";

const HOTEL_INVENTORY_LOCK_NAMESPACE = "hotel-reservation-inventory";

function hashToSignedInt32(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash | 0;
}

export function getHotelInventoryAdvisoryLockKey(hotelId: string) {
  return {
    namespace: hashToSignedInt32(HOTEL_INVENTORY_LOCK_NAMESPACE),
    key: hashToSignedInt32(hotelId),
  };
}

export async function lockHotelReservationInventory(
  tx: Prisma.TransactionClient,
  hotelId: string,
) {
  const { namespace, key } = getHotelInventoryAdvisoryLockKey(hotelId);

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(${namespace}, ${key})
  `;
}
