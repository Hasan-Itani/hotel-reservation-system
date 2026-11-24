import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Prisma, type PrismaClient } from "@prisma/client";
import { sendPaidBookingConfirmation } from "./paid-confirmation-email";

const logger = new Logger("PaidBookingConfirmation");

export async function tryPaidBookingConfirmation(
  database: PrismaClient,
  config: ConfigService,
  where: Prisma.ReservationWhereUniqueInput,
) {
  const apiKey = config.get<string>("RESEND_API_KEY")?.trim();
  const from = config.get<string>("EMAIL_FROM")?.trim();
  if (!apiKey || !from) return;

  try {
    await sendPaidBookingConfirmation(database, where, async (message, key) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ from, ...message }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return;
    logger.warn("Unable to send booking confirmation email after payment. The payment was already committed.");
  }
}
