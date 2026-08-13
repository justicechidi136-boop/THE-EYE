/**
 * Deterministic Dynamic Public Area identity.
 * Never use raw lat/lng as a public identifier.
 */

export type DynamicAreaGeo = {
  /** Normalized token for keys / client codes */
  countryCode: string;
  stateCode: string | null;
  lgaCode: string | null;
  /** Original jurisdiction labels for admin scope + display */
  country: string;
  state: string | null;
  lga: string | null;
  city: string | null;
  areaLabel: string;
  areaKey: string;
  resolutionSource: string;
};

export type NwContextType =
  | "MAPPED_PUBLIC_COMMUNITY"
  | "DYNAMIC_PUBLIC_AREA"
  | "LOCATION_REQUIRED"
  | "LOCATION_STALE"
  | "LOCATION_LOW_ACCURACY";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Normalize geography tokens for stable keys (no spaces / punctuation). */
export function normalizeGeoToken(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
}

/**
 * Encode a ~±2.4km cell (precision 5) when LGA polygons are unavailable.
 * Used only as a last-resort geographic bucket — not for public display of exact GPS.
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 5): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let geohash = "";

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude >= lonMid) {
        idx = (idx << 1) + 1;
        lonMin = lonMid;
      } else {
        idx <<= 1;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude >= latMid) {
        idx = (idx << 1) + 1;
        latMin = latMid;
      } else {
        idx <<= 1;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

export function buildDynamicAreaFromJurisdiction(input: {
  country: string;
  state?: string | null;
  lga?: string | null;
  city?: string | null;
  resolutionSource: string;
}): DynamicAreaGeo {
  const country = input.country.trim();
  const state = input.state?.trim() || null;
  const lga = input.lga?.trim() || null;
  const countryCode = normalizeGeoToken(country) ?? "XX";
  const stateCode = normalizeGeoToken(state);
  const lgaCode = normalizeGeoToken(lga);
  const city = input.city?.trim() || null;
  const parts = [lga, state, country].filter((p) => p && String(p).trim());
  const areaLabel =
    parts.length > 0
      ? parts.map((p) => String(p).trim()).join(", ")
      : city?.trim() || "Current Area";

  const keyParts = ["da", countryCode, stateCode ?? "UNK", lgaCode ?? "UNK"];
  return {
    countryCode,
    stateCode,
    lgaCode,
    country,
    state,
    lga,
    city,
    areaLabel,
    areaKey: keyParts.join(":"),
    resolutionSource: input.resolutionSource,
  };
}

export function buildDynamicAreaGeohashFallback(
  latitude: number,
  longitude: number,
  city?: string | null,
): DynamicAreaGeo {
  const gh = encodeGeohash(latitude, longitude, 5);
  return {
    countryCode: "XX",
    stateCode: null,
    lgaCode: null,
    country: "Unknown",
    state: null,
    lga: null,
    city: city?.trim() || null,
    areaLabel: city?.trim() || "Current Area",
    areaKey: `da:gh:${gh}`,
    resolutionSource: "geohash_cell",
  };
}

/** Public-safe approximate location label (never household GPS). */
export function publicAreaDisplayLabel(area: Pick<DynamicAreaGeo, "areaLabel" | "city" | "lgaCode">): string {
  if (area.city?.trim()) return `${area.city.trim()} area`;
  if (area.areaLabel && area.areaLabel !== "Current Area") return area.areaLabel;
  return "Current area";
}
