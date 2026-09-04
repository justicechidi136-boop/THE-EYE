export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export type CursorPageQuery = {
  cursor?: string;
  limit?: string | number;
  page?: string | number;
};

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type DateIdCursor = {
  createdAt: string;
  id: string;
};

export type SequenceCursor = {
  sequence: string;
};

export function resolvePageLimit(raw?: string | number, fallback = DEFAULT_PAGE_LIMIT) {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_PAGE_LIMIT);
}

export function encodeDateIdCursor(createdAt: Date | string, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: new Date(createdAt).toISOString(), id }), "utf8").toString("base64url");
}

export function decodeDateIdCursor(cursor?: string): DateIdCursor | null {
  if (!cursor?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as DateIdCursor;
    if (!parsed?.createdAt || !parsed?.id) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt: createdAt.toISOString(), id: String(parsed.id) };
  } catch {
    return null;
  }
}

export function dateIdCursorWhere(cursor: DateIdCursor | null) {
  if (!cursor) return {};
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
  };
}

export function encodeSequenceCursor(sequence: bigint | number | string) {
  return Buffer.from(JSON.stringify({ sequence: String(sequence) }), "utf8").toString("base64url");
}

export function decodeSequenceCursor(cursor?: string): SequenceCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as SequenceCursor;
    if (!parsed?.sequence) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sequenceCursorWhere(cursor: SequenceCursor | null) {
  if (!cursor) return {};
  return { sequence: { lt: BigInt(cursor.sequence) } };
}

export function buildCursorPage<T>(rows: T[], limit: number, encodeCursor: (item: T) => string): CursorPage<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && data.length ? encodeCursor(data[data.length - 1]!) : null;
  return { data, nextCursor, hasMore, limit };
}
