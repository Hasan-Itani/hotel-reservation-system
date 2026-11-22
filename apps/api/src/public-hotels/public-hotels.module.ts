import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { PublicHotelBookingController } from "./public-hotel-booking.controller";
import { PublicHotelsController } from "./public-hotels.controller";
import { PublicHotelsService } from "./public-hotels.service";

@Module({
  imports: [SessionsModule],
  controllers: [PublicHotelsController, PublicHotelBookingController],
  providers: [PublicHotelsService],
})
export class PublicHotelsModule {}
