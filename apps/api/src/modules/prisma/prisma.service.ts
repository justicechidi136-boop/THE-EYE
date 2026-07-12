import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";

import { PrismaClient } from "@prisma/client";

import { MetricsService } from "../../common/metrics/metrics.service";



function isPgbouncerUrl(url?: string) {

  return Boolean(url && /[?&]pgbouncer=true\b/.test(url));

}



@Injectable()

export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(PrismaService.name);



  constructor(@Optional() private readonly metrics?: MetricsService) {

    super({

      log: process.env.PRISMA_LOG_QUERY === "1" ? ["query", "warn", "error"] : ["warn", "error"],

    });

  }



  async onModuleInit() {

    if (this.metrics) {

      const metrics = this.metrics;

      const extended = this.$extends({

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

      });

      Object.assign(this, extended);

    }



    if (process.env.THE_EYE_SKIP_DB_CONNECT === "1") return;



    const runtimeUrl = process.env.DATABASE_URL;

    if (isPgbouncerUrl(runtimeUrl)) {

      this.logger.log("Prisma connected via PgBouncer (transaction pooling)");

    }



    if (!process.env.DATABASE_DIRECT_URL && process.env.NODE_ENV === "production") {

      this.logger.warn(

        "DATABASE_DIRECT_URL is unset; run prisma migrate deploy against direct Postgres, not PgBouncer",

      );

    }



    await this.$connect();

  }



  async onModuleDestroy() {

    await this.$disconnect();

  }

}

