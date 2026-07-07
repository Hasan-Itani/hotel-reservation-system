import "server-only";
import { createHash, randomBytes } from "crypto";

export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;

export function createEmailVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getEmailVerificationExpiry() {
  return new Date(
    Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  );
}
