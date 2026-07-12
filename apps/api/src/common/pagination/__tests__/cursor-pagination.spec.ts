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

  it("returns an empty page when no rows are available", () => {
    const page: CursorPage<{ id: string }> = buildCursorPage([], 50, (item) => item.id);
    expect(page).toEqual({ data: [], nextCursor: null, hasMore: false, limit: 50 });
  });
});
