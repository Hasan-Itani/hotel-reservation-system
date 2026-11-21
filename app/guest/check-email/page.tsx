import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { getSafeRedirectPath } from "@/lib/frontend/safe-redirect";

export const metadata: Metadata = {
  title: "Check Your Email",
  description: "Check your inbox to verify your guest account.",
};

type GuestCheckEmailPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function GuestCheckEmailPage({
  searchParams,
}: GuestCheckEmailPageProps) {
  const { next: requestedNext } = await searchParams;
  const next = getSafeRedirectPath(
    typeof requestedNext === "string" ? requestedNext : undefined,
  );

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="w-full max-w-md rounded-[2rem] border border-luxury-stone bg-white p-6 text-center shadow-xl shadow-slate-900/5 sm:p-8">
          <h1 className="text-3xl font-black tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Open the verification link in your inbox before signing in. If you
            can’t find the email, check your spam folder.
          </p>
          <Link
            href={`/guest/login?next=${encodeURIComponent(next)}`}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-luxury-navy px-6 py-3 text-sm font-bold text-white transition hover:bg-luxury-ink"
          >
            Sign in after verifying
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
