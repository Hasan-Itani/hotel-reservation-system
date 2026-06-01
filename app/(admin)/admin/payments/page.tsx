import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PaymentsClient } from "@/components/payments/PaymentsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { getServerAuthUser, getServerHotels } from "@/lib/frontend/auth-server";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
import { canManagePayments } from "@/lib/frontend/permissions";
import type {
  ReservationPaymentsResponse,
  ReservationsResponse,
} from "@/lib/frontend/types";

type PaymentsPageProps = {
  searchParams?: Promise<{
    hotelId?: string;
    reservationId?: string;
  }>;
};

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const user = await getServerAuthUser();

  if (!user) {
    redirect("/login");
  }

  const [hotels, params] = await Promise.all([getServerHotels(), searchParams]);

  const selectedHotelId = params?.hotelId || hotels[0]?.id || "";
  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  if (!selectedHotel) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Payments</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No hotel is available for this account.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canManagePayments(user, selectedHotel.id)) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need HOTEL_ADMIN, MANAGER, or RECEPTIONIST access to manage
            payments.
          </p>
        </CardContent>
      </Card>
    );
  }

  let reservations: ReservationsResponse["reservations"] = [];
  let initialPaymentReservation: ReservationPaymentsResponse["reservation"] | null =
    null;
  let loadError = "";

  try {
    const reservationsData = await serverFetchJson<ReservationsResponse>(
      `/api/admin/hotels/${selectedHotel.id}/reservations`,
    );

    reservations = reservationsData.reservations;

    const selectedReservationId =
      params?.reservationId || reservationsData.reservations[0]?.id || "";

    if (selectedReservationId) {
      const paymentsData = await serverFetchJson<ReservationPaymentsResponse>(
        `/api/admin/hotels/${selectedHotel.id}/reservations/${selectedReservationId}/payments`,
      );

      initialPaymentReservation = paymentsData.reservation;
    }
  } catch (error: unknown) {
    if (error instanceof ServerApiError) {
      loadError = error.message;
    } else if (error instanceof Error) {
      loadError = error.message;
    } else {
      loadError = "Unable to load payments";
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">Payments</h1>
          <p className="mt-2 text-sm text-danger">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Suspense
      fallback={
        <Card>
          <CardContent>Loading payments&hellip;</CardContent>
        </Card>
      }
    >
      <PaymentsClient
        hotel={selectedHotel}
        reservations={reservations}
        initialPaymentReservation={initialPaymentReservation}
      />
    </Suspense>
  );
}
