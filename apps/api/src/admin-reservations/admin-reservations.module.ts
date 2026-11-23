import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { AdminReservationsController } from "./admin-reservations.controller";

@Module({
  imports: [SessionsModule],
  controllers: [AdminReservationsController],
})
export class AdminReservationsModule {}
