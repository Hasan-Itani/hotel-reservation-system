import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { canEnterAdmin } from "@/lib/frontend/permissions";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerAuthUser();

  if (!user) {
    redirect(`/guest/login?next=${encodeURIComponent("/admin")}`);
  }
  if (!canEnterAdmin(user)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-card border border-border bg-surface p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Your account is active, but it does not have staff/admin access to any
            hotel.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/guest/account"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
            >
              Go to guest account
            </Link>

            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
            >
              Back to home
            </Link>

          </div>
        </div>
      </main>
    )
  }

  const hotels = await getServerHotels();

  return (
    <AdminShell user={user} hotels={hotels}>
      {children}
    </AdminShell>
  );
}