import { AdminRoleName, adminRolePermissions } from "@the-eye/shared";
import { CommunityLevel, CommunityRoleName, CommunityVisibility } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { hashPassword, hashToken, randomToken } from "../src/common/auth/crypto";
import { assertStagingOnlySeedAllowed } from "./staging-guard";
import {
  requireStagingTestCredentials,
  readWatchDeviceId,
  toAccountSpec,
  type StagingTestAccountKey,
  type StagingTestAccountSpec,
} from "./staging-test-accounts.config";

const prisma = new PrismaClient();

const JURISDICTION = {
  country: { country: "Nigeria", state: "All", lga: "All", name: "Nigeria (Country)" },
  state: { country: "Nigeria", state: "Lagos", lga: "All", name: "Lagos State" },
  lga: { country: "Nigeria", state: "Lagos", lga: "Ikeja", name: "Ikeja LGA" },
} as const;

const PROFILE_LOCATION = {
  country: "Nigeria",
  state: "Lagos",
  lga: "Ikeja",
  address: "12 Allen Avenue, Ikeja, Lagos",
} as const;

const ADMIN_ROLE_BY_KEY: Record<
  Extract<
    StagingTestAccountKey,
    "SUPER_ADMIN" | "COUNTRY_ADMIN" | "STATE_ADMIN" | "LGA_ADMIN" | "AGENCY_OFFICER" | "NEIGHBORHOOD_WATCH_ADMIN"
  >,
  AdminRoleName
> = {
  SUPER_ADMIN: AdminRoleName.SuperAdmin,
  COUNTRY_ADMIN: AdminRoleName.CountryAdmin,
  STATE_ADMIN: AdminRoleName.StateAdmin,
  LGA_ADMIN: AdminRoleName.LgaAdmin,
  AGENCY_OFFICER: AdminRoleName.PoliceSecurityOfficer,
  NEIGHBORHOOD_WATCH_ADMIN: AdminRoleName.CommunityModerator,
};

const ADMIN_SCOPE_BY_KEY: Record<
  Extract<
    StagingTestAccountKey,
    "SUPER_ADMIN" | "COUNTRY_ADMIN" | "STATE_ADMIN" | "LGA_ADMIN" | "AGENCY_OFFICER" | "NEIGHBORHOOD_WATCH_ADMIN"
  >,
  { country: string; state: string; lga: string; jurisdictionKey: keyof typeof JURISDICTION; needsAgency?: boolean }
> = {
  SUPER_ADMIN: { ...JURISDICTION.country, jurisdictionKey: "country" },
  COUNTRY_ADMIN: { ...JURISDICTION.country, jurisdictionKey: "country" },
  STATE_ADMIN: { ...JURISDICTION.state, jurisdictionKey: "state" },
  LGA_ADMIN: { ...JURISDICTION.lga, jurisdictionKey: "lga" },
  AGENCY_OFFICER: { ...JURISDICTION.lga, jurisdictionKey: "lga", needsAgency: true },
  NEIGHBORHOOD_WATCH_ADMIN: { ...JURISDICTION.lga, jurisdictionKey: "lga" },
};

const DISPLAY_NAMES: Record<StagingTestAccountKey, string> = {
  SUPER_ADMIN: "Staging Super Admin",
  COUNTRY_ADMIN: "Staging Country Admin",
  STATE_ADMIN: "Staging State Admin (Lagos)",
  LGA_ADMIN: "Staging LGA Admin (Ikeja)",
  AGENCY_OFFICER: "Staging Agency Officer (Ikeja Police)",
  NEIGHBORHOOD_WATCH_ADMIN: "Staging Neighborhood Watch Admin",
  CITIZEN: "Staging Citizen",
  WATCH_PAIRED_CITIZEN: "Staging Watch-paired Citizen",
};

async function upsertAdminRole(roleName: AdminRoleName) {
  return prisma.adminRole.upsert({
    where: { name: roleName },
    update: { permissions: adminRolePermissions[roleName] },
    create: { name: roleName, permissions: adminRolePermissions[roleName] },
  });
}

async function upsertJurisdiction(key: keyof typeof JURISDICTION) {
  const definition = JURISDICTION[key];
  return prisma.jurisdiction.upsert({
    where: {
      country_state_lga: {
        country: definition.country,
        state: definition.state,
        lga: definition.lga,
      },
    },
    update: { name: definition.name },
    create: definition,
  });
}

