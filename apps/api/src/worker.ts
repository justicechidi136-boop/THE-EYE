import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  process.env.THE_EYE_RUN_NOTIFICATION_WORKER = "1";
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.enableShutdownHooks();
  // Keep the worker process alive until SIGTERM/SIGINT.
  await new Promise<void>(() => undefined);
}

void bootstrap();
