import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { AdminHotelListController } from "./admin-hotel-list.controller";
import { AdminPeopleController } from "./admin-people.controller";

@Module({
  imports: [SessionsModule],
  controllers: [AdminHotelListController, AdminPeopleController],
})
export class AdminPeopleModule {}
