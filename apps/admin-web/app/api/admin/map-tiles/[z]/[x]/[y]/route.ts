import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ z: string; x: string; y: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const raw = await params;
  const z = Number(raw.z);
  const x = Number(raw.x);
  const y = Number(raw.y);
  const tileCount = 2 ** z;
  const valid = [z, x, y].every(Number.isSafeInteger)
    && z >= 0
    && z <= 19
    && x >= 0
    && y >= 0
    && x < tileCount
    && y < tileCount;

  if (!valid) {
    return NextResponse.json({ message: "Invalid map tile coordinates" }, { status: 400 });
  }

  const response = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
    headers: { "User-Agent": "THE-EYE-Admin/1.0 (staging map rendering)" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) {
    return NextResponse.json({ message: "Map tile is temporarily unavailable" }, { status: 502 });
  }

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": "image/png",
    },
  });
}
