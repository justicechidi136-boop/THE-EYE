export const LiveVideoErrorCode = {
  INCIDENT_UNAVAILABLE: "LIVE-VIDEO-001",
  NOT_AUTHORIZED: "LIVE-VIDEO-002",
  LOCATION_PERSIST_DEGRADED: "LIVE-VIDEO-005",
  TOKEN_GENERATION_FAILED: "LIVE-VIDEO-006",
  SESSION_PERSIST_FAILED: "LIVE-VIDEO-007",
  LIVEKIT_CONFIG_UNAVAILABLE: "LIVE-VIDEO-008",
  UPSTREAM_GATEWAY: "LIVE-VIDEO-009",
  CLIENT_LIVEKIT_URL_INVALID: "LIVE-VIDEO-010",
  UNEXPECTED: "LIVE-VIDEO-011",
  CLIENT_JOIN_FAILED: "LIVE-VIDEO-015",
  TOKEN_CONNECTION_INCOMPLETE: "LIVE-VIDEO-TOKEN-001",
} as const;

export type LiveVideoErrorCodeValue =
  (typeof LiveVideoErrorCode)[keyof typeof LiveVideoErrorCode];

export function liveVideoErrorBody(
  code: LiveVideoErrorCodeValue,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>,
) {
  return {
    code,
    message,
    ...(requestId ? { requestId } : {}),
    ...(details ? { details } : {}),
  };
}
