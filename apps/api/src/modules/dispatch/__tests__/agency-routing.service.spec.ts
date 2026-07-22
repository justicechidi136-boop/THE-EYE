import { AgencyRoutingService, haversineMeters } from "../agency-routing.service";

describe("AgencyRoutingService", () => {
  it("ranks closer agencies higher with haversine fallback rows", () => {
    const service = Object.create(AgencyRoutingService.prototype) as AgencyRoutingService;
    const ranked = (service as any).rankRows(
      [
        {
          id: "a1",
          name: "Far Agency",
          type: "police",
          service_categories: ["police"],
          escalation_priority: 1,
          latitude: 6.7,
          longitude: 3.4,
          distance_meters: null,
          available_responders: 1,
          available_units: 0,
          active_assignments: 0,
        },
        {
          id: "a2",
          name: "Near Agency",
          type: "ambulance",
          service_categories: ["ambulance"],
          escalation_priority: 2,
          latitude: 6.601,
          longitude: 3.351,
          distance_meters: null,
          available_responders: 2,
          available_units: 1,
          active_assignments: 0,
        },
      ],
      6.6018,
      3.3515,
      2,
      "haversine",
    );

    expect(ranked[0].agencyId).toBe("a2");
    expect(ranked[0].distanceSource).toBe("haversine");
    expect(ranked[0].rank).toBe(1);
  });
});

describe("haversineMeters", () => {
  it("returns zero for identical coordinates", () => {
    expect(haversineMeters(6.6, 3.35, 6.6, 3.35)).toBe(0);
  });
});
