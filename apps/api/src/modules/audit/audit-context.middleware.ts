import { Injectable, NestMiddleware } from "@nestjs/common";

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    req.auditContext = {
      ipAddress: req.ip ?? req.headers?.["x-forwarded-for"]?.toString().split(",")[0]?.trim(),
      userAgent: req.headers?.["user-agent"],
      requestId: req.headers?.["x-request-id"],
    };
    next();
  }
}
