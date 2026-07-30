/** Canonical lifecycle states for danger-zone alerts. */
export const DangerAlertLifecycleState = {
  ACTIVE: "ACTIVE",
  UPDATED: "UPDATED",
  ESCALATED: "ESCALATED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  CLEARED: "CLEARED",
  EXPIRED: "EXPIRED",
} as const;

export type DangerAlertLifecycleStateValue =
  (typeof DangerAlertLifecycleState)[keyof typeof DangerAlertLifecycleState];

/** Build a stable alertId (no colon characters) for BullMQ / Redis / filenames. */
export function buildCanonicalAlertId(
  zoneId: string,
  userId: string,
  deviceId?: string | null,
): string {
  const device = (deviceId ?? "mobile").replace(/:/g, "-");
  return `alert-${zoneId}-${userId}-${device}`.replace(/:/g, "-");
}

export function mapProximityToLifecycleState(input: {
  allClear?: boolean;
  alertState?: string;
  version: number;
}): DangerAlertLifecycleStateValue {
  if (input.allClear) return DangerAlertLifecycleState.CLEARED;
  if (input.version <= 1) return DangerAlertLifecycleState.ACTIVE;
  if (input.alertState === "Critical" || input.alertState === "InsideDangerZone") {
    return DangerAlertLifecycleState.ESCALATED;
  }
  return DangerAlertLifecycleState.UPDATED;
}

export function isTerminalLifecycleState(state: DangerAlertLifecycleStateValue): boolean {
  return (
    state === DangerAlertLifecycleState.CLEARED ||
    state === DangerAlertLifecycleState.EXPIRED ||
    state === DangerAlertLifecycleState.ACKNOWLEDGED
  );
}
