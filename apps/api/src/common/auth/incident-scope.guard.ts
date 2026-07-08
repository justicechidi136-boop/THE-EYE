import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AdminRoleName } from "@the-eye/shared";

@Injectable()
export class IncidentScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;
    if (user.typ !== "admin") return true;
    if (user.role === AdminRoleName.SuperAdmin) return true;
    if (user.role === AdminRoleName.OversightAuditor && ["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      throw new ForbiddenException("Oversight Auditor cannot modify incidents");
    }
    return true;
  }
}
