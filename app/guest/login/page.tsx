import { redirect } from "next/navigation";
import { GuestLoginForm } from "@/components/guest/GuestLoginForm";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import { canEnterAdmin } from "@/lib/frontend/permissions";
import { getSafeRedirectPath } from "@/lib/frontend/safe-redirect";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guest Sign In",
  description:
    "Sign in to manage hotel reservations, guest details, and payment status.",
};

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
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
          <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 text-center sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Guest access
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
              Guest sign in
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Sign in to manage reservations, payments, and guest details.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <GuestLoginForm />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
