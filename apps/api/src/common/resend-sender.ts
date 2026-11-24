import type { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { createAuditLog, type AuditLogClient } from "./audit-log";

export type TransactionalEmail = { to: string; subject: string; text: string };
type NotificationContext = {
  hotelId: string;
  reservationId: string;
  reservationNumber: string;
  emailType: "Booking confirmation" | "Partial payment receipt" | "Payment receipt" | "Refund notice" | "Checkout summary" | "Cancellation notice";
};
export type SendTransactionalEmail = (
  message: TransactionalEmail,
  key: string,
  context: NotificationContext,
) => Promise<void>;

const logger = new Logger("NotificationHistory");

export function getResendSender(
  config: ConfigService,
  audit: AuditLogClient,
  request: typeof fetch = fetch,
): SendTransactionalEmail | null {
  const apiKey = config.get<string>("RESEND_API_KEY")?.trim();
  const from = config.get<string>("EMAIL_FROM")?.trim();
  if (!apiKey || !from) return null;

  return async (message, key, context) => {
    let accepted = false;
    let providerStatus: number | undefined;

    try {
      const response = await request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ from, ...message }),
        signal: AbortSignal.timeout(5_000),
      });
      accepted = response.ok;
      providerStatus = response.status;
      if (!accepted) throw new Error(`Email provider returned ${providerStatus}`);
    } finally {
      try {
        const outcome = accepted ? "Accepted by Resend (delivery not verified)"
          : providerStatus === undefined ? "Failed: no response from Resend"
            : "Failed: rejected by Resend";
        await createAuditLog({
          hotelId: context.hotelId,
          action: accepted ? "EMAIL_ACCEPTED_BY_RESEND" : "EMAIL_SEND_FAILED",
          entityType: "Reservation",
          entityId: context.reservationId,
          summary: `${context.emailType} for ${context.reservationNumber}: ${outcome}`,
          metadata: {
            reservationNumber: context.reservationNumber,
            emailType: context.emailType,
            outcome,
            ...(providerStatus === undefined ? {} : { providerStatus }),
          },
        }, audit);
      } catch {
        logger.warn("Unable to record an email attempt in notification history.");
      }
    }
  };
}
