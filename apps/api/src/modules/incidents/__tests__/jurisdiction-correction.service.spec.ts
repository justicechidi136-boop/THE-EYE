import { IncidentStatus } from "@the-eye/shared";
import { JurisdictionCorrectionService } from "../jurisdiction-correction.service";
import { JurisdictionResolutionStatus } from "../jurisdiction-resolution.service";

function buildService() {
  const prisma = {
    incident: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const jurisdictionResolution = {
    isValidCoordinate: jest.fn().mockReturnValue(true),
    resolve: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const service = new JurisdictionCorrectionService(
    prisma as never,
    jurisdictionResolution as never,
    audit as never,
  );
  return { service, prisma, jurisdictionResolution, audit };
}

describe("JurisdictionCorrectionService", () => {
  it("auto-corrects jurisdiction from profile fallback to polygon match", async () => {
    const { service, prisma, jurisdictionResolution, audit } = buildService();
    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-1",
      status: IncidentStatus.Submitted,
      jurisdictionId: "j-old",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
      metadata: {
        jurisdictionResolutionStatus: JurisdictionResolutionStatus.ResolvedByProfileFallback,
        jurisdictionResolutionSource: "user_profile",
      },
    });
    jurisdictionResolution.resolve.mockResolvedValue({
      id: "j-new",
      country: "Nigeria",
      state: "Lagos",
      lga: "Surulere",
      resolutionStatus: JurisdictionResolutionStatus.ResolvedByCoordinates,
      resolutionSource: "postgis_polygon",
    });

    const result = await service.evaluateImprovedLocation("inc-1", {
      latitude: 6.5,
      longitude: 3.35,
      quality: "precise",
      source: "freshGps",
    });

    expect(result.jurisdictionUpdated).toBe(true);
    expect(result.reason).toBe("auto_correct_from_improved_gps");
    expect(prisma.incident.update).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "incident.jurisdiction_corrected" }),
    );
  });

  it("flags dispatcher review for cross-jurisdiction polygon changes", async () => {
    const { service, prisma, jurisdictionResolution } = buildService();
    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-2",
      status: IncidentStatus.Submitted,
      jurisdictionId: "j-old",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
      metadata: {
        jurisdictionResolutionStatus: JurisdictionResolutionStatus.ResolvedByCoordinates,
        jurisdictionResolutionSource: "postgis_polygon",
      },
    });
    jurisdictionResolution.resolve.mockResolvedValue({
      id: "j-other",
      country: "Nigeria",
      state: "Abuja",
      lga: "Municipal",
      resolutionStatus: JurisdictionResolutionStatus.ResolvedByCoordinates,
      resolutionSource: "postgis_polygon",
    });

    const result = await service.evaluateImprovedLocation("inc-2", {
      latitude: 9.05,
      longitude: 7.49,
      quality: "precise",
      source: "freshGps",
    });

    expect(result.requiresDispatcherReview).toBe(true);
    expect(result.jurisdictionUpdated).toBe(false);
    expect(result.reason).toBe("cross_jurisdiction_requires_dispatcher_review");
  });

  it("does not reassign terminal incidents", async () => {
    const { service, prisma } = buildService();
    prisma.incident.findUnique.mockResolvedValue({
      id: "inc-3",
      status: IncidentStatus.Closed,
      jurisdictionId: "j-old",
      country: "Nigeria",
      state: "Lagos",
      lga: "Ikeja",
      metadata: {},
    });

    const result = await service.evaluateImprovedLocation("inc-3", {
      latitude: 6.5,
      longitude: 3.35,
      quality: "precise",
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("terminal_incident");
  });
});
