import { IncidentType } from "@the-eye/shared";
import { AiIntelligenceService } from "../ai-intelligence.service";

function buildService() {
  const prisma = {
    community: {
      findUnique: jest.fn(async () => null),
      count: jest.fn(async () => 2),
    },
    communityPost: {
      findMany: jest.fn(async () => [
        { id: "p1", title: "Alert", body: "Body", confidenceScore: 80, verificationStatus: "Verified", communityId: "c1", community: { name: "Estate" } },
        { id: "p2", title: "False", body: "Bad", confidenceScore: 20, verificationStatus: "FalseInformation", communityId: "c1", community: { name: "Estate" } },
      ]),
    },
    incident: {
      findMany: jest.fn(async () => [
        {
          id: "i1",
          title: "Hotspot",
          type: IncidentType.CommunitySafety,
          latitude: 1,
          longitude: 2,
          createdAt: new Date(),
          state: "Lagos",
          lga: "Ikeja",
          verifications: [{ confidence: 88 }],
        },
      ]),
    },
    volunteerProfile: {
      findMany: jest.fn(async () => [{ id: "v1" }, { id: "v2" }]),
    },
  } as any;
  return new AiIntelligenceService(prisma);
}

describe("AiIntelligenceService", () => {
  it("computes risk, false report rate, and hotspot metrics", async () => {
    const service = buildService();
    const result = await service.getDashboard({ typ: "admin", role: "Super Admin", sub: "admin-1" } as never, { windowDays: 30 });
    expect(result.data.communityRiskScore).toBe(50);
    expect(result.data.falseReportRate).toBe(50);
    expect(result.data.volunteerCoverage).toBe(2);
    expect(result.data.hotspots).toHaveLength(1);
    expect(result.data.verificationInsights).toHaveLength(2);
  });
});
