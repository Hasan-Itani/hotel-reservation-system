import Link from "next/link";
import { GuestProfileForm } from "@/components/guest/GuestProfileForm";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { GuestLogoutButton } from "@/components/guest/GuestLogoutButton";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
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
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <Badge variant={isStaffUser ? "primary" : "success"}>
              {isStaffUser ? "Staff account" : "Guest account"}
            </Badge>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              Welcome, {user.firstName}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Manage your profile, reservations, and payments.
            </p>
          </div>

          <GuestLogoutButton />
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-foreground">
                Account details
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Update your guest profile information.
              </p>
            </CardHeader>

            <CardContent>
              <GuestProfileForm user={user} />

              {isStaffUser ? (
                <div className="mt-5 rounded-xl border border-warning-soft bg-warning-soft px-4 py-3 text-sm text-warning">
                  This account also has staff/admin access. Use the admin panel for hotel
                  operations.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-foreground">
                Quick actions
              </h2>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3">
                <Link
                  href="/guest/bookings"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
                >
                  My reservations
                </Link>

                <Link
                  href="/hotels"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                >
                  Browse hotels
                </Link>

                {isStaffUser ? (
                  <Link
                    href="/admin"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                  >
                    Open admin panel
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}