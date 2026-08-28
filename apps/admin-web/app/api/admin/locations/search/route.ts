import { NextResponse } from "next/server";
import { getAccessToken } from "../../../../../lib/session";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export async function GET(request: Request) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ message: "Enter at least 3 characters" }, { status: 400 });

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "ng",
    limit: "5",
    "accept-language": "en",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "THE-EYE-Admin/1.0 (location search)" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return NextResponse.json({ message: "Location search is temporarily unavailable" }, { status: 502 });

  const rows = (await response.json()) as NominatimResult[];
  const results = rows.flatMap((row) => {
    const latitude = Number(row.lat);
    const longitude = Number(row.lon);
    if (!row.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ label: row.display_name, latitude, longitude }];
  });
  return NextResponse.json({ data: results });
}
