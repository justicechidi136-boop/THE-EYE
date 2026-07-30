export const POLICY_SECTIONS = [
  "community",
  "permissions",
  "notifications",
  "broadcasts",
  "verification",
  "patrols",
  "volunteers",
  "smartwatch",
  "integrations",
] as const;

export type PolicySection = (typeof POLICY_SECTIONS)[number];

export type PolicyScope = "platform" | "jurisdiction" | "community";

export function buildPlatformScopeKey() {
  return "platform";
}

export function buildJurisdictionScopeKey(country: string, state: string, lga: string) {
  return `jurisdiction:${country}|${state}|${lga}`;
}

export function buildCommunityScopeKey(communityId: string) {
  return `community:${communityId}`;
}

export const DEFAULT_POLICY_CONFIG: Record<PolicySection, Record<string, unknown>> = {
  community: {
    defaultVisibility: "Public",
    membershipRequiresApproval: true,
    maxHierarchyDepth: 4,
  },
  permissions: {
    moderatorCanBan: true,
    moderatorCanAssignRoles: true,
    allowVolunteerEscalation: true,
  },
  notifications: {
    criticalIncidentPush: true,
    broadcastApprovalPush: true,
    liveVideoAlertPush: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "06:00",
  },
  broadcasts: {
    autoApproveP1Emergency: true,
    approvalRequiredTypes: ["Emergency", "MissingPerson", "StolenVehicle"],
    defaultRadiusMeters: 5000,
    minApprovers: 1,
  },
  verification: {
    autoVerifyThreshold: 85,
    manualReviewThreshold: 70,
    falseReportThreshold: 40,
    requireWitnessCount: 2,
  },
  patrols: {
    minCheckpoints: 2,
    maxPatrolDurationHours: 8,
    requireGpsCheckIn: true,
  },
  volunteers: {
    requireKyc: true,
    minTrustScore: 60,
    maxActivePatrols: 3,
  },
  smartwatch: {
    defaultSosTtlMinutes: 30,
    pairingSessionTtlMinutes: 15,
    allowStandaloneMode: true,
  },
  integrations: {
    smsProvider: "termii",
    gisWebhookUrl: "",
    webhookEnabled: false,
  },
};

export function mergePolicyConfig(section: PolicySection, stored?: Record<string, unknown> | null) {
  return { ...DEFAULT_POLICY_CONFIG[section], ...(stored ?? {}) };
}

export function isPolicySection(value: string): value is PolicySection {
  return (POLICY_SECTIONS as readonly string[]).includes(value);
}
