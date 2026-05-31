import "server-only";

import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import type {
  AuthMeResponse,
  AuthUser,
  HotelsResponse,
  Hotel,
} from "@/lib/frontend/types";

export async function getServerAuthUser(): Promise<AuthUser | null> {
  try {
    const data = await serverFetchJson<AuthMeResponse>("/api/auth/me");

    if (!data.authenticated) {
      return null;
    }

    return data.user;
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function getServerHotels(): Promise<Hotel[]> {
  const data = await serverFetchJson<HotelsResponse>("/api/admin/hotels");
  return data.hotels;
}