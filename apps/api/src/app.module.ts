import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminRoomsModule } from "./admin-rooms/admin-rooms.module";
import { validateEnvironment } from "./common/config/environment";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { RateLimitModule } from "./common/rate-limit/rate-limit.module";
import { PublicHotelsModule } from "./public-hotels/public-hotels.module";
import { PublicBookingsModule } from "./public-bookings/public-bookings.module";
import { GuestAccountsModule } from "./guest-accounts/guest-accounts.module";
import { SessionsModule } from "./sessions/sessions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../../.env"),
      ],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RateLimitModule,
    HealthModule,
    PublicHotelsModule,
    PublicBookingsModule,
    AdminRoomsModule,
    GuestAccountsModule,
    SessionsModule,
  ],
})
export class AppModule {}