async function upsertAgency(jurisdictionId: string) {
  const existing = await prisma.agency.findFirst({
    where: {
      jurisdictionId,
      type: "police",
      name: "Ikeja Police Command (Staging)",
    },
  });
  if (existing) return existing;

  return prisma.agency.create({
    data: {
      jurisdictionId,
      name: "Ikeja Police Command (Staging)",
      type: "police",
      phone: "+2348001001001",
      email: "staging.ikeja.police@theeye.local",
    },
  });
}

async function upsertCommunity(jurisdictionId: string) {
  const existing = await prisma.community.findFirst({
    where: {
      name: "Allen Avenue Estate (Staging)",
      country: PROFILE_LOCATION.country,
      state: PROFILE_LOCATION.state,
      lga: PROFILE_LOCATION.lga,
    },
  });
  if (existing) return existing;

  return prisma.community.create({
    data: {
      jurisdictionId,
      name: "Allen Avenue Estate (Staging)",
      level: CommunityLevel.Estate,
      visibility: CommunityVisibility.Private,
      country: PROFILE_LOCATION.country,
      state: PROFILE_LOCATION.state,
      lga: PROFILE_LOCATION.lga,
      ward: "Ward C",
      estate: "Allen Estate",
      street: "Gate 2 Street",
      description: "Staging Neighborhood Watch community for QA and integration tests.",
    },
  });
}

async function ensureCommunityRoles(communityId: string) {
  const moderatorRole = await prisma.communityRole.upsert({
    where: { communityId_name: { communityId, name: CommunityRoleName.CommunityModerator } },
    update: { permissions: ["community:moderate", "community:verify", "community:patrol"] },
    create: {
      communityId,
      name: CommunityRoleName.CommunityModerator,
      permissions: ["community:moderate", "community:verify", "community:patrol"],
    },
  });

  await prisma.communityRole.upsert({
    where: { communityId_name: { communityId, name: CommunityRoleName.Resident } },
    update: { permissions: ["community:read", "community:post"] },
    create: {
      communityId,
      name: CommunityRoleName.Resident,
      permissions: ["community:read", "community:post"],
    },
  });

  return moderatorRole;
}

async function upsertAdminAccount(spec: StagingTestAccountSpec) {
  const key = spec.key as keyof typeof ADMIN_ROLE_BY_KEY;
  const roleName = ADMIN_ROLE_BY_KEY[key];
  const scope = ADMIN_SCOPE_BY_KEY[key];
  const role = await upsertAdminRole(roleName);
  const jurisdiction = await upsertJurisdiction(scope.jurisdictionKey);
  const agency = scope.needsAgency ? await upsertAgency(jurisdiction.id) : null;

  const admin = await prisma.adminUser.upsert({
    where: { email: spec.email },
    update: {
      passwordHash: hashPassword(spec.password),
      roleId: role.id,
      jurisdictionId: jurisdiction.id,
      agencyId: agency?.id ?? null,
      displayName: DISPLAY_NAMES[spec.key],
      country: scope.country,
      state: scope.state,
      lga: scope.lga,
      isActive: true,
    },
    create: {
      email: spec.email,
      passwordHash: hashPassword(spec.password),
      roleId: role.id,
      jurisdictionId: jurisdiction.id,
      agencyId: agency?.id ?? null,
      displayName: DISPLAY_NAMES[spec.key],
      country: scope.country,
      state: scope.state,
      lga: scope.lga,
      isActive: true,
    },
  });

  if (spec.key === "NEIGHBORHOOD_WATCH_ADMIN") {
    const community = await upsertCommunity(jurisdiction.id);
    await ensureCommunityRoles(community.id);
  }

  return { admin, roleName, jurisdiction, agency };
}

async function upsertCitizenAccount(spec: StagingTestAccountSpec) {
  const user = await prisma.user.upsert({
    where: { email: spec.email },
    update: {
      passwordHash: hashPassword(spec.password),
      phone: spec.phone ?? undefined,
      status: "Active",
    },
    create: {
      email: spec.email,
      phone: spec.phone,
      passwordHash: hashPassword(spec.password),
      status: "Active",
    },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      firstName: "Staging",
      lastName: spec.key === "WATCH_PAIRED_CITIZEN" ? "Watch Citizen" : "Citizen",
      country: PROFILE_LOCATION.country,
      state: PROFILE_LOCATION.state,
      lga: PROFILE_LOCATION.lga,
      address: PROFILE_LOCATION.address,
    },
    create: {
      userId: user.id,
      firstName: "Staging",
      lastName: spec.key === "WATCH_PAIRED_CITIZEN" ? "Watch Citizen" : "Citizen",
      country: PROFILE_LOCATION.country,
      state: PROFILE_LOCATION.state,
      lga: PROFILE_LOCATION.lga,
      address: PROFILE_LOCATION.address,
    },
  });

  return user;
}

