import { Module } from "@nestjs/common";
import { PublicBookingsModule } from "../public-bookings/public-bookings.module";
import { SessionsModule } from "../sessions/sessions.module";
import { GuestAccountsController } from "./guest-accounts.controller";
import { GuestAccountsService } from "./guest-accounts.service";

@Module({
  imports: [SessionsModule, PublicBookingsModule],
  controllers: [GuestAccountsController],
  providers: [GuestAccountsService],
})
export class GuestAccountsModule {}
