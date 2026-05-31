import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";
import { canAccessHotel, hasGlobalRole, hasHotelRole } from "@/lib/permissions";

export async function requireAuth() {
  const user = await getCurrentAuthUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true as const,
    user,
  };
}

export async function requireSuperAdmin() {
  const auth = await requireAuth();

  if (!auth.ok) {
    return auth;
  }

  if (!hasGlobalRole(auth.user, "SUPER_ADMIN")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireHotelAccess(hotelId: string) {
  const auth = await requireAuth();

  if (!auth.ok) {
    return auth;
  }

  if (!canAccessHotel(auth.user, hotelId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "You do not have access to this hotel" },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export async function requireHotelRole(hotelId: string, roleName: string) {
  const auth = await requireAuth();

  if (!auth.ok) {
    return auth;
  }

  if (hasGlobalRole(auth.user, "SUPER_ADMIN")) {
    return auth;
  }

  if (!hasHotelRole(auth.user, hotelId, roleName)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `Requires role ${roleName} for this hotel` },
        { status: 403 }
      ),
    };
  }

  return auth;
}