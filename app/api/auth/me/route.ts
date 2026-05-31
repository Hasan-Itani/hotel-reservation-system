export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user,
  });
}