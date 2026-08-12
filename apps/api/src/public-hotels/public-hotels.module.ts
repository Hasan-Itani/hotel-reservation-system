import { Module } from "@nestjs/common";
import { PublicHotelsController } from "./public-hotels.controller";
import { PublicHotelsService } from "./public-hotels.service";

@Module({
  controllers: [PublicHotelsController],
  providers: [PublicHotelsService],
})
export class PublicHotelsModule {}
