import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { HotelSubnav } from "@/components/public/HotelSubnav";
import { HotelGallerySliders } from "@/components/public/HotelGallerySliders";
import type { HotelGallerySection } from "@/components/public/HotelGallerySliders";
import { Badge } from "@/components/ui/Badge";
import type {
  PublicHotelDetailResponse,
  PublicRoomType,
  PublicRoomTypesResponse,
} from "@/lib/frontend/types";
import type { Metadata } from "next";
import { buildHotelMetadata } from "@/lib/frontend/public-metadata";

type HotelGalleryPageProps = {
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

export async function generateMetadata({
  params,
}: HotelGalleryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  return buildHotelMetadata({
    hotel,
    pageTitle: "Gallery",
    description: `Explore photos, room visuals, dining previews, and hotel spaces for ${hotel.name}.`,
    path: `/hotels/${hotel.slug}/gallery`,
  });
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

function getRoomSlides(roomTypes: PublicRoomType[]) {
  return roomTypes.flatMap((roomType) =>
    roomType.images.map((image) => ({
      id: `room-${roomType.id}-${image.id}`,
      title: roomType.name,
      eyebrow: "Rooms and suites",
      description:
        image.altText ||
        roomType.description ||
        "A refined room category designed for comfort, clarity, and a smooth guest stay.",
      imageUrl: image.url,
      imageAlt: image.altText || roomType.name,
    })),
  );
}

function getFallbackSections(hotelName: string): HotelGallerySection[] {
  return [
    {
      id: "dining",
      eyebrow: "Dining",
      title: "Dining moments",
      description:
        "A preview-style dining gallery until dedicated dining images are managed from the admin panel.",
      slides: [
        {
          id: "dining-1",
          title: "Lobby lounge",
          eyebrow: "Dining",
          description:
            "A calm setting for coffee, conversation, and relaxed hotel dining.",
          imageUrl:
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1400&auto=format&fit=crop",
          imageAlt: `${hotelName} dining lounge`,
        },
        {
          id: "dining-2",
          title: "Restaurant atmosphere",
          eyebrow: "Dining",
          description:
            "Warm interiors and polished service for a more complete hotel experience.",
          imageUrl:
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1400&auto=format&fit=crop",
          imageAlt: `${hotelName} restaurant`,
        },
        {
          id: "dining-3",
          title: "Breakfast setting",
          eyebrow: "Dining",
          description:
            "Morning dining designed around comfort, convenience, and presentation.",
          imageUrl:
            "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?q=80&w=1400&auto=format&fit=crop",
          imageAlt: `${hotelName} breakfast`,
        },
      ],
    },
    {
      id: "amenities",
      eyebrow: "Services and amenities",
      title: "Hotel spaces",
      description:
        "A preview of amenity spaces. Later this can be connected to real hotel media from the admin panel.",
      slides: [
        {
          id: "amenities-1",
          title: "Wellness space",
          eyebrow: "Amenities",
          description:
            "A quiet wellness-inspired space for guests during their stay.",
          imageUrl:
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1400&auto=format&fit=crop",
          imageAlt: `${hotelName} wellness space`,
        },
        {
          id: "amenities-2",
          title: "Poolside atmosphere",
          eyebrow: "Amenities",
          description:
            "A resort-style visual preview for relaxation and guest services.",
          imageUrl:
            "https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=1400&auto=format&fit=crop",
          imageAlt: `${hotelName} pool`,
        },
        {
          id: "amenities-3",
          title: "Guest lounge",
          eyebrow: "Amenities",
          description:
            "Comfortable public spaces designed for waiting, meeting, and relaxing.",
          imageUrl:
            "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1400&auto=format&fit=crop",
          imageAlt: `${hotelName} guest lounge`,
        },
      ],
    },
  ];
}

function buildGallerySections(
  hotelName: string,
  roomTypes: PublicRoomType[],
): HotelGallerySection[] {
  const roomSlides = getRoomSlides(roomTypes);

  const sections: HotelGallerySection[] = [];

  if (roomSlides.length > 0) {
    sections.push({
      id: "rooms",
      eyebrow: "Rooms and suites",
      title: "Accommodations gallery",
      description:
        "Browse room visuals from the available public room categories.",
      slides: roomSlides,
    });
  }

  return [...sections, ...getFallbackSections(hotelName)];
}

export default async function HotelGalleryPage({
  params,
}: HotelGalleryPageProps) {
  const { slug } = await params;

  const [hotel, roomTypes] = await Promise.all([
    getHotel(slug),
    getRoomTypes(slug),
  ]);

  const sections = buildGallerySections(hotel.name, roomTypes);

  return (
    <div className="flex min-h-screen flex-col bg-luxury-cream text-luxury-ink">
      <PublicHeader />
      <HotelSubnav hotelSlug={hotel.slug} active="gallery" />

      <main className="flex-1">
        <section className="border-b border-luxury-stone bg-[radial-gradient(circle_at_top_left,#f7ead6_0,#fbf7ef_38%,#ffffff_100%)]">
          <div className="luxury-container py-10 lg:py-16">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/hotels/${hotel.slug}`}
                className="rounded-full border border-luxury-stone bg-white/80 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm transition hover:border-luxury-gold hover:text-luxury-ink"
              >
                {hotel.name}
              </Link>

              <Badge variant="luxury">{hotel.city}</Badge>

              {hotel.starRating ? (
                <Badge variant="warning">{hotel.starRating} stars</Badge>
              ) : null}
            </div>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold">
              Photos and videos
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-luxury-ink sm:text-5xl lg:text-6xl">
                Explore the stay through curated visual stories.
              </h1>

              <p className="max-w-3xl text-sm leading-7 text-slate-600 lg:ml-auto">
                Browse room visuals, dining previews, and hotel spaces in
                section-based sliders. Room images come from your current hotel
                data; dining and amenity visuals are placeholders until CMS
                content is added.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/hotels/${hotel.slug}#availability`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
              >
                Check availability
              </Link>

              <Link
                href={`/hotels/${hotel.slug}/rooms`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-luxury-stone bg-white px-6 text-sm font-bold text-luxury-ink shadow-sm transition hover:border-luxury-gold hover:bg-luxury-cream"
              >
                View rooms
              </Link>
            </div>
          </div>
        </section>

        <section className="luxury-container py-10 lg:py-14">
          <HotelGallerySliders sections={sections} />
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
