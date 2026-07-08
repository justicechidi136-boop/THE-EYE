import { IncidentPriority, IncidentType } from "@the-eye/shared";

export type CreateEscalationRuleDto = {
  name: string;
  incidentType?: IncidentType;
  priority?: IncidentPriority;
  jurisdictionId?: string;
  agencyId?: string;
  maxResponseTimeSeconds: number;
  escalationDestinationRole?: string;
  escalationDestinationAdminId?: string;
  escalationDestinationAgencyId?: string;
};

export type UpdateEscalationRuleDto = Partial<CreateEscalationRuleDto> & {
  isActive?: boolean;
};

export type RunEscalationCheckDto = {
  dryRun?: boolean;
};
