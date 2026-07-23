export type RateLimitPolicyName =
  | "auth"
  | "sos"
  | "incidentCreate"
  | "broadcastCreate"
  | "liveStreamCreate"
  | "communityPostCreate"
  | "policeSearch";

export type RateLimitActorRole = "anonymous" | "user" | "admin";

export type RateLimitPolicy = {
  windowSeconds: number;
  ipLimit: number;
  roleLimits: Partial<Record<RateLimitActorRole, number>>;
};

export const RATE_LIMIT_POLICIES: Record<RateLimitPolicyName, RateLimitPolicy> = {
  auth: {
    windowSeconds: 60,
    ipLimit: 15,
    roleLimits: { anonymous: 10, user: 20, admin: 40 },
  },
  sos: {
    windowSeconds: 60,
    ipLimit: 6,
    roleLimits: { anonymous: 3, user: 8, admin: 15 },
  },
  incidentCreate: {
    windowSeconds: 300,
    ipLimit: 25,
    roleLimits: { anonymous: 5, user: 20, admin: 60 },
  },
  broadcastCreate: {
    windowSeconds: 300,
    ipLimit: 12,
    roleLimits: { admin: 40 },
  },
  liveStreamCreate: {
    windowSeconds: 300,
    ipLimit: 10,
    roleLimits: { user: 8, admin: 25 },
  },
  communityPostCreate: {
    windowSeconds: 300,
    ipLimit: 20,
    roleLimits: { user: 15, admin: 40 },
  },
  policeSearch: {
    windowSeconds: 60,
    ipLimit: 30,
    roleLimits: { anonymous: 20, user: 40, admin: 80 },
  },
};

export type RateLimitCheckResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
  dimension: "ip" | "actor";
};
