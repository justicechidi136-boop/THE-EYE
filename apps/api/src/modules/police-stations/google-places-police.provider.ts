import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { GooglePlacesPoliceResult } from "./police-station.types";

type CacheEntry = {
  expiresAt: number;
  results: GooglePlacesPoliceResult[];
};

const PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.nationalPhoneNumber",
  "places.businessStatus",
].join(",");

@Injectable()
export class GooglePlacesPoliceProvider {
  private readonly logger = new Logger(GooglePlacesPoliceProvider.name);
  private readonly cache = new Map<string, CacheEntry>();
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>("GOOGLE_PLACES_ENABLED") === "true"
      && Boolean(this.config.get<string>("GOOGLE_PLACES_API_KEY"));
  }

  async searchNearby(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    limit: number;
    search?: string;
  }): Promise<{ results: GooglePlacesPoliceResult[]; status: "disabled" | "ok" | "failed" }> {
    if (!this.isEnabled()) return { results: [], status: "disabled" };
    if (Date.now() < this.circuitOpenUntil) return { results: [], status: "failed" };

    const cacheKey = this.cacheKey(params);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { results: cached.results.slice(0, params.limit), status: "ok" };
    }

    try {
      const results = params.search?.trim()
        ? await this.textSearch(params)
        : await this.nearbySearch(params);
      this.consecutiveFailures = 0;
      this.cache.set(cacheKey, {
        results,
        expiresAt: Date.now() + this.cacheTtlMs(),
      });
      return { results: results.slice(0, params.limit), status: "ok" };
    } catch (error) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= 3) {
        this.circuitOpenUntil = Date.now() + 60_000;
        this.logger.warn("Google Places circuit opened after repeated failures");
      }
      this.logger.warn(`Google Places lookup failed: ${error instanceof Error ? error.message : "unknown"}`);
      return { results: [], status: "failed" };
    }
  }

  private async nearbySearch(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    limit: number;
  }): Promise<GooglePlacesPoliceResult[]> {
    const body = {
      includedTypes: ["police"],
      maxResultCount: Math.min(params.limit, this.maxResults()),
      locationRestriction: {
        circle: {
          center: { latitude: params.latitude, longitude: params.longitude },
          radius: params.radiusMeters,
        },
      },
      regionCode: this.regionCode(),
      rankPreference: "DISTANCE",
    };
    const response = await this.postPlaces("places:searchNearby", body);
    return this.mapPlaces(response?.places ?? []);
  }

  private async textSearch(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    limit: number;
    search?: string;
  }): Promise<GooglePlacesPoliceResult[]> {
    const body = {
      textQuery: `${params.search?.trim()} police station`,
      maxResultCount: Math.min(params.limit, this.maxResults()),
      locationBias: {
        circle: {
          center: { latitude: params.latitude, longitude: params.longitude },
          radius: params.radiusMeters,
        },
      },
      regionCode: this.regionCode(),
      includedType: "police",
      rankPreference: "DISTANCE",
    };
    const response = await this.postPlaces("places:searchText", body);
    return this.mapPlaces(response?.places ?? []);
  }

  private async postPlaces(path: string, body: Record<string, unknown>) {
    const apiKey = this.config.get<string>("GOOGLE_PLACES_API_KEY");
    if (!apiKey) throw new Error("Google Places API key is not configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": PLACES_FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Google Places HTTP ${response.status}`);
      }
      return await response.json() as { places?: Array<Record<string, unknown>> };
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapPlaces(places: Array<Record<string, unknown>>): GooglePlacesPoliceResult[] {
    return places
      .map((place) => {
        const placeId = String(place.id ?? "").replace(/^places\//, "");
        const location = place.location as { latitude?: number; longitude?: number } | undefined;
        const latitude = Number(location?.latitude);
        const longitude = Number(location?.longitude);
        if (!placeId || Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
        const displayName = place.displayName as { text?: string } | undefined;
        const name = displayName?.text?.trim() || "Police station";
        const address = String(place.formattedAddress ?? "").trim() || name;
        const googleMapsUri = String(place.googleMapsUri ?? "").trim();
        return {
          placeId,
          name,
          address,
          latitude,
          longitude,
          phone: (place.nationalPhoneNumber as string | undefined)?.trim() || null,
          navigationUrl: googleMapsUri || this.placeNavigationUrl(placeId, latitude, longitude),
          businessStatus: (place.businessStatus as string | undefined) ?? null,
          attribution: "Powered by Google",
        } satisfies GooglePlacesPoliceResult;
      })
      .filter((row): row is GooglePlacesPoliceResult => row !== null);
  }

  placeNavigationUrl(placeId: string, latitude: number, longitude: number) {
    if (placeId) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}&query_place_id=${encodeURIComponent(placeId)}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  }

  private cacheKey(params: { latitude: number; longitude: number; radiusMeters: number; search?: string }) {
    const lat = params.latitude.toFixed(3);
    const lng = params.longitude.toFixed(3);
    const radius = Math.round(params.radiusMeters / 100) * 100;
    const search = (params.search ?? "").trim().toLowerCase();
    return `${lat}:${lng}:${radius}:${search}`;
  }

  private regionCode() {
    return this.config.get<string>("GOOGLE_PLACES_REGION") ?? "NG";
  }

  private maxResults() {
    return Number(this.config.get<string>("GOOGLE_PLACES_MAX_RESULTS") ?? 10);
  }

  private cacheTtlMs() {
    return Number(this.config.get<string>("GOOGLE_PLACES_CACHE_TTL_SECONDS") ?? 900) * 1000;
  }

  private timeoutMs() {
    return Number(this.config.get<string>("GOOGLE_PLACES_TIMEOUT_MS") ?? 4000);
  }
}
