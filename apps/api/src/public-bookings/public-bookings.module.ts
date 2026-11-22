import { Module } from "@nestjs/common";
import { PublicBookingsController } from "./public-bookings.controller";
import { PublicBookingsService } from "./public-bookings.service";

@Module({
  controllers: [PublicBookingsController],
  providers: [PublicBookingsService],
  exports: [PublicBookingsService],
})
export class PublicBookingsModule {}
