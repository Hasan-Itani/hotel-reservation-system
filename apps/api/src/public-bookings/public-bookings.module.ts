import { Module } from "@nestjs/common";
import { PublicBookingsController } from "./public-bookings.controller";
import { PublicBookingsService } from "./public-bookings.service";

@Module({
  controllers: [PublicBookingsController],
  providers: [PublicBookingsService],
})
export class PublicBookingsModule {}
