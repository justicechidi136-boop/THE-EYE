import { UsersService } from "../users.service";

describe("UsersService.getMe", () => {
  it("returns citizen profile fields for authenticated users", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "citizen@example.com",
          phone: "+2348012345678",
          status: "Active",
          profile: {
            firstName: "Ada",
            lastName: "Okeke",
            country: "Nigeria",
            state: "Lagos",
            lga: "Ikeja",
            avatarUrl: null,
          },
          trustedReporter: { trustScore: 91, revokedAt: null },
          kycRecords: [{ status: "Verified" }],
          emergencyContacts: [{ name: "Mum", phone: "+2348099990000", relationship: "Parent" }],
        }),
      },
    } as any;

    const service = new UsersService(prisma);
    const result = await service.getMe({
      sub: "user-1",
      typ: "user",
      role: "Citizen",
      permissions: [],
    } as never);

    expect(result).toMatchObject({
      id: "user-1",
      displayName: "Ada Okeke",
      email: "citizen@example.com",
      kycStatus: "Verified",
      trustScore: 91,
      emergencyContact: { phone: "+2348099990000" },
    });
  });

  it("returns admin identity without requiring a citizen profile", async () => {
    const service = new UsersService({} as any);
    const result = await service.getMe({
      sub: "admin-1",
      typ: "admin",
      email: "admin@theeye.local",
      role: "Super Admin",
      permissions: ["user:manage"],
      country: "Nigeria",
    } as never);

    expect(result).toMatchObject({
      id: "admin-1",
      typ: "admin",
      email: "admin@theeye.local",
      role: "Super Admin",
    });
  });
});
