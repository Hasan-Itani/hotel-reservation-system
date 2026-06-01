import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson } from "@/lib/frontend/api-server";
import {
  canManageHotelSetup,
  canManagePayments,
  canManageReservations,
  canManageStaff,
  isSuperAdmin,
} from "@/lib/frontend/permissions";
import type {
  ReservationsResponse,
  RoomsResponse,
  RoomTypesResponse,
  StaffListResponse,
} from "@/lib/frontend/types";

type AdminDashboardPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
  }>;
};

async function safeFetch<T>(enabled: boolean, path: string): Promise<T | null> {
  if (!enabled) {
    return null;
  }

  try {
    return await serverFetchJson<T>(path);
  } catch {
    return null;
  }
}

function formatCount(value: number | null) {
  return value === null ? "-" : String(value);
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const user = await getServerAuthUser();
  const hotels = await getServerHotels();

  const params = await searchParams;
  const selectedHotelId = params?.hotelId || hotels[0]?.id || "";
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  const canSetup =
    user && selectedHotel ? canManageHotelSetup(user, selectedHotel.id) : false;

  const canStaff =
    user && selectedHotel ? canManageStaff(user, selectedHotel.id) : false;

  const canReservations =
    user && selectedHotel
      ? canManageReservations(user, selectedHotel.id)
      : false;

  const canPayments =
    user && selectedHotel ? canManagePayments(user, selectedHotel.id) : false;

  const [roomTypesData, roomsData, staffData, reservationsData] = selectedHotel
    ? await Promise.all([
        safeFetch<RoomTypesResponse>(
          canSetup,
          `/api/admin/hotels/${selectedHotel.id}/room-types`,
        ),
        safeFetch<RoomsResponse>(
          canSetup,
          `/api/admin/hotels/${selectedHotel.id}/rooms`,
        ),
        safeFetch<StaffListResponse>(
          canStaff,
          `/api/admin/hotels/${selectedHotel.id}/staff`,
        ),
        safeFetch<ReservationsResponse>(
          canReservations,
          `/api/admin/hotels/${selectedHotel.id}/reservations`,
        ),
      ])
    : [null, null, null, null];

  const hotelQuery = selectedHotel ? `?hotelId=${selectedHotel.id}` : "";

  const stats = [
    {
      label: "Available Hotels",
      value: hotels.length,
      helper: isSuperAdmin(user!) ? "Global access" : "Assigned to your account",
    },
    {
      label: "Room Types",
      value: roomTypesData?.roomTypes.length ?? null,
      helper: canSetup ? "Configured categories" : "Not available for your role",
    },
    {
      label: "Rooms",
      value: roomsData?.rooms.length ?? null,
      helper: canSetup ? "Physical rooms" : "Not available for your role",
    },
    {
      label: "Reservations",
      value: reservationsData?.reservations.length ?? null,
      helper: canReservations
        ? "Visible reservations"
        : "Not available for your role",
    },
    {
      label: "Staff",
      value: staffData?.staff.length ?? null,
      helper: canStaff ? "Assigned staff" : "HOTEL_ADMIN only",
    },
  ];

  const modules = [
    {
      title: "Room Types",
      description: "Manage categories, capacity, prices, beds, and amenities.",
      href: `/admin/room-types${hotelQuery}`,
      allowed: canSetup,
    },
    {
      title: "Rooms",
      description: "Manage physical rooms, floors, statuses, and room type links.",
      href: `/admin/rooms${hotelQuery}`,
      allowed: canSetup,
    },
    {
      title: "Staff",
      description: "Create staff users and manage hotel-level roles.",
      href: `/admin/staff${hotelQuery}`,
      allowed: canStaff,
    },
    {
      title: "Reservations",
      description: "View bookings, assign rooms, and run status transitions.",
      href: `/admin/reservations${hotelQuery}`,
      allowed: canReservations,
    },
    {
      title: "Payments",
      description: "Create mock payments, review payment status, and refund.",
      href: `/admin/payments${hotelQuery}`,
      allowed: canPayments,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-luxury-stone bg-luxury-navy text-white shadow-xl shadow-slate-900/10">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-luxury-gold-soft">
              Admin workspace
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              Review the selected hotel and continue to the operational modules
              available for your staff role.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold-soft">
              Access level
            </p>

            <div className="mt-3">
              {user ? (
                <Badge variant={isSuperAdmin(user) ? "luxury" : "default"}>
                  {isSuperAdmin(user) ? "Global access" : "Hotel staff access"}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-luxury-gold">
          Selected hotel
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Current operating context for admin modules.
        </p>
      </section>

      <Card className="overflow-hidden rounded-[2rem] border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
        <CardContent>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-bold text-slate-500">
                Selected Hotel
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-luxury-ink">
                {selectedHotel?.name || "No hotel selected"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedHotel
                  ? `${selectedHotel.city}, ${selectedHotel.country}`
                  : "Assign a hotel to this user first"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-luxury-stone bg-luxury-cream px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Currency
                </p>
                <p className="mt-2 text-sm font-black text-luxury-ink">
                  {selectedHotel?.currency || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-luxury-stone bg-luxury-cream px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Timezone
                </p>
                <p className="mt-2 text-sm font-black text-luxury-ink">
                  {selectedHotel?.timezone || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-luxury-stone bg-luxury-cream px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Rating
                </p>
                <p className="mt-2 text-sm font-black text-luxury-ink">
                  {selectedHotel?.starRating
                    ? `${selectedHotel.starRating} stars`
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="rounded-[1.5rem] border-luxury-stone bg-white shadow-sm"
          >
            <CardContent>
              <p className="text-sm font-bold text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-black text-luxury-ink">
                {formatCount(stat.value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.helper}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden rounded-[2rem] border-luxury-stone bg-white shadow-xl shadow-slate-900/5">
        <CardHeader>
          <h2 className="text-base font-black text-luxury-ink">
            Admin Modules
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue managing this hotel from the available modules.
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => {
              if (!module.allowed) {
                return (
                  <div
                    key={module.title}
                    className="rounded-[1.5rem] border border-luxury-stone bg-luxury-cream px-4 py-4 opacity-75"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black text-luxury-ink">
                        {module.title}
                      </h3>
                      <Badge>Hidden</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                );
              }

              return (
                <Link
                  key={module.title}
                  href={module.href}
                  className="rounded-[1.5rem] border border-luxury-stone bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-luxury-gold hover:bg-luxury-cream hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-luxury-ink">
                      {module.title}
                    </h3>
                    <Badge variant="success">Ready</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {module.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
