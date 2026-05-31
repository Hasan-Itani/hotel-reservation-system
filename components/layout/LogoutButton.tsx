"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetchJson } from "@/lib/frontend/api-client";
import type { LogoutResponse } from "@/lib/frontend/types";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);

    try {
      await clientFetchJson<LogoutResponse>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={logout}
      disabled={isLoggingOut}
      className="h-9"
    >
      {isLoggingOut ? "Logging out..." : "Logout"}
    </Button>
  );
}