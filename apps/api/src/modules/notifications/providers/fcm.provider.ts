import { createSign } from "crypto";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolveAppEnvironment, type AppEnvironment } from "../../../common/auth/firebase-environment";
import { PrismaService } from "../../prisma/prisma.service";
import { buildNotificationDeepLink } from "../notification-inbox.mapper";
import { NotificationDispatchError } from "../notification-dispatch.error";
import type { NotificationDispatchPayload, NotificationDispatchResult } from "../notification.types";
import { isEmergencyPriority } from "../notification.types";
import {
  assertFcmRuntimeAllowed,
  isProductionLikeFcmRuntime,
  normalizeFcmPrivateKey,
  resolveFcmRuntime,
  type FcmRuntimeConfig,
} from "./fcm.config";

type FcmTokenResponse = {
  access_token?: string;
  error?: string;
};

type FcmSendResponse = {
  name?: string;
  error?: { message?: string; status?: string };
};

export type FcmTokenOutcome =
  | "provider_accepted"
  | "failed"
  | "invalid_token";

type FcmTokenResult = {
  tokenSuffix: string;
  outcome: FcmTokenOutcome;
  providerMessageId?: string;
  error?: string;
  deactivated?: boolean;
};

@Injectable()
export class FcmProvider implements OnModuleInit {
  private readonly logger = new Logger(FcmProvider.name);
  private cachedToken?: { value: string; expiresAt: number };
  private runtime?: FcmRuntimeConfig;
  private initialized = false;
  private readonly workerAppEnvironment: AppEnvironment;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.workerAppEnvironment = resolveAppEnvironment({
      THE_EYE_APP_ENV: this.config.get<string>("THE_EYE_APP_ENV"),
      FCM_PROJECT_ID: this.config.get<string>("FCM_PROJECT_ID"),
      FIREBASE_PROJECT_ID: this.config.get<string>("FIREBASE_PROJECT_ID"),
      NODE_ENV: process.env.NODE_ENV,
    });
  }

  onModuleInit() {
    if (this.initialized) return;
    this.runtime = resolveFcmRuntime(this.config);
    if (this.runtime.mode === "real") {
      this.logger.log(
        `FCM runtime ready (project=${this.runtime.projectId}, mode=real, credential=service-account-jwt)`,
      );
    } else if (isProductionLikeFcmRuntime(this.config)) {
      throw new Error(this.runtime.reason);
    } else {
      this.logger.warn(`FCM runtime simulation enabled: ${this.runtime.reason}`);
    }
    this.initialized = true;
  }

  async send(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const runtime = assertFcmRuntimeAllowed(this.config);
    if (runtime.mode === "simulated") {
      throw new NotificationDispatchError(
        `FCM dispatch unavailable: ${runtime.reason}`,
        "firebase-cloud-messaging",
        false,
        { simulated: true, fcmMode: "simulated", reason: runtime.reason },
      );
    }

    if (!payload.userId && !payload.targetToken) {
      throw new NotificationDispatchError("Push notifications require a userId or targetToken", "firebase-cloud-messaging");
    }

    const tokens = await this.resolveTargetTokens(payload);
    if (!tokens.length) {
      throw new NotificationDispatchError("No active push tokens registered for user", "firebase-cloud-messaging", false);
    }

    const accessToken = await this.getAccessToken(runtime.clientEmail, runtime.privateKey);
    const emergency = isEmergencyPriority(payload.priority);
    const storedMetadata = payload.notificationId
      ? (((await this.prisma.notification.findUnique({
          where: { id: payload.notificationId },
          select: { metadata: true },
        }))?.metadata ?? {}) as Record<string, unknown>)
      : {};
    const silent = storedMetadata.silent === true;
    const tokenResults: FcmTokenResult[] = [];
    const deepLink = buildNotificationDeepLink({
      id: payload.notificationId ?? "",
      type: payload.type ?? "IncidentStatusUpdate",
      priority: payload.priority ?? "Normal",
      channel: payload.channel ?? "push",
      title: payload.title,
      body: payload.body,
      status: "Pending",
      createdAt: new Date(),
      incidentId: payload.incidentId,
      broadcastId: payload.broadcastId,
      metadata: storedMetadata,
    });

    for (const entry of tokens) {
      const tokenSuffix = maskToken(entry.token);
      if (entry.appEnvironment && entry.appEnvironment !== this.workerAppEnvironment) {
        tokenResults.push({
          tokenSuffix,
          outcome: "failed",
          error: `Push token is registered for ${entry.appEnvironment}; worker environment is ${this.workerAppEnvironment}`,
        });
        continue;
      }
      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${runtime.projectId}/messages:send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: entry.token,
              notification: { title: payload.title, body: payload.body },
              data: {
                notificationId: payload.notificationId ?? "",
                type: payload.type ?? "",
                priority: payload.priority ?? "Normal",
                incidentId: payload.incidentId ?? "",
                broadcastId: payload.broadcastId ?? "",
                route: deepLink,
                deepLink,
                silent: silent ? "true" : "false",
              },
              android: { priority: emergency && !silent ? "high" : "normal" },
              apns: {
                headers: { "apns-priority": emergency && !silent ? "10" : "5" },
                payload: { aps: { sound: emergency && !silent ? "emergency.caf" : undefined } },
              },
            },
          }),
        });

        const body = (await response.json()) as FcmSendResponse;
        if (!response.ok) {
          const errorMessage = body.error?.message ?? `FCM request failed with ${response.status}`;
          const invalidToken = isInvalidFcmTokenError(body.error?.status, errorMessage);
          const deactivated = invalidToken ? await this.deactivateInvalidToken(entry.token) : false;
          tokenResults.push({
            tokenSuffix,
            outcome: invalidToken ? "invalid_token" : "failed",
            error: errorMessage,
            deactivated,
          });
          continue;
        }

        tokenResults.push({
          tokenSuffix,
          outcome: "provider_accepted",
          providerMessageId: body.name,
        });
      } catch (error) {
        tokenResults.push({
          tokenSuffix,
          outcome: "failed",
          error: error instanceof Error ? error.message : "FCM send failed",
        });
      }
    }

    const accepted = tokenResults.filter((result) => result.outcome === "provider_accepted");
    if (!accepted.length) {
      throw new NotificationDispatchError(
        tokenResults.map((result) => result.error).filter(Boolean).join("; ") || "FCM submission failed for all tokens",
        "firebase-cloud-messaging",
        tokenResults.every((result) => result.outcome === "invalid_token") ? false : true,
        { tokenResults, projectId: runtime.projectId, fcmMode: "real" },
      );
    }

    return {
      status: "Sent",
      provider: "firebase-cloud-messaging",
      providerMessageId: accepted[0].providerMessageId,
      recipientCount: accepted.length,
      responsePayload: {
        projectId: runtime.projectId,
        fcmMode: "real",
        emergency,
        tokenResults,
      },
    };
  }

  getRuntimeSnapshot() {
    return this.runtime ?? resolveFcmRuntime(this.config);
  }

  private async resolveTargetTokens(payload: NotificationDispatchPayload) {
    const environmentFilter = { appEnvironment: this.workerAppEnvironment };

    if (payload.targetToken) {
      const entry = await (this.prisma as any).userPushToken.findFirst({
        where: { token: payload.targetToken, isActive: true, ...environmentFilter },
      });
      return entry ? [entry] : [];
    }

    return (this.prisma as any).userPushToken.findMany({
      where: {
        userId: payload.userId,
        isActive: true,
        ...environmentFilter,
        ...(payload.channel === "watch_push"
          ? { platform: "android_watch", ...(payload.deviceId ? { deviceId: payload.deviceId } : {}) }
          : {}),
      },
      orderBy: { lastSeenAt: "desc" },
      take: payload.channel === "watch_push" ? 3 : 10,
    });
  }

  private async deactivateInvalidToken(token: string) {
    const updated = await (this.prisma as any).userPushToken.updateMany({
      where: { token, isActive: true },
      data: { isActive: false },
    });
    return updated.count > 0;
  }

  private async getAccessToken(clientEmail: string, privateKey: string) {
    const normalizedKey = normalizeFcmPrivateKey(privateKey);
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60) {
      return this.cachedToken.value;
    }

    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url");
    const unsigned = `${header}.${claim}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(normalizedKey, "base64url");
    const assertion = `${unsigned}.${signature}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    const body = (await response.json()) as FcmTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new NotificationDispatchError(body.error ?? "Unable to obtain FCM access token", "firebase-cloud-messaging");
    }

    this.cachedToken = { value: body.access_token, expiresAt: now + 3500 };
    return body.access_token;
  }
}

export function maskToken(token: string) {
  const trimmed = token.trim();
  return trimmed.length > 8 ? `...${trimmed.slice(-8)}` : "[short-token]";
}

export function isInvalidFcmTokenError(status?: string, message?: string) {
  const normalized = `${status ?? ""} ${message ?? ""}`.toUpperCase();
  if (normalized.includes("NOT_FOUND") || normalized.includes("UNREGISTERED")) return true;
  if (normalized.includes("INVALID_ARGUMENT") && (normalized.includes("TOKEN") || normalized.includes("REGISTRATION"))) {
    return true;
  }
  return false;
}
