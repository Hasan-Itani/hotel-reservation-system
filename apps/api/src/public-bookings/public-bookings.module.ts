import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { PublicBookingPaymentController } from "./public-booking-payment.controller";
import { PublicBookingsController } from "./public-bookings.controller";
import { PublicBookingsService } from "./public-bookings.service";

@Module({
  imports: [SessionsModule],
  controllers: [PublicBookingsController, PublicBookingPaymentController],
  providers: [PublicBookingsService],
  exports: [PublicBookingsService],
})
export class PublicBookingsModule {}
