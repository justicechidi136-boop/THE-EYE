import { resolveAndroidAssetLinks } from "../../../lib/android-app-links";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return Response.json(resolveAndroidAssetLinks(), {
      headers: { "cache-control": "public, max-age=3600" },
    });
  } catch {
    return Response.json([], {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
