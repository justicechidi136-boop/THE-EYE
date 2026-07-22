import { buildSlaTimerState, DISPATCH_SLA_SECONDS } from "../sla-policy";

describe("buildSlaTimerState", () => {
  it("marks triage breach when triage deadline elapsed", () => {
    const submittedAt = new Date("2026-07-22T10:00:00.000Z");
    const now = new Date(submittedAt.getTime() + (DISPATCH_SLA_SECONDS.triage + 10) * 1000);
    const state = buildSlaTimerState({ submittedAt, now });
    expect(state.triageBreached).toBe(true);
    expect(state.assignmentBreached).toBe(false);
  });

  it("computes acceptance breach from assignment timestamp", () => {
    const submittedAt = new Date("2026-07-22T10:00:00.000Z");
    const assignedAt = new Date("2026-07-22T10:04:00.000Z");
    const now = new Date(assignedAt.getTime() + (DISPATCH_SLA_SECONDS.acceptance + 5) * 1000);
    const state = buildSlaTimerState({ submittedAt, assignedAt, now });
    expect(state.acceptanceBreached).toBe(true);
    expect(state.acceptanceDeadlineAt).toBe(
      new Date(assignedAt.getTime() + DISPATCH_SLA_SECONDS.acceptance * 1000).toISOString(),
    );
  });
});
