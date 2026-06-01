import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { HotelSubnav } from "@/components/public/HotelSubnav";
import {
  HotelDiningCarousel,
  type DiningVenue,
} from "@/components/public/HotelDiningCarousel";
import { Badge } from "@/components/ui/Badge";
import type { PublicHotelDetailResponse } from "@/lib/frontend/types";
import type { Metadata } from "next";
import { buildHotelMetadata } from "@/lib/frontend/public-metadata";

type HotelDiningPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const diningVenues: DiningVenue[] = [
  {
    id: "lobby-lounge",
    title: "The Lobby Lounge",
    subtitle: "Lounge",
    description:
      "A calm lounge setting for coffee, conversation, light bites, and relaxed meetings throughout the day.",
    imageUrl:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Elegant hotel lobby lounge",
  },
  {
    id: "bar-lounge",
    title: "The Bar & Lounge",
    subtitle: "American bar fare",
    description:
      "A warm evening venue for drinks, small plates, and a polished hotel bar atmosphere.",
    imageUrl:
      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Luxury hotel bar lounge",
  },
  {
    id: "arabesque",
    title: "Arabesque",
    subtitle: "Lebanese",
    description:
      "A signature dining room inspired by local flavors, refined service, and a relaxed hotel setting.",
    imageUrl:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Restaurant dining room",
  },
  {
    id: "level-26",
    title: "Level 26",
    subtitle: "Terrace dining",
    description:
      "A brighter venue for open-air inspired dining, light meals, and views across the city.",
    imageUrl:
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Terrace restaurant",
  },
  {
    id: "the-grill",
    title: "The Grill",
    subtitle: "Mediterranean cuisine",
    description:
      "A refined grill concept for prime cuts, Mediterranean plates, and an elevated dinner experience.",
    imageUrl:
      "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Fine dining restaurant",
  },
  {
    id: "breakfast-room",
    title: "Breakfast Room",
    subtitle: "Morning service",
    description:
      "A polished breakfast setting with fresh morning dishes, hotel classics, and a calm start to the day.",
    imageUrl:
      "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Hotel breakfast dining",
  },
  {
    id: "rooftop-bar",
    title: "Rooftop Bar",
    subtitle: "Evening views",
    description:
      "A rooftop-inspired lounge for evening drinks, city views, and a more social hotel atmosphere.",
    imageUrl:
      "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Rooftop bar",
  },
  {
    id: "private-dining",
    title: "Private Dining",
    subtitle: "Special occasions",
    description:
      "An intimate dining setup for private dinners, small celebrations, and business meals.",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Private dining table",
  },
  {
    id: "in-room-dining",
    title: "In-Room Dining",
    subtitle: "Available on request",
    description:
      "A convenient dining option for guests who prefer quiet service in the comfort of their room.",
    imageUrl:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "In-room hotel dining",
  },
];

const diningEvents = [
  {
    title: "Breakfast at the Grill",
    time: "Every day, 6:30 AM - 11:30 AM",
    description:
      "Choose from a polished breakfast menu with local specialties, healthy options, and hotel classics.",
  },
  {
    title: "Afternoon Tea",
    time: "Every day, 3:00 PM - 7:00 PM",
    description:
      "Enjoy tea, pastries, sandwiches, and quiet lounge service in an elegant afternoon setting.",
  },
];

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
}: HotelDiningPageProps): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  return buildHotelMetadata({
    hotel,
    pageTitle: "Dining",
    description: `Explore restaurants, bars, lounges, dining venues, and hotel dining experiences at ${hotel.name}.`,
    path: `/hotels/${hotel.slug}/dining`,
  });
}

export default async function HotelDiningPage({ params }: HotelDiningPageProps) {
  const { slug } = await params;
  const hotel = await getHotel(slug);

  return (
    <div className="flex min-h-screen flex-col bg-white text-luxury-ink">
      <PublicHeader />
      <HotelSubnav hotelSlug={hotel.slug} active="dining" />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-luxury-stone bg-luxury-navy">
          <div className="absolute inset-0">
            <Image
              src={diningVenues[2].imageUrl}
              alt={diningVenues[2].imageAlt}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-45"
            />
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,17,31,0.92)_0%,rgba(7,17,31,0.7)_45%,rgba(7,17,31,0.45)_100%)]" />

          <div className="luxury-container relative py-20 lg:py-28">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/hotels/${hotel.slug}`}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white/80 shadow-sm transition hover:bg-white/20 hover:text-white"
              >
                {hotel.name}
              </Link>

              <Badge variant="warning">{hotel.city}</Badge>

              {hotel.starRating ? (
                <Badge variant="warning">{hotel.starRating} stars</Badge>
              ) : null}
            </div>

            <p className="mt-10 text-xs font-bold uppercase tracking-[0.35em] text-luxury-gold-soft">
              Dining
            </p>

            <h1 className="mt-5 max-w-5xl text-5xl font-black uppercase tracking-[0.12em] text-white sm:text-6xl lg:text-7xl">
              Restaurants and bars
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-white/75">
              Discover dining venues, lounge spaces, and hotel events designed
              around comfort, atmosphere, and guest experience.
            </p>
          </div>
        </section>

        <section className="overflow-hidden bg-white py-14 lg:py-20">
          <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-luxury-gold">
                All food and drink
              </p>

              <h2 className="mt-4 text-4xl font-light uppercase tracking-[0.22em] text-luxury-ink">
                Restaurants
              </h2>
            </div>

            <HotelDiningCarousel venues={diningVenues} />
          </div>
        </section>

        <section className="bg-white py-14 lg:py-20">
          <div className="luxury-container">
            <div className="text-center">
              <h2 className="text-4xl font-light uppercase tracking-[0.22em] text-luxury-ink">
                Events
              </h2>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2">
              {diningEvents.map((event) => (
                <article
                  key={event.title}
                  className="border border-luxury-ink bg-black p-8 text-center text-white shadow-xl sm:p-10"
                >
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-white">
                    {event.time}
                  </p>

                  <h3 className="mt-10 text-base font-black uppercase tracking-[0.28em] text-white">
                    {event.title}
                  </h3>

                  <div className="mx-auto mt-7 h-px w-12 bg-white/70" />

                  <p className="mt-7 text-base leading-8 text-white/80">
                    {event.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-luxury-cream">
          <div className="luxury-container grid gap-6 py-12 md:grid-cols-3">
            {[
              {
                title: "Restaurant venues",
                text: "Present each restaurant or lounge as a separate experience.",
              },
              {
                title: "Dining events",
                text: "Show breakfast, afternoon tea, seasonal menus, and special services.",
              },
              {
                title: "Future admin control",
                text: "Later this can become editable from the hotel admin panel.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-luxury-stone bg-white p-6"
              >
                <p className="text-lg font-black text-luxury-ink">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-luxury-navy text-white">
          <div className="luxury-container grid gap-8 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-luxury-gold-soft">
                Contact us
              </p>

              <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
                Planning a dinner, event, or special request?
              </h2>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-xl shadow-black/10 backdrop-blur sm:p-8">
              <p className="text-sm leading-7 text-white/70">
                Send the hotel team a message about restaurant availability,
                private dining, dietary needs, or event details. The inquiry
                will appear in the admin inquiries panel.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/hotels/${hotel.slug}/contact`}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-luxury-navy shadow-sm transition hover:bg-luxury-gold-soft"
                >
                  Contact dining team
                </Link>

                <Link
                  href={`/hotels/${hotel.slug}#availability`}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Check rooms
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