async function upsertWatchPairedDevice(userId: string, deviceId: string) {
  const deviceSecret = randomToken(32);
  const device = await prisma.smartwatchDevice.upsert({
    where: { deviceId },
    update: {
      userId,
      provider: "generic",
      displayName: "Staging Paired Watch",
      model: "THE EYE Watch (Staging)",
      serialNumber: "STG-WATCH-0001",
      connectivityMode: "PairedPhone",
      preferredMode: "PairedPhone",
      pairingMethod: "PairingCode",
      pairingCodeHash: hashToken("staging-pairing-complete"),
      pairedPhoneDeviceId: "staging-phone-001",
      deviceSecretHash: hashToken(deviceSecret),
      firmwareVersion: "1.0.0-staging",
      isActive: true,
      isOnline: false,
      lastSeenAt: new Date(),
      metadata: { source: "seed-staging-test-accounts", environment: "staging" },
    },
    create: {
      userId,
      deviceId,
      provider: "generic",
      displayName: "Staging Paired Watch",
      model: "THE EYE Watch (Staging)",
      serialNumber: "STG-WATCH-0001",
      connectivityMode: "PairedPhone",
      preferredMode: "PairedPhone",
      pairingMethod: "PairingCode",
      pairingCodeHash: hashToken("staging-pairing-complete"),
      pairedPhoneDeviceId: "staging-phone-001",
      deviceSecretHash: hashToken(deviceSecret),
      firmwareVersion: "1.0.0-staging",
      isActive: true,
      isOnline: false,
      lastSeenAt: new Date(),
      metadata: { source: "seed-staging-test-accounts", environment: "staging" },
    },
  });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.smartwatchPairingSession.upsert({
    where: { deviceId },
    update: {
      pairingCodeHash: hashToken("staging-pairing-complete"),
      firebaseEnv: "staging",
      expiresAt,
      usedAt: new Date(),
      deviceSecretPlain: null,
    },
    create: {
      deviceId,
      pairingCodeHash: hashToken("staging-pairing-complete"),
      firebaseEnv: "staging",
      expiresAt,
      usedAt: new Date(),
    },
  });

  return device;
}

async function seedAccount(spec: StagingTestAccountSpec) {
  if (spec.isAdmin) {
    const result = await upsertAdminAccount(spec);
    return {
      key: spec.key,
      label: spec.label,
      email: spec.email,
      type: "admin" as const,
      role: result.roleName,
      jurisdiction: `${result.jurisdiction.country} / ${result.jurisdiction.state} / ${result.jurisdiction.lga}`,
      agency: result.agency?.name ?? null,
      id: result.admin.id,
    };
  }

  const user = await upsertCitizenAccount(spec);
  let deviceId: string | null = null;
  if (spec.key === "WATCH_PAIRED_CITIZEN") {
    deviceId = readWatchDeviceId();
    await upsertWatchPairedDevice(user.id, deviceId);
  }

  return {
    key: spec.key,
    label: spec.label,
    email: spec.email,
    type: "user" as const,
    role: spec.key === "WATCH_PAIRED_CITIZEN" ? "citizen + smartwatch" : "citizen",
    jurisdiction: `${PROFILE_LOCATION.country} / ${PROFILE_LOCATION.state} / ${PROFILE_LOCATION.lga}`,
    agency: null,
    deviceId,
    id: user.id,
  };
}

async function main() {
  assertStagingOnlySeedAllowed();

  const credentials = requireStagingTestCredentials();
  const specs = credentials.map((entry) => toAccountSpec(entry));

  console.log(`Seeding ${specs.length} staging test account(s)...`);

  const results = [];
  for (const spec of specs) {
    results.push(await seedAccount(spec));
  }

  console.log("Staging test accounts upserted:");
  for (const result of results) {
    const extras = [
      result.role ? `role=${result.role}` : null,
      result.jurisdiction ? `jurisdiction=${result.jurisdiction}` : null,
      result.agency ? `agency=${result.agency}` : null,
      "deviceId" in result && result.deviceId ? `deviceId=${result.deviceId}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`- ${result.label}: ${result.email} (${extras})`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
