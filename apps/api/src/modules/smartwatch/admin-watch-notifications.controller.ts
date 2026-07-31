import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminRoleName, DangerAlertCode, SPOKEN_LANGUAGE_CODES, type SpokenLanguageCodeValue } from "@the-eye/shared";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { resolveAppEnvironment } from "../../common/auth/firebase-environment";
import {
  inspectWatchFeatureFlags,
  isWatchFeatureEnabled,
  resolveWatchFeatureFlags,
} from "../../common/feature-flags/watch-feature-flags";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { WatchAlertTelemetryService } from "../danger-zones/watch-alert-telemetry.service";
import { WatchDangerAlertDeliveryService } from "../danger-zones/watch-danger-alert-delivery.service";
import { buildDangerZoneAlertPayload } from "../danger-zones/danger-alert-payload";

const STAGING_TEST_ALERT_AUDIT_ACTION = "TEST_DANGER_ZONE_ALERT";

@ApiTags("admin-watch-notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/watch-notifications")
export class AdminWatchNotificationsController {
  constructor(
    private readonly telemetry: WatchAlertTelemetryService,
    private readonly delivery: WatchDangerAlertDeliveryService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get("analytics")
  @RequirePermissions("broadcast:publish")
  analytics(
    @Req() request: { user: any },
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("language") language?: string,
    @Query("country") country?: string,
    @Query("state") state?: string,
    @Query("lga") lga?: string,
    @Query("channel") channel?: string,
    @Query("alertCode") alertCode?: string,
    @Query("deliveryStatus") deliveryStatus?: string,
    @Query("acknowledged") acknowledged?: string,
  ) {
    if (!isWatchFeatureEnabled(this.config as unknown as Record<string, unknown>, "WATCH_ADMIN_TELEMETRY")) {
      throw new ForbiddenException("WATCH_ADMIN_TELEMETRY is disabled");
    }

    return this.telemetry.summary(request.user, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      language,
      country,
      state,
      lga,
      channel,
      alertCode,
      deliveryStatus,
      acknowledged:
        acknowledged === undefined ? undefined : acknowledged === "true" || acknowledged === "1",
    });
  }

  @Get("analytics/:safetyAlertId")
  @RequirePermissions("broadcast:publish")
  alertDetail(@Req() request: { user: any }, @Param("safetyAlertId") safetyAlertId: string) {
    if (!isWatchFeatureEnabled(this.config as unknown as Record<string, unknown>, "WATCH_ADMIN_TELEMETRY")) {
      throw new ForbiddenException("WATCH_ADMIN_TELEMETRY is disabled");
    }

    return this.telemetry.alertDetail(request.user, safetyAlertId);
  }

  @Get("feature-flags")
  @RequirePermissions("incident:read")
  featureFlags() {
    const flags = resolveWatchFeatureFlags(this.config as unknown as Record<string, unknown>);
    return {
      flags,
      validation: inspectWatchFeatureFlags(this.config as unknown as Record<string, unknown>),
    };
  }

  @Post("staging/test-alert")
  @RateLimit("stagingDangerZoneTest")
  @RequirePermissions("broadcast:publish")
  async stagingTestAlert(
    @Body()
    dto: {
      userId: string;
      deviceId?: string;
      alertCode?: string;
      languageHint?: string;
      priority?: "CRITICAL" | "HIGH" | "MEDIUM";
      channelMode?: "auto" | "phone_relay" | "watch_push" | "both";
      connectivityModeOverride?: "PairedPhone" | "StandaloneCellular" | "Standalone";
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

    if (dto.languageHint && !SPOKEN_LANGUAGE_CODES.includes(dto.languageHint as SpokenLanguageCodeValue)) {
      throw new ForbiddenException(
        `Unsupported languageHint. Supported: ${SPOKEN_LANGUAGE_CODES.join(", ")}`,
      );
    }

    const safetyAlertId = `staging-test-${Date.now()}`;
    const correlationId = `test-danger-zone-${Date.now()}`;
    const dangerAlert = buildDangerZoneAlertPayload({
      zoneId: "staging-test-zone",
      incidentId: "staging-test-incident",
      safetyAlertId,
      userId: dto.userId,
      deviceId: dto.deviceId ?? null,
      alertId: `staging-test-alert-${dto.userId}`.replace(/:/g, "-"),
      version: 1,
      sequence: 1,
      alertState: "Critical",
      metadata: { dangerAlertCode: dto.alertCode ?? DangerAlertCode.GENERAL_ENTRY },
      languageHint: dto.languageHint as SpokenLanguageCodeValue | undefined,
      notificationPriority: dto.priority ?? "CRITICAL",
      acknowledgementRequired: true,
      config: this.config as unknown as Record<string, unknown>,
    });

    const result = await this.delivery.enqueueDelivery({
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
      channelMode: dto.channelMode ?? "auto",
      connectivityModeOverride: dto.connectivityModeOverride,
    });

    await this.audit.record({
      actor: request.user,
      action: STAGING_TEST_ALERT_AUDIT_ACTION,
      entityType: "watch_notifications",
      entityId: safetyAlertId,
      metadata: {
        correlationId,
        userId: dto.userId,
        deviceId: dto.deviceId ?? null,
        alertCode: dto.alertCode ?? DangerAlertCode.GENERAL_ENTRY,
        languageHint: dto.languageHint ?? null,
        priority: dto.priority ?? "CRITICAL",
        channelMode: dto.channelMode ?? "auto",
        connectivityModeOverride: dto.connectivityModeOverride ?? null,
        delivery: result,
      },
    });

    return {
      ...result,
      safetyAlertId,
      correlationId,
      auditAction: STAGING_TEST_ALERT_AUDIT_ACTION,
    };
  }
}
