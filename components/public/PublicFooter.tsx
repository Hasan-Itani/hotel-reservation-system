import Link from "next/link";

const COPYRIGHT_YEAR = 2026;

export function PublicFooter() {
  return (
    <footer className="border-t border-luxury-stone bg-luxury-navy text-white">
      <div className="luxury-container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.15fr_0.75fr_0.75fr_0.85fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-base font-bold text-luxury-navy">
              H
            </div>

            <div>
              <p className="text-sm font-bold tracking-wide">Hotel System</p>
              <p className="text-xs text-white/60">Premium hotel booking</p>
            </div>
          </div>

          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
            A modern reservation platform for guests and hotel teams. Browse
            hotels, check live availability, book rooms, manage payments, and
            send hotel inquiries from one clean experience.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold-soft">
              Guest support
            </p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Contact messages are saved for hotel staff in admin inquiries.
              Email notifications can be added later.
            </p>
          </div>
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

            <Link href="/hotels" className="transition hover:text-white">
              Contact a hotel
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">Hotel Experience</p>

          <div className="mt-4 grid gap-3 text-sm text-white/65">
            <Link href="/hotels" className="transition hover:text-white">
              Rooms and suites
            </Link>

            <Link href="/hotels" className="transition hover:text-white">
              Dining and amenities
            </Link>

            <Link href="/hotels" className="transition hover:text-white">
              Hotel gallery
            </Link>

            <Link href="/hotels" className="transition hover:text-white">
              Location and directions
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">Platform</p>

          <div className="mt-4 grid gap-3 text-sm text-white/65">
            <p>Secure guest accounts</p>
            <p>Live room availability</p>
            <p>Booking lookup and payments</p>
            <p>Admin reservation tools</p>
            <p>Hotel inquiry management</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="luxury-container flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {COPYRIGHT_YEAR} Hotel System. All rights reserved.
          </p>
          <p>Booking, payments, guest accounts, and hotel inquiries.</p>
        </div>
      </div>
    </footer>
  );
}
