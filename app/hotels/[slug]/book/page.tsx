import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BookingForm } from "@/components/public/BookingForm";
import { Card, CardContent } from "@/components/ui/Card";
import type {
    PublicHotelDetailResponse,
    PublicRoomTypesResponse,
} from "@/lib/frontend/types";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/frontend/auth-server";

type BookingPageProps = {
    params: Promise<{
        slug: string;
    }>;
    searchParams?: Promise<{
        roomTypeId?: string;
        checkInDate?: string;
        checkOutDate?: string;
        adults?: string;
        children?: string;
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

export default async function BookingPage({
    params,
    searchParams,
}: BookingPageProps) {
    const { slug } = await params;
    const query = await searchParams;

    const queryString = new URLSearchParams(
        Object.entries(query || {}).reduce<Record<string, string>>(
            (result, [key, value]) => {
                if (typeof value === "string") {
                    result[key] = value;
                }

                return result;
            },
            {},
        ),
    ).toString();

    const nextPath = queryString
        ? `/hotels/${slug}/book?${queryString}`
        : `/hotels/${slug}/book`;

    const user = await getServerAuthUser();

    if (!user) {
        redirect(`/guest/login?next=${encodeURIComponent(nextPath)}`);
    }

    const [hotel, roomTypes] = await Promise.all([
        getHotel(slug),
        getRoomTypes(slug),
    ]);

    const roomTypeId = query?.roomTypeId || "";
    const checkInDate = query?.checkInDate || "";
    const checkOutDate = query?.checkOutDate || "";
    const adults = query?.adults || "2";
    const children = query?.children || "0";

    const roomType =
        roomTypes.find((item) => item.id === roomTypeId && item.totalRooms > 0) ||
        null;

    const missingSelection =
        !roomType || !checkInDate || !checkOutDate || !adults || !children;

    return (
        <div className="min-h-screen bg-background">
            <PublicHeader />

            <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                {missingSelection ? (
                    <Card>
                        <CardContent>
                            <h1 className="text-xl font-bold text-foreground">
                                Booking selection missing
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Go back to the hotel page, search availability, and choose an
                                available room type before booking.
                            </p>

                            <Link
                                href={`/hotels/${hotel.slug}#availability`}
                                className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
                            >
                                Search availability
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <BookingForm
                        user={user}
                        hotelSlug={hotel.slug}
                        hotelName={hotel.name}
                        currency={hotel.currency}
                        roomType={roomType}
                        initialCheckInDate={checkInDate}
                        initialCheckOutDate={checkOutDate}
                        initialAdults={adults}
                        initialChildren={children}
                    />
                )}
            </main>

            <PublicFooter />
        </div>
    );
}