import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  FieldOfficerSafetyAlertStatus,
  FieldOfficerSafetyAlertType,
  FieldOperationalEventType,
  OfficerOperationalStatus,
} from "@the-eye/shared";
import type { JwtPayload } from "../../common/auth/jwt";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { FieldEventsService } from "./field-events.service";
import { assertFieldSession, decimalOrNull } from "./field-session.util";

export type OfficerSafetyDto = {
  alertType: FieldOfficerSafetyAlertType;
  latitude?: number;
  longitude?: number;
  batteryLevel?: number;
  networkType?: string;
  note?: string;
  clientActionId?: string;
  generationId?: string;
};

@Injectable()
export class FieldOfficerSafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: FieldEventsService,
  ) {}

  async triggerPanic(actor: JwtPayload, dto: OfficerSafetyDto) {
    return this.createAlert(actor, { ...dto, alertType: FieldOfficerSafetyAlertType.Panic });
  }

  async triggerOfficerDown(actor: JwtPayload, dto: OfficerSafetyDto) {
    return this.createAlert(actor, { ...dto, alertType: FieldOfficerSafetyAlertType.OfficerDown });
  }

  async triggerDistress(actor: JwtPayload, dto: OfficerSafetyDto) {
    return this.createAlert(actor, { ...dto, alertType: FieldOfficerSafetyAlertType.DistressSignal });
  }

  async scheduleCheckIn(actor: JwtPayload, dueInMinutes: number) {
    const ctx = assertFieldSession(actor);
    if (!ctx.agencyId) throw new ForbiddenException("Agency required");
    const dueAt = new Date(Date.now() + dueInMinutes * 60_000);
    await this.prisma.officerStatus.updateMany({
      where: { officerId: ctx.officerId },
      data: { metadata: { checkInDueAt: dueAt.toISOString() } },
    });
    return { data: { checkInDueAt: dueAt.toISOString() } };
  }

  async createAlert(actor: JwtPayload, dto: OfficerSafetyDto) {
    const ctx = assertFieldSession(actor);
    if (!ctx.agencyId) throw new ForbiddenException("Agency required");

    if (dto.clientActionId) {
      const dup = await this.prisma.fieldOfficerSafetyAlert.findUnique({ where: { clientActionId: dto.clientActionId } });
      if (dup) return { data: this.mapAlert(dup) };
    }

    const device = await this.prisma.fieldDevice.findUnique({ where: { id: ctx.fieldDeviceId } });
    if (device?.isRevoked || device?.isLost) {
      throw new ConflictException({ code: "FIELD-SYNC-005", message: "Device revoked" });
    }

    const alert = await this.prisma.fieldOfficerSafetyAlert.create({
      data: {
        officerId: ctx.officerId,
        fieldDeviceId: ctx.fieldDeviceId,
        agencyId: ctx.agencyId,
        alertType: dto.alertType,
        status: FieldOfficerSafetyAlertStatus.Active,
        latitude: decimalOrNull(dto.latitude ?? (device?.lastKnownLatitude != null ? Number(device.lastKnownLatitude) : undefined)),
        longitude: decimalOrNull(dto.longitude ?? (device?.lastKnownLongitude != null ? Number(device.lastKnownLongitude) : undefined)),
        batteryLevel: dto.batteryLevel ?? device?.batteryLevel ?? null,
        networkType: dto.networkType ?? device?.networkType ?? null,
        note: dto.note?.trim() || null,
        generationId: dto.generationId ?? null,
        clientActionId: dto.clientActionId ?? null,
      },
    });

    await this.prisma.officerStatus.updateMany({
      where: { officerId: ctx.officerId },
      data: { status: OfficerOperationalStatus.Panic, lastHeartbeatAt: new Date() },
    });

    await this.events.publish({
      agencyId: ctx.agencyId,
      officerId: ctx.officerId,
      fieldDeviceId: ctx.fieldDeviceId,
      eventType: FieldOperationalEventType.OfficerSafety,
      entityType: "field_officer_safety_alerts",
      entityId: alert.id,
      generationId: dto.generationId,
      payload: { alertType: alert.alertType, status: alert.status },
    });

    await this.audit.record({
      actor,
      action: "field.officer_safety.alert",
      entityType: "field_officer_safety_alerts",
      entityId: alert.id,
      metadata: { alertType: alert.alertType, priority: "P1" },
    });

    return { data: this.mapAlert(alert) };
  }

  mapAlert(alert: any) {
    return {
      id: alert.id,
      alertType: alert.alertType,
      status: alert.status,
      latitude: alert.latitude != null ? Number(alert.latitude) : null,
      longitude: alert.longitude != null ? Number(alert.longitude) : null,
      createdAt: alert.createdAt?.toISOString?.() ?? alert.createdAt,
    };
  }
}
