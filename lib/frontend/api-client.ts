import { readApiError } from "./api-error";

export class FrontendApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FrontendApiError";
    this.status = status;
  }
}

export async function clientFetchJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new FrontendApiError(await readApiError(response), response.status);
  }

  return (await response.json()) as T;
}
