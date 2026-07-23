import { BadRequestException } from "@nestjs/common";
import { GooglePlacesPoliceProvider } from "../google-places-police.provider";
import { PoliceLocatorService } from "../police-locator.service";

describe("PoliceLocatorService", () => {
  const prisma = {
    $queryRawUnsafe: jest.fn(),
    googlePlaceReference: { upsert: jest.fn() },
    policeStation: { findUnique: jest.fn(), update: jest.fn() },
  };
  const audit = { record: jest.fn() };
  const googlePlaces = {
    isEnabled: jest.fn(),
    searchNearby: jest.fn(),
    placeNavigationUrl: jest.fn((placeId: string, lat: number, lng: number) =>
      `https://maps.example/${placeId}?${lat},${lng}`),
  };

  const service = new PoliceLocatorService(prisma as never, googlePlaces as never, audit as never);

  it("returns verified database stations first", async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: "station-1",
        name: "Ikeja Central Police Station",
        address: "Ikeja, Lagos",
        agency_type: "police",
        station_type: "police",
        latitude: 6.6018,
        longitude: 3.3515,
        official_phone: "+2348000003001",
        phone: "+2348000003001",
        verification_status: "VerifiedOfficial",
        google_place_id: null,
        state: "Lagos",
        lga: "Ikeja",
        distance_meters: 120,
      },
    ]);
    googlePlaces.isEnabled.mockReturnValue(false);

    const result = await service.nearby({
      latitude: "6.6018",
      longitude: "3.3515",
      limit: "5",
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].dataSource).toBe("verifiedDatabase");
    expect(result.data[0].verificationStatus).toBe("VerifiedOfficial");
    expect(result.meta.googlePlacesEnabled).toBe(false);
  });

  it("merges Google Places fallback without duplicating verified place IDs", async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]);
    googlePlaces.isEnabled.mockReturnValue(true);
    googlePlaces.searchNearby.mockResolvedValueOnce({
      status: "ok",
      results: [
        {
          placeId: "ChIJ123",
          name: "Area Command",
          address: "Allen Avenue",
          latitude: 6.602,
          longitude: 3.352,
          phone: "+2348000003999",
          navigationUrl: "https://maps.google.com/?place_id=ChIJ123",
          businessStatus: "OPERATIONAL",
          attribution: "Powered by Google",
        },
      ],
    });
    prisma.googlePlaceReference.upsert.mockResolvedValue({});

    const result = await service.nearby({
      latitude: "6.6018",
      longitude: "3.3515",
      limit: "5",
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].dataSource).toBe("googlePlaces");
    expect(result.data[0].verificationStatus).toBe("GoogleMapsResult");
    expect(result.data[0].googleAttribution).toBe("Powered by Google");
    expect(prisma.googlePlaceReference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { placeId: "ChIJ123" } }),
    );
  });

  it("falls back to verified-only results when Google provider fails", async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: "station-2",
        name: "Alausa Security Post",
        address: "Alausa",
        agency_type: "security",
        station_type: "security",
        latitude: 6.6172,
        longitude: 3.3589,
        official_phone: null,
        phone: null,
        verification_status: "VerifiedOfficial",
        google_place_id: null,
        state: "Lagos",
        lga: "Ikeja",
        distance_meters: 900,
      },
    ]);
    googlePlaces.isEnabled.mockReturnValue(true);
    googlePlaces.searchNearby.mockResolvedValueOnce({ status: "failed", results: [] });

    const result = await service.nearby({
      latitude: "6.6018",
      longitude: "3.3515",
      limit: "5",
    });

    expect(result.data).toHaveLength(1);
    expect(result.meta.googleProviderStatus).toBe("failed");
  });
});

describe("GooglePlacesPoliceProvider", () => {
  it("is disabled without API key", () => {
    const config = { get: jest.fn((key: string) => (key === "GOOGLE_PLACES_ENABLED" ? "true" : "")) };
    const provider = new GooglePlacesPoliceProvider(config as never);
    expect(provider.isEnabled()).toBe(false);
  });

  it("does not expose API key in navigation URLs", () => {
    const config = { get: jest.fn((key: string) => {
      if (key === "GOOGLE_PLACES_ENABLED") return "true";
      if (key === "GOOGLE_PLACES_API_KEY") return "secret-key";
      return undefined;
    }) };
    const provider = new GooglePlacesPoliceProvider(config as never);
    const url = provider.placeNavigationUrl("ChIJ123", 6.6, 3.35);
    expect(url).not.toContain("secret-key");
  });
});

describe("parseNearbyPoliceQuery", () => {
  it("rejects invalid coordinates", () => {
    const { parseNearbyPoliceQuery } = require("../dto/police-station.dto");
    expect(() => parseNearbyPoliceQuery({ latitude: "999", longitude: "3.3" })).toThrow(BadRequestException);
  });
});
