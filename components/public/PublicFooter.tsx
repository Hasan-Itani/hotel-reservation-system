import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-luxury-stone bg-luxury-navy text-white">
      <div className="luxury-container grid gap-10 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-base font-bold text-luxury-navy">
              H
            </div>

            <div>
              <p className="text-sm font-bold tracking-wide">Hotel System</p>
              <p className="text-xs text-white/60">Premium hotel booking</p>
            </div>
          </div>

          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
            A modern reservation platform for guests and hotel teams. Browse
            hotels, check live availability, book rooms, and manage payments
            from one clean experience.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold">Guest Services</p>

          <div className="mt-4 grid gap-3 text-sm text-white/65">
            <Link href="/hotels" className="transition hover:text-white">
              Browse hotels
            </Link>

            <Link href="/bookings/lookup" className="transition hover:text-white">
              Find booking
            </Link>

            <Link href="/guest/account" className="transition hover:text-white">
              Guest account
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">Platform</p>

          <div className="mt-4 grid gap-3 text-sm text-white/65">
            <p>Secure guest accounts</p>
            <p>Live room availability</p>
            <p>Admin reservation tools</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="luxury-container flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Hotel System. All rights reserved.</p>
          <p>Built for hotel reservations and guest management.</p>
        </div>
      </div>
    </footer>
  );
}