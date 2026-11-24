import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getResendSender } from "../common/resend-sender";
import { sendPaidBookingConfirmation } from "./paid-confirmation-email";

const logger = new Logger("PaidBookingConfirmation");

export async function tryPaidBookingConfirmation(
  database: PrismaClient,
  config: ConfigService,
  where: Prisma.ReservationWhereUniqueInput,
) {
  const send = getResendSender(config, database);
  if (!send) return;

  try {
    await sendPaidBookingConfirmation(database, where, send);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return;
    logger.warn("Unable to send booking confirmation email after payment. The payment was already committed.");
  }
}
