import { Module } from "@nestjs/common";
import { SessionsModule } from "../sessions/sessions.module";
import { GuestAccountsController } from "./guest-accounts.controller";
import { GuestAccountsService } from "./guest-accounts.service";

@Module({
  imports: [SessionsModule],
  controllers: [GuestAccountsController],
  providers: [GuestAccountsService],
})
export class GuestAccountsModule {}
