import "server-only";

import { headers } from "next/headers";
import type { ApiErrorResponse } from "@/lib/frontend/types";

export class ServerApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ServerApiError";
    this.status = status;
  }
}

async function getBaseUrl() {
  const headerStore = await headers();

  const host = headerStore.get("host");

  if (!host) {
    throw new Error("Unable to resolve request host");
  }

  const protocol =
    headerStore.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
}

async function getForwardedCookieHeader() {
  const headerStore = await headers();
  return headerStore.get("cookie") || "";
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as Partial<ApiErrorResponse>;
    return data.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function serverFetchJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const baseUrl = await getBaseUrl();
  const cookie = await getForwardedCookieHeader();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      cookie,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new ServerApiError(await readError(response), response.status);
  }

  return (await response.json()) as T;
}