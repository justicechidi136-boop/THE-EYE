import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyJwt } from "./jwt";
import { requireJwtAccessSecret } from "./jwt-secrets";
import { resolveAuthenticatedUser } from "./resolve-auth-user";
import { PrismaService } from "../../modules/prisma/prisma.service";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization as string | undefined;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return true;

    try {
      const payload = verifyJwt(token, requireJwtAccessSecret(this.config));
      request.user = await resolveAuthenticatedUser(this.prisma, payload);
    } catch {
      request.user = undefined;
    }

    return true;
  }
}
