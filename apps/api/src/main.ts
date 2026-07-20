import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./modules/app.module";

// Prisma BigInt fields (e.g. audit_logs.sequence) must be JSON-serializable.
(BigInt.prototype as { toJSON?: () => string }).toJSON = function toJSON() {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.setGlobalPrefix("v1", { exclude: ["metrics"] });
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["X-Request-ID"],
  });
  app.useBodyParser("json", { limit: process.env.JSON_BODY_LIMIT ?? "10mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: process.env.JSON_BODY_LIMIT ?? "10mb" });
  app.use((_: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    if (isProduction) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  if (!isProduction || process.env.ENABLE_SWAGGER === "true") {
    if (isProduction && !process.env.SWAGGER_BEARER_TOKEN) {
      console.warn("Swagger enabled in production without SWAGGER_BEARER_TOKEN — restrict /docs at the reverse proxy");
    }
    const config = new DocumentBuilder()
      .setTitle("THE EYE API")
      .setDescription("Emergency response, reporting, broadcast, and escalation API.")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

void bootstrap();
