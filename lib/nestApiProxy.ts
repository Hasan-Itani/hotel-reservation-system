import "server-only";

import { NextResponse } from "next/server";

const FORWARDED_REQUEST_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
];

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

function getNestApiBaseUrl() {
  const baseUrl = process.env.NEST_API_BASE_URL?.trim();

  return baseUrl ? baseUrl.replace(/\/$/, "") : null;
}

function buildRequestHeaders(request: Request) {
  const headers = new Headers();
  const accept = request.headers.get("accept");

  if (accept) {
    headers.set("accept", accept);
  }

  for (const headerName of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(headerName);

    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

function buildResponseHeaders(response: Response) {
  const headers = new Headers();

  for (const headerName of FORWARDED_RESPONSE_HEADERS) {
    const value = response.headers.get(headerName);

    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export async function proxyNestGet(
  request: Request,
  path: string,
): Promise<NextResponse | null> {
  const baseUrl = getNestApiBaseUrl();

  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: buildRequestHeaders(request),
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: buildResponseHeaders(response),
    });
  } catch {
    return NextResponse.json(
      { error: "Hotel catalog service is unavailable" },
      { status: 502 },
    );
  }
}
