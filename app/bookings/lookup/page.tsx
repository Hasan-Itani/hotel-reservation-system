import Link from "next/link";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BookingLookupForm } from "@/components/public/BookingLookupForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function BookingLookupPage() {
    return (
        <div className="min-h-screen bg-background">
            <PublicHeader />

            <main className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
                <section>
                    <Badge variant="primary">My Booking</Badge>

                    <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                        Find your reservation.
                    </h1>

                    <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                        Enter your reservation number and the email used during booking to
                        view your stay details, payment status, and next steps.
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        {[
                            "View booking details",
                            "Check payment status",
                            "Continue payment later",
                        ].map((item) => (
                            <div
                                key={item}
                                className="rounded-card border border-border bg-white p-4 shadow-sm"
                            >
                                <p className="text-sm font-bold text-foreground">{item}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <Card>
                    <CardHeader>
                        <h2 className="text-lg font-bold text-foreground">
                            Booking lookup
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Use the same email from your reservation.
                        </p>
                    </CardHeader>

                    <CardContent>
                        <BookingLookupForm />

                        <p className="mt-5 text-sm text-muted-foreground">
                            Need a new stay?{" "}
                            <Link href="/hotels" className="font-bold text-primary">
                                Browse hotels
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </main>

            <PublicFooter />
        </div>
    );
}