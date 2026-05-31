import Link from "next/link";
import { HotelRoomsAvailability } from "@/components/public/HotelRoomsAvailability";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type {
    PublicHotelDetailResponse,
    PublicRoomType,
    PublicRoomTypesResponse,
} from "@/lib/frontend/types";

type HotelDetailsPageProps = {
    params: Promise<{
        slug: string;
    }>;
};

async function getBaseUrl() {
    const headerStore = await headers();
    const host = headerStore.get("host");

    if (!host) {
        throw new Error("Unable to resolve host");
    }

    const protocol =
        headerStore.get("x-forwarded-proto") ||
        (process.env.NODE_ENV === "production" ? "https" : "http");

    return `${protocol}://${host}`;
}

async function getHotel(slug: string) {
    const baseUrl = await getBaseUrl();

    const response = await fetch(`${baseUrl}/api/public/hotels/${slug}`, {
        cache: "no-store",
    });

    if (response.status === 404) {
        notFound();
    }

    if (!response.ok) {
        throw new Error("Unable to load hotel");
    }

    const data = (await response.json()) as PublicHotelDetailResponse;
    return data.hotel;
}

async function getRoomTypes(slug: string) {
    const baseUrl = await getBaseUrl();

    const response = await fetch(
        `${baseUrl}/api/public/hotels/${slug}/room-types`,
        {
            cache: "no-store",
        },
    );

    if (!response.ok) {
        return [];
    }

    const data = (await response.json()) as PublicRoomTypesResponse;
    return data.roomTypes;
}

function formatPrice(price: number, currency: string) {
    return new Intl.NumberFormat("en", {
        style: "currency",
        currency,
    }).format(price);
}

function getPrimaryRoomImage(roomType: PublicRoomType) {
    return (
        roomType.images.find((image) => image.isPrimary) ||
        roomType.images[0] ||
        null
    );
}

export default async function HotelDetailsPage({
    params,
}: HotelDetailsPageProps) {
    const { slug } = await params;

    const [hotel, roomTypes] = await Promise.all([
        getHotel(slug),
        getRoomTypes(slug),
    ]);

    const heroRoom = roomTypes[0] || null;
    const heroImage = heroRoom ? getPrimaryRoomImage(heroRoom) : null;

    return (
        <div className="min-h-screen bg-background">
            <PublicHeader />

            <main>
                <section className="border-b border-border bg-white">
                    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="primary">{hotel.city}</Badge>
                                {hotel.starRating ? (
                                    <Badge variant="warning">{hotel.starRating} stars</Badge>
                                ) : null}
                                <Badge>{hotel.currency}</Badge>
                            </div>

                            <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                                {hotel.name}
                            </h1>

                            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                                {hotel.description ||
                                    "Explore rooms, services, availability, and booking options for this hotel."}
                            </p>

                            <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                                <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
                                    <p className="font-medium text-foreground">Location</p>
                                    <p className="mt-1">
                                        {hotel.addressLine1}
                                        {hotel.addressLine2 ? `, ${hotel.addressLine2}` : ""}
                                    </p>
                                    <p>
                                        {hotel.city}, {hotel.country}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
                                    <p className="font-medium text-foreground">Hotel policy</p>
                                    <p className="mt-1">
                                        Check-in: {hotel.checkInTime || "Contact hotel"}
                                    </p>
                                    <p>Check-out: {hotel.checkOutTime || "Contact hotel"}</p>
                                </div>
                            </div>

                            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                                <a
                                    href="#rooms"
                                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-hover"
                                >
                                    View Rooms
                                </a>

                                <a
                                    href="#availability"
                                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-bold text-foreground transition hover:bg-surface-muted"
                                >
                                    Check Availability
                                </a>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm">
                            <div className="flex h-80 items-center justify-center bg-slate-200">
                                {heroImage ? (
                                    <img
                                        src={heroImage.url}
                                        alt={heroImage.altText || hotel.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="px-6 text-center">
                                        <p className="text-sm font-bold text-slate-600">
                                            Hotel Image
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Add room type images later
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="p-5">
                                <p className="text-sm font-bold text-foreground">
                                    Contact hotel
                                </p>
                                <p className="mt-2 break-all text-sm text-muted-foreground">
                                    {hotel.email || "Email not available"}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {hotel.phone || "Phone not available"}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <HotelRoomsAvailability
                    hotelSlug={hotel.slug}
                    currency={hotel.currency}
                    roomTypes={roomTypes}
                />
            </main>

            <PublicFooter />
        </div>
    );
}