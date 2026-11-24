import type { ConfigService } from "@nestjs/config";

export type TransactionalEmail = { to: string; subject: string; text: string };
export type SendTransactionalEmail = (message: TransactionalEmail, key: string) => Promise<void>;

export function getResendSender(config: ConfigService): SendTransactionalEmail | null {
  const apiKey = config.get<string>("RESEND_API_KEY")?.trim();
  const from = config.get<string>("EMAIL_FROM")?.trim();
  if (!apiKey || !from) return null;

  return async (message, key) => {
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
  };
}
