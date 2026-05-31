import Link from "next/link";
import { getServerAuthUser } from "@/lib/frontend/auth-server";

export async function PublicHeader() {
  const user = await getServerAuthUser();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-bold text-white">
            H
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              Hotel System
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Book your stay
            </p>
          </div>
        </Link>

        <nav className="flex shrink-0 items-center gap-4 text-sm font-medium text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>

          <Link href="/hotels" className="hover:text-foreground">
            Hotels
          </Link>

          {user ? (
            <Link href="/guest/account" className="hover:text-foreground">
              Account
            </Link>
          ) : (
            <Link href="/guest/login" className="hover:text-foreground">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}