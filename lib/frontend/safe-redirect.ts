export function getSafeRedirectPath(value: string | null | undefined) {
  if (!value) {
    return "/guest/account";
  }

  if (!value.startsWith("/")) {
    return "/guest/account";
  }

  if (value.startsWith("//")) {
    return "/guest/account";
  }

  if (value.includes("://")) {
    return "/guest/account";
  }

  return value;
}