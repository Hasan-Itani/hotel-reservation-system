import "server-only";

import { NextResponse } from "next/server";
import { getNestProxyBody } from "./nestProxyBody";
import { getSessionToken } from "./session";

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
  json?: boolean;
  signal?: AbortSignal;
  unavailableError?: string;
};

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
  const headers = new Headers({ "Cache-Control": "private, no-store" });

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
): Promise<NextResponse> {
  const baseUrl = getNestApiBaseUrl();
  const error = options.unavailableError ?? "Hotel API is unavailable. Please try again.";
  const errorHeaders = { "Cache-Control": "private, no-store" };

  if (!baseUrl) {
    return NextResponse.json({ error }, { status: 503, headers: errorHeaders });
  }

  if (path.split("/").some((segment) => segment === "." || segment === "..")) {
    return NextResponse.json({ error: "Invalid route parameter" }, { status: 400, headers: errorHeaders });
  }

  let jsonBody = options.jsonBody;
  if (options.json) {
    try {
      jsonBody = await request.text();
      JSON.parse(jsonBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: errorHeaders });
    }
  }
  try {
    const method = request.method.toUpperCase();
    const headers = buildRequestHeaders(request);
    const body = await getNestProxyBody(request, method, headers, jsonBody);
    if (options.sessionToken) {
      headers.set("authorization", `Bearer ${options.sessionToken}`);
    }

    const response = await fetch(`${baseUrl}${path}${new URL(request.url).search}`, {
      method,
      cache: "no-store",
      headers,
      signal: options.signal ?? AbortSignal.timeout(30_000),
      redirect: "error",
      body,
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
      { error },
      { status: 502, headers: errorHeaders },
    );
  }
}

export async function proxyNestSessionRequest(
  request: Request,
  path: string,
  options?: NestProxyOptions,
) {
  const sessionToken = await getSessionToken();
  return proxyNestRequest(request, path, { ...options, sessionToken: sessionToken ?? undefined });
}
