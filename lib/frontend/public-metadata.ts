import type { Metadata } from "next";
import type { PublicHotelDetail } from "@/lib/frontend/types";

const siteName = "Hotel System";

type PublicMetadataInput = {
  title: string;
  description: string;
  path?: string;
};

type HotelMetadataInput = {
  hotel: PublicHotelDetail;
  pageTitle?: string;
  description: string;
  path?: string;
};

export function buildPublicMetadata({
  title,
  description,
  path,
}: PublicMetadataInput): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: path,
      siteName,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function buildHotelMetadata({
  hotel,
  pageTitle,
  description,
  path,
}: HotelMetadataInput): Metadata {
  const title = pageTitle
    ? `${hotel.name} ${pageTitle} | ${siteName}`
    : `${hotel.name} | ${siteName}`;

  return buildPublicMetadata({
    title,
    description,
    path,
  });
}