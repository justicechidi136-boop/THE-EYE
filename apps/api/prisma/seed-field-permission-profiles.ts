/**
 * Seeds the built-in ("system") FieldPermissionProfile catalog used by field device
 * pre-provisioning. System profiles are read-only in the admin API (see
 * FieldPermissionProfilesService.update) — operators fork a custom profile instead
 * of editing these directly. Safe to re-run: upserts by unique `code`.
 *
 * Usage: npx ts-node prisma/seed-field-permission-profiles.ts
 */
import { PrismaClient } from "@prisma/client";
import { FieldOperationalRole } from "@the-eye/shared";

const prisma = new PrismaClient();

type SystemProfileSeed = {
  code: string;
  name: string;
  description: string;
  operationalRole: string;
  permissions: string[];
};

const CORE = ["field:access", "field:session:operate", "field:map:view", "field:assignment:view"];

const SYSTEM_PROFILES: SystemProfileSeed[] = [
  {
    code: "patrol_officer_baseline",
    name: "Patrol Officer — Baseline",
    description: "Standard capability set for a patrol officer field tablet.",
    operationalRole: FieldOperationalRole.PatrolOfficer,
    permissions: [
      ...CORE,
      "field:assignment:accept",
      "field:incident:view",
      "field:incident:update-status",
      "field:incident:create",
      "field:patrol:operate",
      "field:shift:operate",
      "field:communication:send",
      "field:evidence:add",
      "field:bolo:view",
      "field:sighting:create",
      "field:broadcast:view",
      "field:backup:request",
      "field:vehicle:search",
    ],
  },
  {
    code: "patrol_team_lead",
    name: "Patrol Team Lead",
    description: "Patrol officer baseline plus supervisory oversight of the patrol team.",
    operationalRole: FieldOperationalRole.PatrolTeamLead,
    permissions: [
      ...CORE,
      "field:assignment:accept",
      "field:incident:view",
      "field:incident:update-status",
      "field:incident:create",
      "field:patrol:operate",
      "field:shift:operate",
      "field:communication:send",
      "field:evidence:add",
      "field:bolo:view",
      "field:sighting:create",
      "field:broadcast:view",
      "field:backup:request",
      "field:vehicle:search",
      "field:supervisor:manage",
    ],
  },
  {
    code: "checkpoint_officer_baseline",
    name: "Checkpoint Officer — Baseline",
    description: "Standard capability set for a checkpoint duty field tablet.",
    operationalRole: FieldOperationalRole.CheckpointOfficer,
    permissions: [
      ...CORE,
      "field:assignment:accept",
      "field:incident:view",
      "field:checkpoint:operate",
      "field:vehicle:search",
      "field:communication:send",
      "field:bolo:view",
      "field:sighting:create",
      "field:broadcast:view",
      "field:backup:request",
      "field:shift:operate",
    ],
  },
  {
    code: "checkpoint_commander",
    name: "Checkpoint Commander",
    description: "Checkpoint officer baseline plus supervisory oversight of the checkpoint team.",
    operationalRole: FieldOperationalRole.CheckpointCommander,
    permissions: [
      ...CORE,
      "field:assignment:accept",
      "field:incident:view",
      "field:checkpoint:operate",
      "field:vehicle:search",
      "field:communication:send",
      "field:bolo:view",
      "field:sighting:create",
      "field:broadcast:view",
      "field:backup:request",
      "field:shift:operate",
      "field:supervisor:manage",
    ],
  },
  {
    code: "dispatcher_baseline",
    name: "Dispatcher — Baseline",
    description: "Dispatch coordination capabilities for a field/desk tablet.",
    operationalRole: FieldOperationalRole.Dispatcher,
    permissions: [
      ...CORE,
      "field:assignment:accept",
      "field:incident:view",
      "field:incident:create",
      "field:incident:update-status",
      "field:communication:send",
      "field:bolo:view",
      "field:broadcast:view",
    ],
  },
  {
    code: "agency_supervisor",
    name: "Agency Supervisor",
    description: "Full oversight capability set for an agency-level field supervisor.",
    operationalRole: FieldOperationalRole.AgencySupervisor,
    permissions: [
      ...CORE,
      "field:assignment:accept",
      "field:incident:view",
      "field:incident:update-status",
      "field:incident:create",
      "field:patrol:operate",
      "field:checkpoint:operate",
      "field:shift:operate",
      "field:communication:send",
      "field:evidence:add",
      "field:bolo:view",
      "field:sighting:create",
      "field:broadcast:view",
      "field:backup:request",
      "field:vehicle:search",
      "field:drone:observe",
      "field:supervisor:manage",
    ],
  },
  {
    code: "emergency_responder_baseline",
    name: "Emergency Responder — Baseline",
    description: "Rapid-response capability set for ambulance/fire/emergency field units.",
    operationalRole: FieldOperationalRole.EmergencyResponder,
    permissions: [
      ...CORE,
      "field:assignment:accept",
      "field:incident:view",
      "field:incident:update-status",
      "field:communication:send",
      "field:evidence:add",
      "field:backup:request",
      "field:shift:operate",
    ],
  },
  {
    code: "drone_operator_field",
    name: "Drone Operator — Field",
    description: "Read-only drone mission observation for a field tablet accompanying a drone unit.",
    operationalRole: FieldOperationalRole.DroneOperator,
    permissions: [...CORE, "field:incident:view", "field:communication:send", "field:drone:observe", "field:backup:request"],
  },
  {
    code: "field_read_only_observer",
    name: "Field Read-only Observer",
    description: "Minimal read-only visibility for auditors/observers issued a field tablet.",
    operationalRole: FieldOperationalRole.FieldReadOnlyObserver,
    permissions: ["field:access", "field:map:view", "field:assignment:view", "field:incident:view", "field:bolo:view", "field:broadcast:view"],
  },
];

async function main() {
  for (const profile of SYSTEM_PROFILES) {
    await prisma.fieldPermissionProfile.upsert({
      where: { code: profile.code },
      update: {
        name: profile.name,
        description: profile.description,
        operationalRole: profile.operationalRole,
        permissions: profile.permissions,
        isSystem: true,
        isActive: true,
        disabledAt: null,
        disabledById: null,
        disabledReason: null,
      },
      create: {
        code: profile.code,
        name: profile.name,
        description: profile.description,
        operationalRole: profile.operationalRole,
        permissions: profile.permissions,
        isSystem: true,
        isActive: true,
      },
    });
    console.log(`Seeded field permission profile: ${profile.code}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
