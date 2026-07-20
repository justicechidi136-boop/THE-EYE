import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { toJsonSafe } from "./json-safe";

/**
 * Ensures every HTTP response body is JSON-serializable (BigInt, Prisma.Decimal, Date).
 */
@Injectable()
export class JsonSafeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => toJsonSafe(data)));
  }
}
