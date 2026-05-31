import type { ApiErrorResponse } from "@/lib/frontend/types";

export class FrontendApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FrontendApiError";
    this.status = status;
  }
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as Partial<ApiErrorResponse>;
    return data.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
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
    throw new FrontendApiError(await readError(response), response.status);
  }

  return (await response.json()) as T;
}