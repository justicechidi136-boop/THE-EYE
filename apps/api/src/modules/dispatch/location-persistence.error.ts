export function isIncidentLocationPersistenceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : null;
  return (
    /incidentLocationUpdate\.create/i.test(message) ||
    /createOne.*IncidentLocationUpdate/i.test(message) ||
    /does not match any query/i.test(message) ||
    code === "P2021" ||
    /incident_location_updates/i.test(message)
  );
}
