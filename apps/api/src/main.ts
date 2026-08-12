import "reflect-metadata";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { parseAllowedOrigins } from "./common/config/environment";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const config = app.get(ConfigService);
  const port = Number(config.getOrThrow("API_PORT"));

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Hotel Reservation API",
        description: "NestJS API for the hotel reservation system",
        version: "1.0",
      },
    },
  });
  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });
  app.enableCors({
    origin: parseAllowedOrigins(config.get<string>("API_CORS_ORIGINS")),
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port, "0.0.0.0");
  Logger.log(`Hotel API is listening on port ${port}`, "Bootstrap");
}

void bootstrap();
