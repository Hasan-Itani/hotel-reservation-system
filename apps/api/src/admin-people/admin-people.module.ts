import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { AdminPeopleController } from "./admin-people.controller";

@Module({
  imports: [SessionsModule],
  controllers: [AdminPeopleController],
})
export class AdminPeopleModule {}
