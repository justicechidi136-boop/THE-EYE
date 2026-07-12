import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyJwt } from "./jwt";
import { requireJwtAccessSecret } from "./jwt-secrets";
import { resolveAuthenticatedUser } from "./resolve-auth-user";
import { PrismaService } from "../../modules/prisma/prisma.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization as string | undefined;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      const payload = verifyJwt(token, requireJwtAccessSecret(this.config));
      request.user = await resolveAuthenticatedUser(this.prisma, payload);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
