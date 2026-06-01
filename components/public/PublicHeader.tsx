import Link from "next/link";
import { getServerAuthUser } from "@/lib/frontend/auth-server";

export async function PublicHeader() {
  const user = await getServerAuthUser();

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
      <div className="luxury-container flex min-h-20 items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-luxury-navy text-base font-bold text-white shadow-sm">
            H
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-luxury-ink">
              Hotel System
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Premium stays, simple booking
            </p>
          </div>
        </Link>

        <nav className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-600 sm:gap-6">
          <Link href="/" className="hidden transition hover:text-luxury-ink sm:inline">
            Home
          </Link>

          <Link href="/hotels" className="transition hover:text-luxury-ink">
            Hotels
          </Link>

          {user ? (
            <Link
              href="/guest/account"
              className="inline-flex h-10 items-center justify-center rounded-full border border-luxury-stone bg-white px-3 text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream sm:px-4"
            >
              Account
            </Link>
          ) : (
            <Link
              href="/guest/login"
              className="inline-flex h-10 items-center justify-center rounded-full border border-luxury-stone bg-white px-3 text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream sm:px-4"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
