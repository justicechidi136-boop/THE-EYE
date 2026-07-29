import {
  buildCursorPage,
  dateIdCursorWhere,
  decodeDateIdCursor,
  encodeDateIdCursor,
  resolvePageLimit,
  type CursorPage,
  type CursorPageQuery,
} from "../cursor-pagination";

describe("cursor pagination", () => {
  it("resolves and caps page limits", () => {
    expect(resolvePageLimit(undefined, 50)).toBe(50);
    expect(resolvePageLimit("25")).toBe(25);
    expect(resolvePageLimit("500")).toBe(100);
    expect(resolvePageLimit("0")).toBe(50);
  });

  it("encodes and decodes date/id cursors", () => {
    const encoded = encodeDateIdCursor("2026-07-09T12:00:00.000Z", "abc-123");
    expect(decodeDateIdCursor(encoded)).toEqual({
      createdAt: "2026-07-09T12:00:00.000Z",
      id: "abc-123",
    });
  });

  it("decodes legacy incident cursors that included priority", () => {
    const legacy = Buffer.from(
      JSON.stringify({
        priority: "P1LifeThreatening",
        createdAt: "2026-07-09T12:00:00.000Z",
        id: "abc-123",
      }),
      "utf8",
    ).toString("base64url");
    expect(decodeDateIdCursor(legacy)).toEqual({
      createdAt: "2026-07-09T12:00:00.000Z",
      id: "abc-123",
    });
  });

  it("rejects malformed or invalid date/id cursors", () => {
    expect(decodeDateIdCursor("not-a-cursor")).toEqual(null);
    expect(decodeDateIdCursor("")).toEqual(null);
    expect(decodeDateIdCursor(undefined)).toEqual(null);
    const invalidDate = Buffer.from(JSON.stringify({ createdAt: "not-a-date", id: "abc" }), "utf8").toString("base64url");
    expect(decodeDateIdCursor(invalidDate)).toEqual(null);
    const missingId = Buffer.from(JSON.stringify({ createdAt: "2026-07-09T12:00:00.000Z" }), "utf8").toString("base64url");
    expect(decodeDateIdCursor(missingId)).toEqual(null);
  });

  it("builds cursor page metadata", () => {
    const rows = [
      { id: "1", createdAt: new Date("2026-07-09T12:00:00.000Z") },
      { id: "2", createdAt: new Date("2026-07-09T11:00:00.000Z") },
      { id: "3", createdAt: new Date("2026-07-09T10:00:00.000Z") },
    ];
    const page = buildCursorPage(rows, 2, (item) => encodeDateIdCursor(item.createdAt, item.id));
    expect(page.data).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.limit).toBe(2);
    expect(decodeDateIdCursor(page.nextCursor!)).toEqual({
      createdAt: "2026-07-09T11:00:00.000Z",
      id: "2",
    });
  });

  it("applies date/id keyset filters after the cursor", () => {
    const where = dateIdCursorWhere({
      createdAt: "2026-07-09T12:00:00.000Z",
      id: "cursor-id",
    });
    expect(where).toEqual({
      OR: [
        { createdAt: { lt: new Date("2026-07-09T12:00:00.000Z") } },
        { createdAt: new Date("2026-07-09T12:00:00.000Z"), id: { lt: "cursor-id" } },
      ],
    });
  });

  it("paginates deterministically when rows share the same createdAt", () => {
    const sharedCreatedAt = new Date("2026-07-09T12:00:00.000Z");
    const rows = [
      { id: "c", createdAt: sharedCreatedAt },
      { id: "b", createdAt: sharedCreatedAt },
      { id: "a", createdAt: sharedCreatedAt },
      { id: "9", createdAt: new Date("2026-07-09T11:00:00.000Z") },
    ];

    const firstPage = buildCursorPage(rows, 2, (item) => encodeDateIdCursor(item.createdAt, item.id));
    expect(firstPage.data.map((row) => row.id)).toEqual(["c", "b"]);
    expect(firstPage.hasMore).toBe(true);

    const cursor = decodeDateIdCursor(firstPage.nextCursor);
    const remaining = rows.filter((row) => {
      const where = dateIdCursorWhere(cursor);
      const createdAt = row.createdAt;
      const id = row.id;
      const or = (where as { OR: Array<Record<string, unknown>> }).OR;
      return or.some((clause) => {
        if ("createdAt" in clause && "lt" in (clause.createdAt as object)) {
          return createdAt < (clause.createdAt as { lt: Date }).lt;
        }
        if ("createdAt" in clause && "id" in clause) {
          return (
            createdAt.getTime() === (clause.createdAt as Date).getTime() &&
            id < String((clause.id as { lt: string }).lt)
          );
        }
        return false;
      });
    });

    const secondPage = buildCursorPage(remaining, 2, (item) => encodeDateIdCursor(item.createdAt, item.id));
    expect(secondPage.data.map((row) => row.id)).toEqual(["a", "9"]);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.nextCursor).toEqual(null);
  });

  it("returns an empty page when no rows are available", () => {
    const page: CursorPage<{ id: string }> = buildCursorPage([], 50, (item) => item.id);
    expect(page).toEqual({ data: [], nextCursor: null, hasMore: false, limit: 50 });
  });
});
