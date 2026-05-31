import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guestProfileUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const currentUser = await getCurrentAuthUser();

  if (!currentUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = guestProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid profile data",
        details: parsed.error.flatten(),
      },
      { status: 400 },
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
    },
  });

  return NextResponse.json({
    message: "Profile updated",
    user: {
      ...updatedUser,
      globalRoles: currentUser.globalRoles,
      hotelRoles: currentUser.hotelRoles,
    },
  });
}