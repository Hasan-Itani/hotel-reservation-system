import { redirect } from "next/navigation";
import { VerifyEmailClient } from "@/components/guest/VerifyEmailClient";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Verify your guest account email address.",
};

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const [user, params] = await Promise.all([getServerAuthUser(), searchParams]);

  if (user) {
    redirect("/guest/account");
  }

  const token = params?.token || "";

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
          <div className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#ffffff_55%,#fbf7ef_100%)] p-6 text-center sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Email verification
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
              Verify your email
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Confirm your email address before signing in.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <VerifyEmailClient token={token} />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
