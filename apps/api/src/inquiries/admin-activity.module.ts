import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { AdminActivityController } from "./admin-activity.controller";

@Module({
  imports: [SessionsModule],
  controllers: [AdminActivityController],
})
export class AdminActivityModule {}
