import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { MetricsService } from "../../common/metrics/metrics.service";

function isPgbouncerUrl(url?: string) {
  return Boolean(url && /[?&]pgbouncer=true\b/.test(url));
}

function createPrismaClient(metrics?: MetricsService): PrismaClient {
  const base = new PrismaClient({
    log: process.env.PRISMA_LOG_QUERY === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });
  if (!metrics) return base;

  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const startedAt = process.hrtime.bigint();
        try {
          const result = await query(args);
          metrics.recordDbQuery(
            model ?? "raw",
            operation,
            Number(process.hrtime.bigint() - startedAt) / 1e9,
            "success",
          );
          return result;
        } catch (error) {
          metrics.recordDbQuery(
            model ?? "raw",
            operation,
            Number(process.hrtime.bigint() - startedAt) / 1e9,
            "error",
          );
          throw error;
        }
      },
    },
  }) as unknown as PrismaClient;
}

async function connectPrismaClient(client: PrismaClient, logger: Logger) {
  if (process.env.THE_EYE_SKIP_DB_CONNECT === "1") return;

  const runtimeUrl = process.env.DATABASE_URL;
  if (isPgbouncerUrl(runtimeUrl)) {
    logger.log("Prisma connected via PgBouncer (transaction pooling)");
  }

  if (!process.env.DATABASE_DIRECT_URL && process.env.NODE_ENV === "production") {
    logger.warn(
      "DATABASE_DIRECT_URL is unset; run prisma migrate deploy against direct Postgres, not PgBouncer",
    );
  }

  await client.$connect();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await connectPrismaClient(this, this.logger);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export function createPrismaService(metrics?: MetricsService): PrismaService {
  const logger = new Logger(PrismaService.name);
  const client = createPrismaClient(metrics);
  return Object.assign(client, {
    async onModuleInit() {
      await connectPrismaClient(client, logger);
    },
    async onModuleDestroy() {
      await client.$disconnect();
    },
  }) as unknown as PrismaService;
}
