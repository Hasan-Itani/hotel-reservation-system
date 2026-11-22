import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";
import { isNestApiProxyConfigured, proxyNestJsonRequest } from "@/lib/nestApiProxy";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/session";
import { guestProfileUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (isNestApiProxyConfigured()) {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const response = await proxyNestJsonRequest(request, "/guest/profile", { sessionToken });
    if (response) {
      response.headers.set("Cache-Control", headers["Cache-Control"]);
      return response;
    }
  }

  const currentUser = await getCurrentAuthUser();

  if (!currentUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers },
    );
  }

  const parsed = guestProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid profile data",
        details: parsed.error.flatten(),
      },
      { status: 400, headers },
    );
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      emailVerifiedAt: true,
    },
  });

  return NextResponse.json({
    message: "Profile updated",
    user: {
      ...updatedUser,
      globalRoles: currentUser.globalRoles,
      hotelRoles: currentUser.hotelRoles,
    },
  }, { headers });
}
