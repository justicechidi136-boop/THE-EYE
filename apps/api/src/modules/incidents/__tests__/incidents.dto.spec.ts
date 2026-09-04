import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { IncidentStatus } from "@the-eye/shared";
import { AssignIncidentDto, UpdateIncidentStatusDto } from "../incidents.controller";

describe("incident admin action DTO validation", () => {
  it("retains and validates a status action payload", async () => {
    const dto = plainToInstance(UpdateIncidentStatusDto, {
      status: IncidentStatus.Resolved,
      note: "Scene confirmed safe",
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.status).toBe(IncidentStatus.Resolved);
    expect(dto.note).toBe("Scene confirmed safe");
  });

  it("retains and validates an agency reassignment payload", async () => {
    const dto = plainToInstance(AssignIncidentDto, {
      agencyId: "22222222-2222-2222-2222-222222222223",
      reason: "Closer response unit",
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.agencyId).toBe("22222222-2222-2222-2222-222222222223");
    expect(dto.reason).toBe("Closer response unit");
  });

  it("rejects invalid status and agency identifiers", async () => {
    const statusErrors = await validate(plainToInstance(UpdateIncidentStatusDto, { status: "Unknown" }));
    const assignmentErrors = await validate(plainToInstance(AssignIncidentDto, { agencyId: "not-a-uuid", reason: "QA" }));

    expect(statusErrors.length).toBeGreaterThan(0);
    expect(assignmentErrors.length).toBeGreaterThan(0);
  });
});
