import { redirect } from "next/navigation";
import { GuestRegisterForm } from "@/components/guest/GuestRegisterForm";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import { getSafeRedirectPath } from "@/lib/frontend/safe-redirect";

type GuestRegisterPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function GuestRegisterPage({
  searchParams,
}: GuestRegisterPageProps) {
  const user = await getServerAuthUser();
  const query = await searchParams;
  const next = getSafeRedirectPath(query?.next);

  if (user) {
    redirect(next);
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto flex max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create your guest account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Register to book stays and manage your reservations.
            </p>
          </div>

          <Card>
            <CardContent>
              <GuestRegisterForm />
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}