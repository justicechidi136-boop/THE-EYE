import { Prisma } from "@prisma/client";
import { installJsonSafePrototypes, toJsonSafe } from "../json-safe";

describe("toJsonSafe", () => {
  it("converts BigInt, Decimal, and Date values recursively", () => {
    const payload = {
      sequence: 42n,
      score: new Prisma.Decimal("91.50"),
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
      nested: { sizeBytes: 2048n, items: [1n, new Prisma.Decimal(3)] },
    };

    const safe = toJsonSafe(payload);

    expect(safe).toEqual({
      sequence: "42",
      score: "91.5",
      createdAt: "2026-07-20T12:00:00.000Z",
      nested: { sizeBytes: "2048", items: ["1", "3"] },
    });
    expect(() => JSON.stringify(safe)).not.toThrow();
  });

  it("installs BigInt toJSON so raw stringify succeeds", () => {
    installJsonSafePrototypes();
    expect(() => JSON.stringify({ sequence: 7n })).not.toThrow();
    expect(JSON.stringify({ sequence: 7n })).toContain('"7"');
  });
});
