import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoomStatus } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function upsertRole(name: string, description: string) {
  return prisma.role.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });
}

async function upsertAmenity(name: string, icon: string) {
  return prisma.amenity.upsert({
    where: { name },
    update: { icon },
    create: { name, icon },
  });
}

async function upsertUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);

  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      passwordHash,
    },
    create: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      passwordHash,
    },
  });
}

async function assignGlobalRole(userId: string, roleId: string) {
  return prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId,
      },
    },
    update: {},
    create: {
      userId,
      roleId,
    },
  });
}

async function assignHotelRole(userId: string, hotelId: string, roleId: string) {
  return prisma.userHotelRole.upsert({
    where: {
      userId_hotelId_roleId: {
        userId,
        hotelId,
        roleId,
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      userId,
      hotelId,
      roleId,
    },
  });
}

async function upsertRoomType(data: {
  hotelId: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
  bedType: string;
  roomSizeSqm: number;
}) {
  return prisma.roomType.upsert({
    where: {
      hotelId_slug: {
        hotelId: data.hotelId,
        slug: data.slug,
      },
    },
    update: {
      name: data.name,
      description: data.description,
      basePrice: data.basePrice,
      capacityAdults: data.capacityAdults,
      capacityChildren: data.capacityChildren,
      bedType: data.bedType,
      roomSizeSqm: data.roomSizeSqm,
    },
    create: data,
  });
}

async function setRoomTypeAmenities(roomTypeId: string, amenityIds: string[]) {
  for (const amenityId of amenityIds) {
    await prisma.roomTypeAmenity.upsert({
      where: {
        roomTypeId_amenityId: {
          roomTypeId,
          amenityId,
        },
      },
      update: {},
      create: {
        roomTypeId,
        amenityId,
      },
    });
  }
}

async function replaceRoomTypeImages(
  roomTypeId: string,
  images: Array<{
    url: string;
    altText?: string;
    sortOrder: number;
    isPrimary?: boolean;
  }>
) {
  await prisma.roomTypeImage.deleteMany({
    where: { roomTypeId },
  });

  await prisma.roomTypeImage.createMany({
    data: images.map((image) => ({
      roomTypeId,
      url: image.url,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary ?? false,
    })),
  });
}

async function upsertRoom(data: {
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  floor?: number;
  status?: RoomStatus;
  notes?: string;
}) {
  return prisma.room.upsert({
    where: {
      hotelId_roomNumber: {
        hotelId: data.hotelId,
        roomNumber: data.roomNumber,
      },
    },
    update: {
      roomTypeId: data.roomTypeId,
      floor: data.floor,
      status: data.status ?? RoomStatus.AVAILABLE,
      notes: data.notes,
    },
    create: {
      hotelId: data.hotelId,
      roomTypeId: data.roomTypeId,
      roomNumber: data.roomNumber,
      floor: data.floor,
      status: data.status ?? RoomStatus.AVAILABLE,
      notes: data.notes,
    },
  });
}

async function main() {
  console.log("Seeding started...");

  // ---------------------------
  // Roles
  // ---------------------------
  const superAdminRole = await upsertRole("SUPER_ADMIN", "Platform-wide super administrator");
  const guestRole = await upsertRole("GUEST", "Regular hotel guest");
  const hotelAdminRole = await upsertRole("HOTEL_ADMIN", "Hotel administrator");
  const managerRole = await upsertRole("MANAGER", "Hotel manager");
  const receptionistRole = await upsertRole("RECEPTIONIST", "Front desk / reception staff");

  // ---------------------------
  // Users
  // Plain passwords for testing:
  // owner@hotel-system.com -> Admin123!
  // admin.beirut@grandplaza.com -> Admin123!
  // reception.beirut@grandplaza.com -> Admin123!
  // manager.byblos@cedarspalace.com -> Admin123!
  // guest1@example.com -> Guest123!
  // ---------------------------
  const owner = await upsertUser({
    firstName: "Platform",
    lastName: "Owner",
    email: "owner@hotel-system.com",
    phone: "+96170000001",
    password: "Admin123!",
  });

  const beirutAdmin = await upsertUser({
    firstName: "Maya",
    lastName: "Khoury",
    email: "admin.beirut@grandplaza.com",
    phone: "+96170000002",
    password: "Admin123!",
  });

  const beirutReceptionist = await upsertUser({
    firstName: "Rami",
    lastName: "Haddad",
    email: "reception.beirut@grandplaza.com",
    phone: "+96170000003",
    password: "Admin123!",
  });

  const byblosManager = await upsertUser({
    firstName: "Nour",
    lastName: "Salameh",
    email: "manager.byblos@cedarspalace.com",
    phone: "+96170000004",
    password: "Admin123!",
  });

  const guestUser = await upsertUser({
    firstName: "Test",
    lastName: "Guest",
    email: "guest1@example.com",
    phone: "+96170000005",
    password: "Guest123!",
  });

  const zahleAdmin = await upsertUser({
    firstName: "Lea",
    lastName: "Maalouf",
    email: "admin.zahle@mountainview.com",
    phone: "+96170000006",
    password: "Admin123!",
  });

  const zahleManager = await upsertUser({
    firstName: "Karim",
    lastName: "Awad",
    email: "manager.zahle@mountainview.com",
    phone: "+96170000007",
    password: "Admin123!",
  });

  const zahleReceptionist = await upsertUser({
    firstName: "Mira",
    lastName: "Saad",
    email: "reception.zahle@mountainview.com",
    phone: "+96170000008",
    password: "Admin123!",
  });

  // ---------------------------
  // Hotels
  // ---------------------------
  const grandPlazaBeirut = await prisma.hotel.upsert({
    where: { slug: "grand-plaza-beirut" },
    update: {
      name: "Grand Plaza Beirut",
      description: "A modern hotel in Beirut for business and leisure stays.",
      email: "info@grandplazabeirut.com",
      phone: "+96170000000",
      country: "Lebanon",
      city: "Beirut",
      addressLine1: "Hamra Main Street",
      postalCode: "1103",
      starRating: 5,
      checkInTime: "15:00",
      checkOutTime: "12:00",
      currency: "USD",
      timezone: "Asia/Beirut",
    },
    create: {
      name: "Grand Plaza Beirut",
      slug: "grand-plaza-beirut",
      description: "A modern hotel in Beirut for business and leisure stays.",
      email: "info@grandplazabeirut.com",
      phone: "+96170000000",
      country: "Lebanon",
      city: "Beirut",
      addressLine1: "Hamra Main Street",
      postalCode: "1103",
      starRating: 5,
      checkInTime: "15:00",
      checkOutTime: "12:00",
      currency: "USD",
      timezone: "Asia/Beirut",
    },
  });

  const cedarsPalaceByblos = await prisma.hotel.upsert({
    where: { slug: "cedars-palace-byblos" },
    update: {
      name: "Cedars Palace Byblos",
      description: "Boutique coastal hotel in historic Byblos.",
      email: "info@cedarspalacebyblos.com",
      phone: "+96170000010",
      country: "Lebanon",
      city: "Byblos",
      addressLine1: "Old Souk Road",
      postalCode: "1401",
      starRating: 4,
      checkInTime: "14:00",
      checkOutTime: "12:00",
      currency: "USD",
      timezone: "Asia/Beirut",
    },
    create: {
      name: "Cedars Palace Byblos",
      slug: "cedars-palace-byblos",
      description: "Boutique coastal hotel in historic Byblos.",
      email: "info@cedarspalacebyblos.com",
      phone: "+96170000010",
      country: "Lebanon",
      city: "Byblos",
      addressLine1: "Old Souk Road",
      postalCode: "1401",
      starRating: 4,
      checkInTime: "14:00",
      checkOutTime: "12:00",
      currency: "USD",
      timezone: "Asia/Beirut",
    },
  });


  const mountainViewZahle = await prisma.hotel.upsert({
    where: { slug: "mountain-view-zahle" },
    update: {
      name: "Mountain View Zahle",
      description: "Quiet mountain hotel in Zahle for family trips and weekend escapes.",
      email: "info@mountainviewzahle.com",
      phone: "+96170000020",
      country: "Lebanon",
      city: "Zahle",
      addressLine1: "Ksara Hills Road",
      postalCode: "1801",
      starRating: 4,
      checkInTime: "15:00",
      checkOutTime: "12:00",
      currency: "USD",
      timezone: "Asia/Beirut",
    },
    create: {
      name: "Mountain View Zahle",
      slug: "mountain-view-zahle",
      description: "Quiet mountain hotel in Zahle for family trips and weekend escapes.",
      email: "info@mountainviewzahle.com",
      phone: "+96170000020",
      country: "Lebanon",
      city: "Zahle",
      addressLine1: "Ksara Hills Road",
      postalCode: "1801",
      starRating: 4,
      checkInTime: "15:00",
      checkOutTime: "12:00",
      currency: "USD",
      timezone: "Asia/Beirut",
    },
  });

  // ---------------------------
  // Role assignments
  // ---------------------------
  await assignGlobalRole(owner.id, superAdminRole.id);
  await assignGlobalRole(guestUser.id, guestRole.id);

  await assignHotelRole(beirutAdmin.id, grandPlazaBeirut.id, hotelAdminRole.id);
  await assignHotelRole(beirutReceptionist.id, grandPlazaBeirut.id, receptionistRole.id);
  await assignHotelRole(byblosManager.id, cedarsPalaceByblos.id, managerRole.id);
  await assignHotelRole(zahleAdmin.id, mountainViewZahle.id, hotelAdminRole.id);
  await assignHotelRole(zahleManager.id, mountainViewZahle.id, managerRole.id);
  await assignHotelRole(zahleReceptionist.id, mountainViewZahle.id, receptionistRole.id);

  // ---------------------------
  // Amenities
  // ---------------------------
  const wifi = await upsertAmenity("Free WiFi", "wifi");
  const breakfast = await upsertAmenity("Breakfast Included", "coffee");
  const ac = await upsertAmenity("Air Conditioning", "snowflake");
  const parking = await upsertAmenity("Parking", "car");
  const pool = await upsertAmenity("Pool", "waves");
  const gym = await upsertAmenity("Gym", "dumbbell");

  // ---------------------------
  // Beirut room types
  // ---------------------------
  const beirutStandard = await upsertRoomType({
    hotelId: grandPlazaBeirut.id,
    name: "Standard Queen",
    slug: "standard-queen",
    description: "Comfortable room with one queen bed.",
    basePrice: 90,
    capacityAdults: 2,
    capacityChildren: 1,
    bedType: "Queen Bed",
    roomSizeSqm: 28,
  });

  const beirutDeluxe = await upsertRoomType({
    hotelId: grandPlazaBeirut.id,
    name: "Deluxe King",
    slug: "deluxe-king",
    description: "Spacious room with one king bed.",
    basePrice: 120,
    capacityAdults: 2,
    capacityChildren: 1,
    bedType: "King Bed",
    roomSizeSqm: 35,
  });

  const beirutSuite = await upsertRoomType({
    hotelId: grandPlazaBeirut.id,
    name: "Executive Suite",
    slug: "executive-suite",
    description: "Luxury suite with city view and separate living area.",
    basePrice: 250,
    capacityAdults: 3,
    capacityChildren: 2,
    bedType: "King Bed",
    roomSizeSqm: 60,
  });

  // ---------------------------
  // Byblos room types
  // ---------------------------
  const byblosStandard = await upsertRoomType({
    hotelId: cedarsPalaceByblos.id,
    name: "Sea Breeze Double",
    slug: "sea-breeze-double",
    description: "Bright double room with partial sea view.",
    basePrice: 95,
    capacityAdults: 2,
    capacityChildren: 1,
    bedType: "Double Bed",
    roomSizeSqm: 30,
  });

  const byblosTwin = await upsertRoomType({
    hotelId: cedarsPalaceByblos.id,
    name: "Coastal Twin",
    slug: "coastal-twin",
    description: "Twin room ideal for friends or business travelers.",
    basePrice: 105,
    capacityAdults: 2,
    capacityChildren: 1,
    bedType: "Twin Beds",
    roomSizeSqm: 32,
  });

  const byblosSuite = await upsertRoomType({
    hotelId: cedarsPalaceByblos.id,
    name: "Heritage Suite",
    slug: "heritage-suite",
    description: "Premium suite with balcony and old city charm.",
    basePrice: 220,
    capacityAdults: 3,
    capacityChildren: 2,
    bedType: "King Bed",
    roomSizeSqm: 55,
  });


  // ---------------------------
  // Zahle room types
  // ---------------------------
  const zahleClassicDouble = await upsertRoomType({
    hotelId: mountainViewZahle.id,
    name: "Classic Double",
    slug: "classic-double",
    description: "Warm and simple double room with mountain view.",
    basePrice: 85,
    capacityAdults: 2,
    capacityChildren: 1,
    bedType: "Double Bed",
    roomSizeSqm: 27,
  });

  const zahleFamilySuite = await upsertRoomType({
    hotelId: mountainViewZahle.id,
    name: "Family Suite",
    slug: "family-suite",
    description: "Large suite for families with extra seating space.",
    basePrice: 160,
    capacityAdults: 4,
    capacityChildren: 2,
    bedType: "King Bed + Sofa Bed",
    roomSizeSqm: 48,
  });

  // ---------------------------
  // Room type amenities
  // ---------------------------
  await setRoomTypeAmenities(beirutStandard.id, [wifi.id, ac.id]);
  await setRoomTypeAmenities(beirutDeluxe.id, [wifi.id, breakfast.id, ac.id, parking.id]);
  await setRoomTypeAmenities(beirutSuite.id, [wifi.id, breakfast.id, ac.id, parking.id, gym.id]);

  await setRoomTypeAmenities(byblosStandard.id, [wifi.id, breakfast.id, ac.id]);
  await setRoomTypeAmenities(byblosTwin.id, [wifi.id, ac.id, parking.id]);
  await setRoomTypeAmenities(byblosSuite.id, [wifi.id, breakfast.id, ac.id, pool.id, parking.id]);

  await setRoomTypeAmenities(zahleClassicDouble.id, [wifi.id, breakfast.id, ac.id, parking.id]);
  await setRoomTypeAmenities(zahleFamilySuite.id, [wifi.id, breakfast.id, ac.id, parking.id]);

  // ---------------------------
  // Room type images
  // ---------------------------
  await replaceRoomTypeImages(beirutStandard.id, [
    {
      url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
      altText: "Standard Queen Room",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
      altText: "Standard Queen Room Interior",
      sortOrder: 2,
    },
  ]);

  await replaceRoomTypeImages(beirutDeluxe.id, [
    {
      url: "https://images.unsplash.com/photo-1566665797739-1674de7a421a",
      altText: "Deluxe King Room",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
      altText: "Deluxe King Seating Area",
      sortOrder: 2,
    },
  ]);

  await replaceRoomTypeImages(beirutSuite.id, [
    {
      url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461",
      altText: "Executive Suite",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c",
      altText: "Executive Suite Living Area",
      sortOrder: 2,
    },
  ]);

  await replaceRoomTypeImages(byblosStandard.id, [
    {
      url: "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd",
      altText: "Sea Breeze Double",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
      altText: "Sea Breeze Double Interior",
      sortOrder: 2,
    },
  ]);

  await replaceRoomTypeImages(byblosTwin.id, [
    {
      url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8",
      altText: "Coastal Twin Room",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
      altText: "Coastal Twin Beds",
      sortOrder: 2,
    },
  ]);

  await replaceRoomTypeImages(byblosSuite.id, [
    {
      url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c",
      altText: "Heritage Suite",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461",
      altText: "Heritage Suite Lounge",
      sortOrder: 2,
    },
  ]);


  await replaceRoomTypeImages(zahleClassicDouble.id, [
    {
      url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
      altText: "Classic Double Room",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
      altText: "Classic Double Interior",
      sortOrder: 2,
    },
  ]);

  await replaceRoomTypeImages(zahleFamilySuite.id, [
    {
      url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461",
      altText: "Family Suite",
      sortOrder: 1,
      isPrimary: true,
    },
    {
      url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c",
      altText: "Family Suite Seating Area",
      sortOrder: 2,
    },
  ]);

  // ---------------------------
  // Rooms - Beirut
  // ---------------------------
  await upsertRoom({
    hotelId: grandPlazaBeirut.id,
    roomTypeId: beirutStandard.id,
    roomNumber: "101",
    floor: 1,
  });
  await upsertRoom({
    hotelId: grandPlazaBeirut.id,
    roomTypeId: beirutStandard.id,
    roomNumber: "102",
    floor: 1,
  });
  await upsertRoom({
    hotelId: grandPlazaBeirut.id,
    roomTypeId: beirutDeluxe.id,
    roomNumber: "201",
    floor: 2,
  });
  await upsertRoom({
    hotelId: grandPlazaBeirut.id,
    roomTypeId: beirutDeluxe.id,
    roomNumber: "202",
    floor: 2,
  });
  await upsertRoom({
    hotelId: grandPlazaBeirut.id,
    roomTypeId: beirutSuite.id,
    roomNumber: "301",
    floor: 3,
  });

  // ---------------------------
  // Rooms - Byblos
  // ---------------------------
  await upsertRoom({
    hotelId: cedarsPalaceByblos.id,
    roomTypeId: byblosStandard.id,
    roomNumber: "B101",
    floor: 1,
  });
  await upsertRoom({
    hotelId: cedarsPalaceByblos.id,
    roomTypeId: byblosTwin.id,
    roomNumber: "B201",
    floor: 2,
  });
  await upsertRoom({
    hotelId: cedarsPalaceByblos.id,
    roomTypeId: byblosTwin.id,
    roomNumber: "B202",
    floor: 2,
  });
  await upsertRoom({
    hotelId: cedarsPalaceByblos.id,
    roomTypeId: byblosSuite.id,
    roomNumber: "B301",
    floor: 3,
  });

  // ---------------------------
  // Rooms - Zahle
  // ---------------------------
  await upsertRoom({
    hotelId: mountainViewZahle.id,
    roomTypeId: zahleClassicDouble.id,
    roomNumber: "501",
    floor: 5,
  });
  await upsertRoom({
    hotelId: mountainViewZahle.id,
    roomTypeId: zahleClassicDouble.id,
    roomNumber: "502",
    floor: 5,
  });
  await upsertRoom({
    hotelId: mountainViewZahle.id,
    roomTypeId: zahleFamilySuite.id,
    roomNumber: "601",
    floor: 6,
  });
  await upsertRoom({
    hotelId: mountainViewZahle.id,
    roomTypeId: zahleFamilySuite.id,
    roomNumber: "602",
    floor: 6,
  });

  console.log("Seed completed successfully");
  console.log({
    roles: [
      superAdminRole.name,
      guestRole.name,
      hotelAdminRole.name,
      managerRole.name,
      receptionistRole.name,
    ],
    hotels: [grandPlazaBeirut.name, cedarsPalaceByblos.name, mountainViewZahle.name],
    users: [
      owner.email,
      beirutAdmin.email,
      beirutReceptionist.email,
      byblosManager.email,
      guestUser.email,
      zahleAdmin.email,
      zahleManager.email,
      zahleReceptionist.email,
    ],
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });