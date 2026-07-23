import { BadRequestException, Injectable } from "@nestjs/common";
import { EmergencyCategory, IncidentPriority, IncidentType } from "@the-eye/shared";
import { classifyEmergencyCategory } from "./emergency-category";
import { SosReportDto, validateSosReportDto } from "./dto/dispatch.dto";
import type { ReportIncidentDto } from "../incidents/dto/report-incident.dto";

export type EmergencyIndicatorMetadata = {
  activeThreat?: boolean;
  injuryIndicators?: string[];
  weaponIndicators?: boolean;
  medicalIndicators?: boolean;
  batteryLevel?: number;
  networkType?: string;
  deviceId?: string;
  capturedAt?: string;
  locationSource?: string;
  locationStatus?: string;
  isCached?: boolean;
  ageSeconds?: number;
};

@Injectable()
export class EmergencyClassificationService {
  validateSosReport(dto: SosReportDto) {
    validateSosReportDto(dto);
  }

  classifySosReport(dto: SosReportDto) {
    this.validateSosReport(dto);
    const silent = dto.silent === true || dto.emergencyCategory === EmergencyCategory.SilentSos;
    const classified = classifyEmergencyCategory(dto.emergencyCategory, silent);
    return {
      ...classified,
      description: dto.description?.trim() || classified.title,
      indicators: this.buildIndicatorMetadata(dto),
    };
  }

  toReportIncidentDto(dto: SosReportDto): ReportIncidentDto {
    const classified = this.classifySosReport(dto);
    return {
      type: classified.incidentType,
      priority: classified.priority,
      title: classified.title,
      description: classified.description,
      latitude: dto.latitude,
      longitude: dto.longitude,
      manualLatitude: dto.manualLatitude,
      manualLongitude: dto.manualLongitude,
      manualAddress: dto.manualAddress,
      address: dto.address,
      anonymous: dto.anonymous,
      notifyEmergencyContacts: silentSafeNotify(dto, classified.silent),
      emergencyContactIds: dto.emergencyContactIds,
      clientSubmissionId: dto.clientSubmissionId,
      occurredAt: dto.occurredAt,
    };
  }

  buildIncidentMetadata(dto: SosReportDto, classified: ReturnType<typeof classifyEmergencyCategory>) {
    return {
      intake: "sos_classification",
      emergencyCategory: classified.category,
      silent: classified.silent,
      suggestedAgencyTypes: classified.suggestedAgencyTypes,
      ...this.buildIndicatorMetadata(dto),
    };
  }

  private buildIndicatorMetadata(dto: SosReportDto): EmergencyIndicatorMetadata {
    return {
      activeThreat: dto.activeThreat,
      injuryIndicators: dto.injuryIndicators,
      weaponIndicators: dto.weaponIndicators,
      medicalIndicators: dto.medicalIndicators,
      batteryLevel: dto.batteryLevel,
      networkType: dto.networkType,
      deviceId: dto.deviceId,
      capturedAt: dto.capturedAt,
      locationSource: dto.locationSource,
      locationStatus: dto.locationStatus,
      isCached: dto.isCached,
      ageSeconds: dto.ageSeconds,
    };
  }
}

function silentSafeNotify(dto: SosReportDto, silent: boolean) {
  if (silent) return false;
  return dto.notifyEmergencyContacts ?? false;
}

export function mapIncidentTypeToCategory(type: IncidentType): EmergencyCategory {
  switch (type) {
    case IncidentType.Crime:
    case IncidentType.SuspiciousActivity:
      return EmergencyCategory.SecurityCrime;
    case IncidentType.Medical:
      return EmergencyCategory.Medical;
    case IncidentType.Fire:
      return EmergencyCategory.Fire;
    case IncidentType.Accident:
      return EmergencyCategory.RoadTraffic;
    case IncidentType.Abuse:
      return EmergencyCategory.DomesticViolence;
    case IncidentType.Kidnapping:
      return EmergencyCategory.Kidnapping;
    case IncidentType.MissingPerson:
      return EmergencyCategory.MissingPerson;
    case IncidentType.SOS:
      return EmergencyCategory.SilentSos;
    case IncidentType.Emergency:
      return EmergencyCategory.NaturalDisaster;
    default:
      return EmergencyCategory.Other;
  }
}

export function assertValidEmergencyCategory(value: unknown): EmergencyCategory {
  if (typeof value !== "string" || !Object.values(EmergencyCategory).includes(value as EmergencyCategory)) {
    throw new BadRequestException("Unsupported emergency category");
  }
  return value as EmergencyCategory;
}
