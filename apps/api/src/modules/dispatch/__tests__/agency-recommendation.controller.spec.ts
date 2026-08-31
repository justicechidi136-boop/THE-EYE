import { ForbiddenException } from "@nestjs/common";
import { AgencyRecommendationController } from "../agency-recommendation.controller";

describe("AgencyRecommendationController incident preview", () => {
  it("requires successful incident access before generating recommendations", async () => {
    const routing = { previewIncident: jest.fn() };
    const incidents = { get: jest.fn().mockRejectedValue(new ForbiddenException("outside scope")) };
    const controller = new AgencyRecommendationController(routing as never, incidents as never);

    await expect(controller.incidentPreview("incident-1", { user: { sub: "admin-1" } }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(routing.previewIncident.mock.calls.length).toBe(0);
  });

  it("uses the authorized incident and remains a read-only preview", async () => {
    const incident = { id: "incident-1", type: "Fire" };
    const result = { ruleVersion: "agency-recommendation-v1", meta: { incidentStateChanged: false } };
    const routing = { previewIncident: jest.fn().mockResolvedValue(result) };
    const incidents = { get: jest.fn().mockResolvedValue(incident) };
    const controller = new AgencyRecommendationController(routing as never, incidents as never);
    const user = { sub: "admin-1" };

    expect(await controller.incidentPreview("incident-1", { user })).toBe(result);
    expect(incidents.get).toHaveBeenCalledWith("incident-1", user);
    expect(routing.previewIncident).toHaveBeenCalledWith(incident, user);
  });
});
