import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/guest/ResetPasswordForm";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { getServerAuthUser } from "@/lib/frontend/auth-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose New Password",
  description: "Choose a new password for your guest account.",
};

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
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
              Account recovery
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink">
              Choose a new password
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use a strong password with at least 8 characters.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <ResetPasswordForm token={token} />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
