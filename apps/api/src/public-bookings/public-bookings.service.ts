import { Inject, Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class PublicBookingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByReservationNumberAndGuestEmail(
    reservationNumber: string,
    guestEmail: string,
  ) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        reservationNumber,
        guestEmail,
        hotel: {
          deletedAt: null,
        },
      },
      select: {
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
      },
    });

    if (!reservation) {
      return null;
    }

    const total = roundMoney(Number(reservation.total));
    const paid = roundMoney(
      reservation.payments
        .filter((payment) => payment.status === PaymentStatus.PAID)
        .reduce((sum, payment) => sum + Number(payment.amount), 0),
    );
    const remaining = roundMoney(Math.max(total - paid, 0));

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
      subtotal: roundMoney(Number(reservation.subtotal)),
      taxes: roundMoney(Number(reservation.taxes)),
      serviceFee: roundMoney(Number(reservation.serviceFee)),
      discountAmount: roundMoney(Number(reservation.discountAmount)),
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
      hotel: reservation.hotel,
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
        assignedRoom: item.room,
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
}
