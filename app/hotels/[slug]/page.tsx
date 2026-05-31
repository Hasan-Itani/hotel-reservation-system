import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { HotelRoomsAvailability } from "@/components/public/HotelRoomsAvailability";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Badge } from "@/components/ui/Badge";
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

function getPrimaryRoomImage(roomType: PublicRoomType) {
    return (
        roomType.images.find((image) => image.isPrimary) ||
        roomType.images[0] ||
        null
    );
}

function toNumber(value: PublicRoomType["basePrice"]) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat("en", {
        style: "currency",
        currency,
    }).format(amount);
}

function getLowestRoomPrice(roomTypes: PublicRoomType[]) {
    if (roomTypes.length === 0) {
        return null;
    }

    return roomTypes.reduce((lowestPrice, roomType) => {
        const roomPrice = toNumber(roomType.basePrice);
        return roomPrice < lowestPrice ? roomPrice : lowestPrice;
    }, toNumber(roomTypes[0].basePrice));
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
    const lowestRoomPrice = getLowestRoomPrice(roomTypes);
    const totalRooms = roomTypes.reduce(
        (total, roomType) => total + roomType.totalRooms,
        0,
    );

    const featuredRoomTypes = roomTypes.slice(0, 3);

    return (
        <div className="min-h-screen bg-luxury-cream text-luxury-ink">
            <PublicHeader />

            <main>
                <section className="relative overflow-hidden border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_34%,#ffffff_76%)]">
                    <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-luxury-gold/10 blur-3xl" />
                    <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-luxury-navy/10 blur-3xl" />

                    <div className="luxury-container relative grid gap-10 py-10 lg:grid-cols-[1fr_470px] lg:py-16">
                        <div className="flex flex-col justify-center">
                            <div className="flex flex-wrap items-center gap-2">
                                <Link
                                    href="/hotels"
                                    className="rounded-full border border-luxury-stone bg-white/80 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm transition hover:border-luxury-gold hover:text-luxury-ink"
                                >
                                    Hotels
                                </Link>

                                <Badge variant="primary">{hotel.city}</Badge>

                                {hotel.starRating ? (
                                    <Badge variant="warning">{hotel.starRating} stars</Badge>
                                ) : null}

                                <Badge>{hotel.currency}</Badge>
                            </div>

                            <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                                Luxury hotel detail
                            </p>

                            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl lg:text-6xl">
                                {hotel.name}
                            </h1>

                            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                                {hotel.description ||
                                    "Explore room categories, live availability, booking options, and hotel details in one clean experience."}
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <a
                                    href="#availability"
                                    className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
                                >
                                    Check Availability
                                </a>

                                <a
                                    href="#rooms"
                                    className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
                                >
                                    View Rooms
                                </a>
                            </div>

                            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-3xl border border-luxury-stone bg-white/85 p-5 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        From
                                    </p>
                                    <p className="mt-2 text-xl font-black text-luxury-ink">
                                        {lowestRoomPrice === null
                                            ? "Contact hotel"
                                            : formatCurrency(lowestRoomPrice, hotel.currency)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">per night</p>
                                </div>

                                <div className="rounded-3xl border border-luxury-stone bg-white/85 p-5 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Room Types
                                    </p>
                                    <p className="mt-2 text-xl font-black text-luxury-ink">
                                        {roomTypes.length}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">categories</p>
                                </div>

                                <div className="rounded-3xl border border-luxury-stone bg-white/85 p-5 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Rooms
                                    </p>
                                    <p className="mt-2 text-xl font-black text-luxury-ink">
                                        {totalRooms}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">managed rooms</p>
                                </div>

                                <div className="rounded-3xl border border-luxury-stone bg-white/85 p-5 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Rating
                                    </p>
                                    <p className="mt-2 text-xl font-black text-luxury-ink">
                                        {hotel.starRating ? `${hotel.starRating} stars` : "Premium"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">guest stay</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-white shadow-xl shadow-slate-900/10">
                            <div className="relative h-[22rem] bg-slate-200 sm:h-[30rem]">
                                {heroImage ? (
                                    <img
                                        src={heroImage.url}
                                        alt={heroImage.altText || hotel.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 px-6 text-center">
                                        <div>
                                            <p className="text-sm font-bold text-slate-600">
                                                Hotel Image
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Add room images from the admin panel.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute inset-x-4 bottom-4 rounded-3xl border border-white/30 bg-white/90 p-4 shadow-lg backdrop-blur-xl">
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold">
                                        Location
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-luxury-ink">
                                        {hotel.city}, {hotel.country}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                                        {hotel.addressLine1}
                                        {hotel.addressLine2 ? `, ${hotel.addressLine2}` : ""}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4 p-5 sm:grid-cols-2">
                                <div className="rounded-3xl bg-luxury-cream p-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Check-in
                                    </p>
                                    <p className="mt-2 text-sm font-black text-luxury-ink">
                                        {hotel.checkInTime || "Contact hotel"}
                                    </p>
                                </div>

                                <div className="rounded-3xl bg-luxury-cream p-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Check-out
                                    </p>
                                    <p className="mt-2 text-sm font-black text-luxury-ink">
                                        {hotel.checkOutTime || "Contact hotel"}
                                    </p>
                                </div>

                                <div className="rounded-3xl bg-luxury-cream p-4 sm:col-span-2">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Contact
                                    </p>
                                    <p className="mt-2 break-all text-sm font-bold text-luxury-ink">
                                        {hotel.email || "Email not available"}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {hotel.phone || "Phone not available"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white">
                    <div className="luxury-container py-12">
                        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
                                    Stay overview
                                </p>

                                <h2 className="mt-3 text-3xl font-black tracking-tight text-luxury-ink sm:text-4xl">
                                    Designed for easy booking and clear room selection.
                                </h2>
                            </div>

                            <p className="max-w-3xl text-sm leading-7 text-slate-600 lg:ml-auto">
                                Compare room types, review capacity and amenities, then search
                                live availability before continuing to the booking form.
                            </p>
                        </div>

                        {featuredRoomTypes.length > 0 ? (
                            <div className="mt-8 grid gap-5 md:grid-cols-3">
                                {featuredRoomTypes.map((roomType) => {
                                    const image = getPrimaryRoomImage(roomType);

                                    return (
                                        <div
                                            key={roomType.id}
                                            className="overflow-hidden rounded-[1.75rem] border border-luxury-stone bg-luxury-cream shadow-sm"
                                        >
                                            <div className="h-44 bg-slate-200">
                                                {image ? (
                                                    <img
                                                        src={image.url}
                                                        alt={image.altText || roomType.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center px-4 text-center">
                                                        <p className="text-xs font-bold text-slate-500">
                                                            Room image
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <h3 className="text-base font-black text-luxury-ink">
                                                        {roomType.name}
                                                    </h3>

                                                    <Badge>{roomType.totalRooms} rooms</Badge>
                                                </div>

                                                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                                                    {roomType.description ||
                                                        "Comfortable room category for your stay."}
                                                </p>

                                                <div className="mt-5 flex items-end justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs text-slate-500">From</p>
                                                        <p className="text-base font-black text-luxury-ink">
                                                            {formatCurrency(
                                                                toNumber(roomType.basePrice),
                                                                hotel.currency,
                                                            )}
                                                        </p>
                                                    </div>

                                                    <a
                                                        href="#availability"
                                                        className="text-sm font-bold text-luxury-gold transition hover:text-luxury-ink"
                                                    >
                                                        Check dates
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-8 rounded-[1.75rem] border border-luxury-stone bg-luxury-cream p-6">
                                <p className="text-sm font-bold text-luxury-ink">
                                    No public room types are available yet.
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                    Add room types from the admin panel to show room options here.
                                </p>
                            </div>
                        )}
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