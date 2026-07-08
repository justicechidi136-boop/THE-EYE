import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyJwt } from "./jwt";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization as string | undefined;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      request.user = verifyJwt(token, this.config.get<string>("JWT_ACCESS_SECRET", "dev-access-secret"));
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
