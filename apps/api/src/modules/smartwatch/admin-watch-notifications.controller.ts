import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminRoleName } from "@the-eye/shared";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { resolveAppEnvironment } from "../../common/auth/firebase-environment";
import { resolveWatchFeatureFlags, isWatchFeatureEnabled } from "../../common/feature-flags/watch-feature-flags";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException } from "@nestjs/common";
import { WatchAlertTelemetryService } from "../danger-zones/watch-alert-telemetry.service";
import { WatchDangerAlertDeliveryService } from "../danger-zones/watch-danger-alert-delivery.service";
import { buildDangerZoneAlertPayload } from "../danger-zones/danger-alert-payload";
import { DangerAlertCode } from "@the-eye/shared";

@ApiTags("admin-watch-notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/watch-notifications")
export class AdminWatchNotificationsController {
  constructor(
    private readonly telemetry: WatchAlertTelemetryService,
    private readonly delivery: WatchDangerAlertDeliveryService,
    private readonly config: ConfigService,
  ) {}

  @Get("analytics")
  @RequirePermissions("broadcast:publish")
  analytics(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("language") language?: string,
  ) {
    return this.telemetry.summary({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      language,
    });
  }

  @Get("feature-flags")
  @RequirePermissions("incident:read")
  featureFlags() {
    return resolveWatchFeatureFlags(this.config as unknown as Record<string, unknown>);
  }

  @Post("staging/test-alert")
  @RequirePermissions("broadcast:publish")
  async stagingTestAlert(
    @Body()
    dto: {
      userId: string;
      deviceId?: string;
      alertCode?: string;
      languageHint?: string;
      priority?: "CRITICAL" | "HIGH" | "MEDIUM";
    },
    @Req() request: any,
  ) {
    const appEnv = resolveAppEnvironment(this.config as unknown as Record<string, unknown>);
    if (appEnv === "production") {
      throw new ForbiddenException("Staging test alerts are disabled in production");
    }
    if (!isWatchFeatureEnabled(this.config as unknown as Record<string, unknown>, "WATCH_ADMIN_TEST_ALERT")) {
      throw new ForbiddenException("WATCH_ADMIN_TEST_ALERT is disabled");
    }
    if (request.user?.role !== AdminRoleName.SuperAdmin && request.user?.role !== AdminRoleName.CountryAdmin) {
      throw new ForbiddenException("Only super/country admins may send staging test alerts");
    }

    const safetyAlertId = `staging-test-${Date.now()}`;
    const dangerAlert = buildDangerZoneAlertPayload({
      zoneId: "staging-test-zone",
      incidentId: "staging-test-incident",
      safetyAlertId,
      alertState: "Critical",
      metadata: { dangerAlertCode: dto.alertCode ?? DangerAlertCode.GENERAL_ENTRY },
      languageHint: dto.languageHint as any,
      notificationPriority: dto.priority ?? "CRITICAL",
      acknowledgementRequired: true,
    });

    return this.delivery.enqueueDelivery({
      safetyAlertId,
      userId: dto.userId,
      deviceId: dto.deviceId ?? null,
      dangerZoneId: "staging-test-zone",
      incidentId: "staging-test-incident",
      alertState: "Critical",
      idempotencyKey: `staging-test-${dto.userId}-${Date.now()}`,
      dangerAlert,
      title: "STAGING TEST ALERT",
      body: "This is an authorized staging test of spoken watch danger alerts.",
      actorAdminId: request.user.sub,
    });
  }
}
