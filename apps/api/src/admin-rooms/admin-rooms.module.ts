import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { AdminRoomsController } from "./admin-rooms.controller";

@Module({
  imports: [SessionsModule],
  controllers: [AdminRoomsController],
})
export class AdminRoomsModule {}
