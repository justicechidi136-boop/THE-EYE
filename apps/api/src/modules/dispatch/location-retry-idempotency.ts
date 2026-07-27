export function buildIncidentLocationIdempotencyKey(incidentId: string, sequenceNumber = 0): string {
  return `${incidentId}:${sequenceNumber}`;
}

export function buildIncidentLocationRetryJobId(idempotencyKey: string): string {
  return `incident-location:${idempotencyKey}`;
}

export function resolveLocationRetryIdempotencyKey(payload: {
  idempotencyKey?: string;
  incidentId: string;
  dto: { sequenceNumber?: number };
}): string {
  return payload.idempotencyKey ?? buildIncidentLocationIdempotencyKey(payload.incidentId, payload.dto.sequenceNumber ?? 0);
}
