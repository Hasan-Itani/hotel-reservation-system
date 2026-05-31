"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetchJson } from "@/lib/frontend/api-client";
import type { LogoutResponse } from "@/lib/frontend/types";

export function GuestLogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);

    try {
      await clientFetchJson<LogoutResponse>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isLoggingOut}
      className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream disabled:opacity-60"
    >
      {isLoggingOut ? "Signing out..." : "Sign out"}
    </button>
  );
}