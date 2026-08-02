import {
  incidentIsSilent,
  incidentSlaTone,
  priorityShort,
  priorityTone,
  workloadSummary,
} from "../dispatch/console-utils";
import type { DispatchIncident, DispatchResponder } from "../api/dispatch";

const sampleIncident = (overrides: Partial<DispatchIncident> = {}): DispatchIncident => ({
  id: "inc-1",
  title: "Robbery in progress",
  status: "Verified",
  priority: "P1LifeThreatening",
  type: "Crime",
  latitude: 6.5,
  longitude: 3.4,
  country: "Nigeria",
  state: "Lagos",
  lga: "Ikeja",
  submittedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  liveLocationStale: false,
  ...overrides,
});

describe("dispatch console utils", () => {
  it("detects silent SOS incidents", () => {
    expect(incidentIsSilent(sampleIncident({ metadata: { silent: true } }))).toBe(true);
    expect(incidentIsSilent(sampleIncident({ metadata: { emergencyCategory: "SilentSos" } }))).toBe(true);
    expect(incidentIsSilent(sampleIncident())).toBe(false);
  });

  it("summarizes agency workload", () => {
    const summary = workloadSummary(
      [
        sampleIncident({ status: "Verified", assignedAgencyId: null }),
        sampleIncident({ id: "inc-2", status: "Assigned", assignedAgencyId: "agency-1" }),
        sampleIncident({ id: "inc-3", status: "Responding", assignedAgencyId: "agency-1", liveLocationStale: true }),
      ],
      [
        { id: "r1", displayName: "A", availability: "Available", agencyId: "agency-1" },
        { id: "r2", displayName: "B", availability: "Busy", agencyId: "agency-1" },
      ] as DispatchResponder[],
    );
    expect(summary.unassigned).toBe(1);
    expect(summary.assigned).toBe(1);
    expect(summary.responding).toBe(1);
    expect(summary.stale).toBe(1);
    expect(summary.availableResponders).toBe(1);
  });

  it("maps priority labels and tones", () => {
    expect(priorityShort("P2ActiveCrimeAccident")).toBe("P2");
    expect(priorityTone("P1LifeThreatening")).toBe("danger");
    expect(incidentSlaTone(sampleIncident({ liveLocationStale: true }))).toBe("warning");
  });
});
