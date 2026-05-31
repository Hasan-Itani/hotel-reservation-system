import { redirect } from "next/navigation";
import { GuestLoginForm } from "@/components/guest/GuestLoginForm";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import { canEnterAdmin } from "@/lib/frontend/permissions";
import { getSafeRedirectPath } from "@/lib/frontend/safe-redirect";

type GuestLoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

function resolveLoggedInRedirect(input: {
  next: string;
  canAccessAdmin: boolean;
}) {
  if (input.next.startsWith("/admin") && !input.canAccessAdmin) {
    return "/guest/account";
  }

  return input.next;
}

export default async function GuestLoginPage({
  searchParams,
}: GuestLoginPageProps) {
  const user = await getServerAuthUser();
  const query = await searchParams;
  const next = getSafeRedirectPath(query?.next);

  if (user) {
    redirect(
      resolveLoggedInRedirect({
        next,
        canAccessAdmin: canEnterAdmin(user),
      }),
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto flex max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Guest sign in
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to manage your reservations and payments.
            </p>
          </div>

          <Card>
            <CardContent>
              <GuestLoginForm />
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}