import "server-only";

import { NextResponse } from "next/server";

const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "x-forwarded-host",
  "x-forwarded-proto",
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
  "cache-control",
];

type NestProxyOptions = {
  sessionToken?: string;
  receiveSession?: (token: string) => Promise<void>;
  jsonBody?: string;
};

function getNestApiBaseUrl() {
  const baseUrl = process.env.NEST_API_BASE_URL?.trim();

  return baseUrl ? baseUrl.replace(/\/$/, "") : null;
}

export function isNestApiProxyConfigured() {
  return getNestApiBaseUrl() !== null;
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

  if (!headers.has("x-forwarded-host")) {
    const host = request.headers.get("host");

    if (host) {
      headers.set("x-forwarded-host", host);
    }
  }

  if (!headers.has("x-forwarded-proto")) {
    const protocol = new URL(request.url).protocol.replace(":", "");
    headers.set("x-forwarded-proto", protocol);
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

export async function proxyNestRequest(
  request: Request,
  path: string,
  options: NestProxyOptions = {},
): Promise<NextResponse | null> {
  const baseUrl = getNestApiBaseUrl();

  if (!baseUrl) {
    return null;
  }

  try {
    const usesSession = options.sessionToken || options.receiveSession;
    const method = request.method.toUpperCase();
    const headers = buildRequestHeaders(request);
    if (options.jsonBody !== undefined) {
      headers.set("content-type", "application/json");
    }
    if (options.sessionToken) {
      headers.set("authorization", `Bearer ${options.sessionToken}`);
    }

    const response = await fetch(`${baseUrl}${path}${new URL(request.url).search}`, {
      method,
      cache: "no-store",
      headers,
      ...(usesSession ? { redirect: "error" as const } : {}),
      ...(method === "GET" || method === "HEAD"
        ? {}
        : {
            body: options.jsonBody ?? await request.text(),
          }),
    });

    if (options.receiveSession && response.ok) {
      const cookie = response.headers.getSetCookie().find((value) => value.startsWith("session="));
      const token = cookie?.match(/^session=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)(?:;|$)/)?.[1];
      if (!token) {
        throw new Error("NestJS login response is missing the session cookie");
      }

      await options.receiveSession(token);
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: buildResponseHeaders(response),
    });
  } catch {
    return NextResponse.json(
      { error: options.sessionToken || options.receiveSession ? "Session service is unavailable" : "Hotel catalog service is unavailable" },
      { status: 502 },
    );
  }
}

export function proxyNestGet(request: Request, path: string) {
  return proxyNestRequest(request, path);
}

export async function proxyNestJsonRequest(
  request: Request,
  path: string,
  options?: NestProxyOptions,
) {
  if (!isNestApiProxyConfigured()) {
    return null;
  }

  let body: string;
  try {
    body = await request.clone().text();
    JSON.parse(body);
  } catch {
    return null;
  }

  return proxyNestRequest(request, path, { ...options, jsonBody: body });
}
