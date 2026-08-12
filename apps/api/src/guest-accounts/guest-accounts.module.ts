import { Module } from "@nestjs/common";
import { GuestAccountsController } from "./guest-accounts.controller";
import { GuestAccountsService } from "./guest-accounts.service";

@Module({
  controllers: [GuestAccountsController],
  providers: [GuestAccountsService],
})
export class GuestAccountsModule {}
