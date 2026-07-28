import { AdminRoleName, adminRolePermissions } from "@the-eye/shared";
import { CommunityLevel, CommunityRoleName, CommunityVisibility, PatrolStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { hashPassword, hashToken, randomToken } from "../src/common/auth/crypto";
import { assertStagingOnlySeedAllowed } from "./staging-guard";
import {
  normalizeStagingCredentialEmail,
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

async function ensureCitizenCommunityMembership(userId: string, communityId: string) {
  const residentRole = await prisma.communityRole.findFirst({
    where: { communityId, name: CommunityRoleName.Resident },
  });
  await prisma.communityMembership.upsert({
    where: { communityId_userId: { communityId, userId } },
    update: {
      status: "Approved",
      approvedAt: new Date(),
      roleId: residentRole?.id ?? null,
    },
    create: {
      communityId,
      userId,
      roleId: residentRole?.id ?? null,
      status: "Approved",
      approvedAt: new Date(),
    },
  });
}

async function ensureActivePatrolSchedule(communityId: string) {
  const existing = await prisma.patrolSchedule.findFirst({
    where: { communityId, status: PatrolStatus.Active },
  });
  if (existing) return existing;

  const now = new Date();
  return prisma.patrolSchedule.create({
    data: {
      communityId,
      title: "Staging evening patrol (QA)",
      status: PatrolStatus.Active,
      startsAt: new Date(now.getTime() - 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
    },
  });
}

const STAGING_POLICE_STATION = {
  name: "Ikeja Gate Staging Police Post (CERT)",
  sourceReference: "staging-cert-ikeja-gate-001",
  address: "12 Allen Avenue, Ikeja, Lagos (Staging CERT)",
  latitude: 6.6018,
  longitude: 3.3515,
} as const;

async function ensureStagingPoliceStation(jurisdictionId: string, agencyId: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id FROM police_stations
    WHERE source_reference = ${STAGING_POLICE_STATION.sourceReference}
    LIMIT 1
  `;

  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE police_stations SET
        name = ${STAGING_POLICE_STATION.name},
        address = ${STAGING_POLICE_STATION.address},
        jurisdiction_id = ${jurisdictionId}::uuid,
        agency_id = ${agencyId}::uuid,
        verification_status = 'VerifiedOfficial',
        is_active = true,
        source = 'staging-certification',
        country = ${PROFILE_LOCATION.country},
        state = ${PROFILE_LOCATION.state},
        lga = ${PROFILE_LOCATION.lga},
        latitude = ${STAGING_POLICE_STATION.latitude},
        longitude = ${STAGING_POLICE_STATION.longitude},
        updated_at = NOW()
      WHERE id = ${existing[0].id}::uuid
    `;
    return prisma.policeStation.findFirst({ where: { id: existing[0].id } });
  }

  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO police_stations (
      id, jurisdiction_id, agency_id, name, phone, address,
      source, source_reference, verification_status, verified_at, is_active,
      country, state, lga, latitude, longitude, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      ${jurisdictionId}::uuid,
      ${agencyId}::uuid,
      ${STAGING_POLICE_STATION.name},
      '+2348001002002',
      ${STAGING_POLICE_STATION.address},
      'staging-certification',
      ${STAGING_POLICE_STATION.sourceReference},
      'VerifiedOfficial',
      NOW(),
      true,
      ${PROFILE_LOCATION.country},
      ${PROFILE_LOCATION.state},
      ${PROFILE_LOCATION.lga},
      ${STAGING_POLICE_STATION.latitude},
      ${STAGING_POLICE_STATION.longitude},
      NOW(),
      NOW()
    )
    RETURNING id::text AS id
  `;

  const stationId = inserted[0]?.id;
  if (!stationId) {
    throw new Error("Failed to insert staging certification police station");
  }

  return prisma.policeStation.findFirst({ where: { id: stationId } });
}

async function upsertAdminAccount(spec: StagingTestAccountSpec) {
  const key = spec.key as keyof typeof ADMIN_ROLE_BY_KEY;
  const roleName = ADMIN_ROLE_BY_KEY[key];
  const scope = ADMIN_SCOPE_BY_KEY[key];
  const role = await upsertAdminRole(roleName);
  const jurisdiction = await upsertJurisdiction(scope.jurisdictionKey);
  const agency = scope.needsAgency ? await upsertAgency(jurisdiction.id) : null;
  const email = normalizeStagingCredentialEmail(spec.email);
  const passwordHash = hashPassword(spec.password);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
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
      email,
      passwordHash,
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

async function reconcileCitizenEmail(email: string) {
  const normalizedEmail = normalizeStagingCredentialEmail(email);
  const matches = await prisma.user.findMany({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  if (matches.length <= 1) {
    return normalizedEmail;
  }

  const [primary, ...duplicates] = matches;
  for (const duplicate of duplicates) {
    await prisma.user.delete({ where: { id: duplicate.id } });
  }

  if (primary.email !== normalizedEmail) {
    await prisma.user.update({
      where: { id: primary.id },
      data: { email: normalizedEmail },
    });
  }

  return normalizedEmail;
}

async function upsertCitizenAccount(spec: StagingTestAccountSpec) {
  const email = await reconcileCitizenEmail(spec.email);
  const passwordHash = hashPassword(spec.password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      phone: spec.phone ?? undefined,
      status: "Active",
    },
    create: {
      email,
      phone: spec.phone,
      passwordHash,
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
  const jurisdiction = await upsertJurisdiction("lga");
  const community = await upsertCommunity(jurisdiction.id);
  await ensureCommunityRoles(community.id);
  await ensureCitizenCommunityMembership(user.id, community.id);
  await ensureActivePatrolSchedule(community.id);
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

  const jurisdiction = await upsertJurisdiction("lga");
  const agency = await upsertAgency(jurisdiction.id);
  const community = await upsertCommunity(jurisdiction.id);
  await ensureCommunityRoles(community.id);
  const patrol = await ensureActivePatrolSchedule(community.id);
  const policeStation = await ensureStagingPoliceStation(jurisdiction.id, agency.id);

  await prisma.$executeRawUnsafe(`
    UPDATE jurisdictions
    SET boundary = ST_GeogFromText('SRID=4326;MULTIPOLYGON(((3.30 6.55,3.45 6.55,3.45 6.70,3.30 6.70,3.30 6.55)))')
    WHERE country = 'Nigeria' AND state = 'Lagos' AND lga = 'Ikeja'
  `);

  await prisma.jurisdiction.upsert({
    where: {
      country_state_lga: {
        country: "Nigeria",
        state: "Rivers",
        lga: "Obio-Akpor",
      },
    },
    update: {
      name: "Obio-Akpor LGA (Staging)",
    },
    create: {
      country: "Nigeria",
      state: "Rivers",
      lga: "Obio-Akpor",
      name: "Obio-Akpor LGA (Staging)",
    },
  });

  await prisma.$executeRawUnsafe(`
    UPDATE jurisdictions
    SET boundary = ST_GeogFromText('SRID=4326;MULTIPOLYGON(((6.90 4.70,7.20 4.70,7.20 4.95,6.90 4.95,6.90 4.70)))')
    WHERE country = 'Nigeria' AND state = 'Rivers' AND lga = 'Obio-Akpor'
  `);

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

  console.log("Staging certification dataset:");
  console.log(`- communityId=${community.id} name=${community.name}`);
  console.log(`- activePatrolId=${patrol.id} title=${patrol.title}`);
  console.log(
    `- policeStationId=${policeStation.id} sourceReference=${STAGING_POLICE_STATION.sourceReference}`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
