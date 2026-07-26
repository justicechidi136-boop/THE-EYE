import { PatrolStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { assertStagingOnlySeedAllowed } from "../prisma/staging-guard";

const prisma = new PrismaClient();

const STAGING_COMMUNITY_NAME = "Allen Avenue Estate (Staging)";
const STAGING_POLICE_SOURCE = "staging-cert-ikeja-gate-001";

async function main() {
  assertStagingOnlySeedAllowed();

  const community = await prisma.community.findFirst({
    where: { name: STAGING_COMMUNITY_NAME },
    select: { id: true, name: true, memberCount: true },
  });

  const approvedMemberships = community
    ? await prisma.communityMembership.count({
        where: { communityId: community.id, status: "Approved" },
      })
    : 0;

  const activePatrols = community
    ? await prisma.patrolSchedule.count({
        where: { communityId: community.id, status: PatrolStatus.Active },
      })
    : 0;

  const volunteerProfiles = community
    ? await prisma.volunteerProfile.count({ where: { communityId: community.id } })
    : 0;

  const policeStation = await prisma.policeStation.findFirst({
    where: { sourceReference: STAGING_POLICE_SOURCE },
    select: {
      id: true,
      name: true,
      verificationStatus: true,
      isActive: true,
      sourceReference: true,
    },
  });

  const stagingUsers = await prisma.user.count({
    where: { email: { endsWith: "@theeye.local" } },
  });

  console.log("Staging certification dataset summary (no credentials):");
  console.log(
    JSON.stringify(
      {
        community: community
          ? {
              id: community.id,
              name: community.name,
              approvedMemberships,
            }
          : null,
        activePatrols,
        volunteerProfiles,
        policeStation,
        stagingUserCount: stagingUsers,
      },
      null,
      2,
    ),
  );

  if (!community || approvedMemberships < 1 || activePatrols < 1 || !policeStation) {
    process.exitCode = 1;
    console.error(
      "Missing required staging certification records — run seed:staging:test-accounts first.",
    );
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
