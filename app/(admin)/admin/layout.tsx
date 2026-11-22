import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { canEnterAdmin } from "@/lib/frontend/permissions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerAuthUser();

  if (!user) {
    return children;
  }
  if (!canEnterAdmin(user)) {
    redirect("/guest/account");
  }

  const hotels = await getServerHotels();

  return (
    <Suspense
      fallback={<div className="min-h-screen bg-luxury-cream text-luxury-ink" />}
    >
      <AdminShell user={user} hotels={hotels}>
        {children}
      </AdminShell>
    </Suspense>
  );
}
