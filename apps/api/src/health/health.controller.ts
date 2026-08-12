import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  getServiceHealth() {
    return {
      status: "ok",
      service: "hotel-api",
    };
  }

  @Get("database")
  async getDatabaseHealth() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      service: "database",
    };
  }
}
