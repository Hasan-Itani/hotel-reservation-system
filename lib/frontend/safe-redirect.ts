export function getOptionalRedirectPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://") ||
    value.includes("\\") ||
    /[\t\n\r]/.test(value)
  ) {
    return null;
  }

  const url = new URL(value, "https://hotel.local");
  if (url.pathname.startsWith("//")) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getSafeRedirectPath(value: string | null | undefined) {
  return getOptionalRedirectPath(value) ?? "/guest/account";
}
