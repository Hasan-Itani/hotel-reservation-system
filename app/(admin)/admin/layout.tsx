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
      <main className="flex min-h-screen items-center justify-center bg-luxury-cream px-4 text-luxury-ink">
        <div className="max-w-md rounded-[2rem] border border-luxury-stone bg-white p-6 text-center shadow-xl shadow-slate-900/5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-luxury-navy text-base font-bold text-white">
            H
          </div>

          <h1 className="mt-5 text-xl font-black text-luxury-ink">
            Access denied
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Your account is active, but it does not have staff/admin access to any
            hotel.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/guest/account"
              className="inline-flex h-10 items-center justify-center rounded-full bg-luxury-navy px-4 text-sm font-bold text-white transition hover:bg-luxury-ink"
            >
              Go to guest account
            </Link>

            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-full border border-luxury-stone px-4 text-sm font-bold text-luxury-ink transition hover:bg-luxury-cream"
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
