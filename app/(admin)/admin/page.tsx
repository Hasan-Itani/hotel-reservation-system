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
  return value === null ? "—" : String(value);
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const user = await getServerAuthUser();
  const hotels = await getServerHotels();

  const params = await searchParams;
  const selectedHotelId = params?.hotelId || hotels[0]?.id || "";
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  const canSetup = user && selectedHotel
    ? canManageHotelSetup(user, selectedHotel.id)
    : false;

  const canStaff = user && selectedHotel
    ? canManageStaff(user, selectedHotel.id)
    : false;

  const canReservations = user && selectedHotel
    ? canManageReservations(user, selectedHotel.id)
    : false;

  const canPayments = user && selectedHotel
    ? canManagePayments(user, selectedHotel.id)
    : false;

  const [roomTypesData, roomsData, staffData, reservationsData] =
    selectedHotel
      ? await Promise.all([
          safeFetch<RoomTypesResponse>(
            canSetup,
            `/api/admin/hotels/${selectedHotel.id}/room-types`
          ),
          safeFetch<RoomsResponse>(
            canSetup,
            `/api/admin/hotels/${selectedHotel.id}/rooms`
          ),
          safeFetch<StaffListResponse>(
            canStaff,
            `/api/admin/hotels/${selectedHotel.id}/staff`
          ),
          safeFetch<ReservationsResponse>(
            canReservations,
            `/api/admin/hotels/${selectedHotel.id}/reservations`
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
      helper: canReservations ? "Visible reservations" : "Not available for your role",
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
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin overview for the selected hotel.
          </p>
        </div>

        {user ? (
          <Badge variant={isSuperAdmin(user) ? "primary" : "default"}>
            {isSuperAdmin(user) ? "Global access" : "Hotel staff access"}
          </Badge>
        ) : null}
      </section>

      <Card>
        <CardContent>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Selected Hotel
              </p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">
                {selectedHotel?.name || "No hotel selected"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedHotel
                  ? `${selectedHotel.city}, ${selectedHotel.country}`
                  : "Assign a hotel to this user first"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Currency
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {selectedHotel?.currency || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Timezone
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {selectedHotel?.timezone || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Rating
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">
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
          <Card key={stat.label}>
            <CardContent>
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {formatCount(stat.value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.helper}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">
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
                    className="rounded-xl border border-border bg-surface-muted px-4 py-4 opacity-70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-foreground">
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
                  className="rounded-xl border border-border bg-white px-4 py-4 shadow-sm transition hover:border-primary hover:bg-primary-soft"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-foreground">
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