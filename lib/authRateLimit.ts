export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_ACCOUNT_MAX_REQUESTS = 5;
export const PASSWORD_RESET_IP_MAX_REQUESTS = 25;

export function getPasswordResetAccountRateLimitKey(email: string) {
  return `forgot-password-account:${email.trim().toLowerCase()}`;
}

export function getPasswordResetIpRateLimitKey(ip: string) {
  return `forgot-password-ip:${ip}`;
}