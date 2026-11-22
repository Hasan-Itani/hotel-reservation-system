import { Suspense } from "react";
import { PaymentsClient } from "@/components/payments/PaymentsClient";
import { Card, CardContent } from "@/components/ui/Card";
import { requireAdminPageAccess } from "@/lib/frontend/admin-page-access";
import { serverFetchJson, ServerApiError } from "@/lib/frontend/api-server";
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
  const params = await searchParams;
  const { selectedHotel } = await requireAdminPageAccess("/admin/payments", params?.hotelId);

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
