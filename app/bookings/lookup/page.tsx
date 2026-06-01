import Link from "next/link";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BookingLookupForm } from "@/components/public/BookingLookupForm";
import { Badge } from "@/components/ui/Badge";

export default function BookingLookupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />

      <main className="flex-1">
        <section className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_38%,#ffffff_100%)]">
          <div className="luxury-container grid gap-10 py-10 lg:grid-cols-[1fr_430px] lg:items-center lg:py-16">
            <div>
              <Badge variant="luxury">My booking</Badge>

              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl">
                Find your reservation.
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                Enter your reservation number and the email used during booking
                to view stay details, payment status, and next steps.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  "View booking details",
                  "Check payment status",
                  "Continue payment later",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-3xl border border-luxury-stone bg-white/85 p-5 shadow-sm"
                  >
                    <p className="text-sm font-black text-luxury-ink">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
              <div className="border-b border-luxury-stone p-6">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                  Lookup
                </p>

                <h2 className="mt-3 text-xl font-black text-luxury-ink">
                  Booking lookup
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use the same email from your reservation.
                </p>
              </div>

              <div className="p-6">
                <BookingLookupForm />

                <p className="mt-5 text-sm text-slate-600">
                  Need a new stay?{" "}
                  <Link
                    href="/hotels"
                    className="font-black text-luxury-gold transition hover:text-luxury-ink"
                  >
                    Browse hotels
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
