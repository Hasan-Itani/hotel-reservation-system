const genericMessages = new Set([
  "bad request",
  "validation failed",
  "request failed",
  "unauthorized",
  "forbidden",
  "not found",
  "conflict",
  "unprocessable entity",
  "too many requests",
  "internal server error",
  "bad gateway",
  "service unavailable",
  "gateway timeout",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function messages(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );
}

function labelField(field: string) {
  const label = field
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function validationMessages(details: unknown) {
  const validation = asRecord(details);
  const fields = asRecord(validation?.fieldErrors);
  const fieldMessages = Object.entries(fields ?? {}).flatMap(([field, errors]) => {
    const label = labelField(field);
    return messages(errors).map((message) => {
      if (message.toLowerCase().startsWith(`${label.toLowerCase()} `)) return message;
      if (/^Invalid input: expected .+, received undefined$/i.test(message)) {
        return `${label} is required.`;
      }
      return `${label}: ${message}`;
    });
  });
  return [...fieldMessages, ...messages(validation?.formErrors)];
}

function combineMessages(entries: string[]) {
  const unique = [...new Set(entries)];
  if (unique.length === 1) return unique[0];
  return unique.map((message) => /[.!?]$/.test(message) ? message : `${message}.`).join(" ");
}

export function formatApiError(status: number, data: unknown, fallback?: string) {
  const payload = asRecord(data);
  if (status === 400 || status === 422) {
    const validation = validationMessages(payload?.details);
    if (validation.length) return combineMessages(validation);
  }

  const explicit = [
    ...messages(payload?.error),
    ...(status < 500 ? messages(payload?.message) : []),
  ].filter((message) => !genericMessages.has(message.toLowerCase()));
  if (explicit.length) return combineMessages(explicit);

  if (status === 401) return "Please sign in and try again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (fallback) return fallback;
  if (status === 400 || status === 422) return "Check the information you entered and try again.";
  if (status === 404) return "We could not find what you requested.";
  if (status === 409) return "This change conflicts with existing data. Refresh and try again.";
  return "We could not complete the request. Please try again.";
}

export async function readApiError(response: Response, fallback?: string) {
  const data: unknown = await response.json().catch(() => null);
  return formatApiError(response.status, data, fallback);
}
