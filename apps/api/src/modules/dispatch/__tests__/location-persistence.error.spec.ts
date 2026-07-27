import { BadRequestException } from "@nestjs/common";
import { isIncidentLocationPersistenceError } from "../location-persistence.error";

describe("isIncidentLocationPersistenceError", () => {
  it("detects createOne mismatch errors", () => {
    expect(
      isIncidentLocationPersistenceError(
        new Error(
          "Invalid `prisma.incidentLocationUpdate.create()` invocation: Operation 'createOne' for model 'IncidentLocationUpdate' does not match any query.",
        ),
      ),
    ).toBe(true);
  });

  it("detects missing table errors", () => {
    expect(isIncidentLocationPersistenceError({ code: "P2021", message: "table missing" })).toBe(true);
  });

  it("ignores validation errors", () => {
    expect(isIncidentLocationPersistenceError(new BadRequestException("bad coords"))).toBe(false);
  });
});
