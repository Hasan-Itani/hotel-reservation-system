import { Prisma } from "@prisma/client";
import {
  calculatePaidAmount,
  calculateRemainingBalance,
} from "@/lib/reservationPayments";
import { roundMoney } from "@/lib/money";

export const publicBookingSelect = {
  reservationNumber: true,
  status: true,
  guestFirstName: true,
  guestLastName: true,
  guestEmail: true,
  guestPhone: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children: true,
  specialRequests: true,
  subtotal: true,
  taxes: true,
  serviceFee: true,
  discountAmount: true,
  total: true,
  currency: true,
  createdAt: true,
  confirmedAt: true,
  cancelledAt: true,
  checkedInAt: true,
  checkedOutAt: true,
  noShowAt: true,
  hotel: {
    select: {
      name: true,
      slug: true,
      city: true,
      country: true,
      currency: true,
      checkInTime: true,
      checkOutTime: true,
    },
  },
  reservationRooms: {
    select: {
      guests: true,
      nightlyPrice: true,
      room: {
        select: {
          roomNumber: true,
          floor: true,
        },
      },
      roomType: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          basePrice: true,
          capacityAdults: true,
          capacityChildren: true,
          bedType: true,
          roomSizeSqm: true,
          images: {
            orderBy: {
              sortOrder: "asc",
            },
            select: {
              id: true,
              url: true,
              altText: true,
              sortOrder: true,
              isPrimary: true,
            },
          },
        },
      },
    },
  },
  payments: {
    orderBy: {
      createdAt: "desc",
    },
    select: {
      methodLabel: true,
      cardLast4: true,
      isMock: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ReservationSelect;

export type PublicBookingReservation = Prisma.ReservationGetPayload<{
  select: typeof publicBookingSelect;
}>;

export function serializePublicBooking(reservation: PublicBookingReservation) {
  const total = roundMoney(Number(reservation.total));
  const subtotal = roundMoney(Number(reservation.subtotal));
  const taxes = roundMoney(Number(reservation.taxes));
  const serviceFee = roundMoney(Number(reservation.serviceFee));
  const discountAmount = roundMoney(Number(reservation.discountAmount));
  const paid = calculatePaidAmount(reservation.payments);
  const remaining = calculateRemainingBalance(total, paid);

  return {
    reservationNumber: reservation.reservationNumber,
    status: reservation.status,
    guestFirstName: reservation.guestFirstName,
    guestLastName: reservation.guestLastName,
    guestEmail: reservation.guestEmail,
    guestPhone: reservation.guestPhone,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    adults: reservation.adults,
    children: reservation.children,
    specialRequests: reservation.specialRequests,
    subtotal,
    taxes,
    serviceFee,
    discountAmount,
    total,
    currency: reservation.currency,
    createdAt: reservation.createdAt,
    confirmedAt: reservation.confirmedAt,
    cancelledAt: reservation.cancelledAt,
    checkedInAt: reservation.checkedInAt,
    checkedOutAt: reservation.checkedOutAt,
    noShowAt: reservation.noShowAt,
    paymentSummary: {
      total,
      paid,
      remaining,
    },
    hotel: {
      name: reservation.hotel.name,
      slug: reservation.hotel.slug,
      city: reservation.hotel.city,
      country: reservation.hotel.country,
      currency: reservation.hotel.currency,
      checkInTime: reservation.hotel.checkInTime,
      checkOutTime: reservation.hotel.checkOutTime,
    },
    rooms: reservation.reservationRooms.map((item) => ({
      guests: item.guests,
      nightlyPrice: roundMoney(Number(item.nightlyPrice)),
      roomType: {
        id: item.roomType.id,
        name: item.roomType.name,
        slug: item.roomType.slug,
        description: item.roomType.description,
        basePrice: roundMoney(Number(item.roomType.basePrice)),
        capacityAdults: item.roomType.capacityAdults,
        capacityChildren: item.roomType.capacityChildren,
        bedType: item.roomType.bedType,
        roomSizeSqm:
          item.roomType.roomSizeSqm === null
            ? null
            : roundMoney(Number(item.roomType.roomSizeSqm)),
        images: item.roomType.images,
      },
      assignedRoom: item.room
        ? {
            roomNumber: item.room.roomNumber,
            floor: item.room.floor,
          }
        : null,
    })),
    payments: reservation.payments.map((payment) => ({
      methodLabel: payment.methodLabel,
      cardLast4: payment.cardLast4,
      isMock: payment.isMock,
      amount: roundMoney(Number(payment.amount)),
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    })),
  };
}