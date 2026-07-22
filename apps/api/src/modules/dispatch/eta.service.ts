import { Injectable } from "@nestjs/common";
import { haversineMeters } from "./agency-routing.service";

export type DistanceResult = {
  distanceMeters: number;
  distanceSource: "postgis" | "haversine";
  navigationUrl: string;
  etaSeconds: number | null;
  etaSource: "road-provider" | "unavailable";
  etaLabel: string;
};

@Injectable()
export class EtaService {
  async distanceBetween(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    queryPostgis?: () => Promise<number | null>,
  ): Promise<DistanceResult> {
    let distanceMeters = haversineMeters(fromLat, fromLng, toLat, toLng);
    let distanceSource: DistanceResult["distanceSource"] = "haversine";

    if (queryPostgis) {
      try {
        const postgisDistance = await queryPostgis();
        if (postgisDistance !== null && Number.isFinite(postgisDistance)) {
          distanceMeters = postgisDistance;
          distanceSource = "postgis";
        }
      } catch {
        // keep haversine fallback
      }
    }

    const roadProviderConfigured = Boolean(process.env.ROAD_ROUTING_PROVIDER_URL?.trim());
    return {
      distanceMeters,
      distanceSource,
      navigationUrl: this.googleMapsNavigationUrl(toLat, toLng),
      etaSeconds: null,
      etaSource: roadProviderConfigured ? "road-provider" : "unavailable",
      etaLabel: roadProviderConfigured
        ? "Road ETA provider configured but not integrated in Sprint 6"
        : "Straight-line distance only; road ETA unavailable",
    };
  }

  googleMapsNavigationUrl(latitude: number, longitude: number) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
}
