import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestProfileForm } from "@/components/guest/GuestProfileForm";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { GuestLogoutButton } from "@/components/guest/GuestLogoutButton";
import { Badge } from "@/components/ui/Badge";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import { canEnterAdmin } from "@/lib/frontend/permissions";

export default async function GuestAccountPage() {
  const user = await getServerAuthUser();

  if (!user) {
    redirect("/guest/login?next=/guest/account");
  }

  const isStaffUser = canEnterAdmin(user);

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex-1">
        <section className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_38%,#ffffff_100%)]">
          <div className="luxury-container flex flex-col justify-between gap-6 py-10 sm:flex-row sm:items-start lg:py-14">
            <div>
              <Badge variant={isStaffUser ? "primary" : "success"}>
                {isStaffUser ? "Staff account" : "Guest account"}
              </Badge>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl">
                Welcome, {user.firstName}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Manage your profile, reservations, and payments from your guest
                account.
              </p>
            </div>

            <GuestLogoutButton />
          </div>
        </section>

        <section className="luxury-container py-10 lg:py-12">
          <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
            <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="border-b border-luxury-stone p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Account details
                </p>

                <h2 className="mt-3 text-2xl font-black tracking-tight text-luxury-ink">
                  Profile information
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Update your guest profile information.
                </p>
              </div>

              <div className="p-6 sm:p-8">
                <GuestProfileForm user={user} />

                {isStaffUser ? (
                  <div className="mt-6 rounded-3xl border border-warning-soft bg-warning-soft px-5 py-4 text-sm leading-6 text-warning">
                    This account also has staff/admin access. Use the admin
                    panel for hotel operations.
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5 lg:sticky lg:top-24">
              <div className="border-b border-luxury-stone p-6">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Quick actions
                </p>

                <h2 className="mt-3 text-xl font-black text-luxury-ink">
                  Guest tools
                </h2>
              </div>

              <div className="grid gap-3 p-6">
                <Link
                  href="/guest/bookings"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                >
                  My reservations
                </Link>

                <Link
                  href="/hotels"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                >
                  Browse hotels
                </Link>

                {isStaffUser ? (
                  <Link
                    href="/admin"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                  >
                    Open admin panel
                  </Link>
                ) : null}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}