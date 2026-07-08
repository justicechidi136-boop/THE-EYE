import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyJwt } from "./jwt";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization as string | undefined;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return true;

    try {
      request.user = verifyJwt(token, this.config.get<string>("JWT_ACCESS_SECRET", "dev-access-secret"));
    } catch {
      request.user = undefined;
    }

    return true;
  }
}
