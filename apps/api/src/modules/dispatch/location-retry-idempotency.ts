import { buildBullJobId } from "../../common/queue/bull-job-id";

export function buildIncidentLocationIdempotencyKey(incidentId: string, sequenceNumber = 0): string {
  return `${incidentId}:${sequenceNumber}`;
}

export function buildIncidentLocationRetryJobId(idempotencyKey: string): string {
  const [incidentId, sequenceNumber = "0"] = idempotencyKey.includes(":")
    ? idempotencyKey.split(":", 2)
    : [idempotencyKey, "0"];
  return buildBullJobId("incident-location", incidentId, sequenceNumber);
}

export function resolveLocationRetryIdempotencyKey(payload: {
  idempotencyKey?: string;
  incidentId: string;
  dto: { sequenceNumber?: number };
}): string {
  return payload.idempotencyKey ?? buildIncidentLocationIdempotencyKey(payload.incidentId, payload.dto.sequenceNumber ?? 0);
}
