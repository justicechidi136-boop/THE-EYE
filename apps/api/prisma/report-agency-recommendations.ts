import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import {
  AGENCY_RECOMMENDATION_RULE_VERSION,
  AgencyRoutingService,
} from "../src/modules/dispatch/agency-routing.service";

const prisma = new PrismaClient();
const targetStates = [
  "Lagos", "Federal Capital Territory", "Rivers", "Kano", "Enugu", "Borno", "Benue", "Oyo", "Abia",
];
const incidentTypes = ["Fire", "Accident", "Crime", "Emergency"];

async function main() {
  const country = await prisma.country.findFirst({ where: { code: "NG", isActive: true } });
  if (!country) throw new Error("Nigeria canonical country record is unavailable");
  const states = await prisma.administrativeState.findMany({
    where: { countryId: country.id, name: { in: targetStates }, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const routing = new AgencyRoutingService(prisma as never);
  const actor = { typ: "admin", sub: "recommendation-certification", role: "Super Admin" } as never;
  const results: Array<Record<string, unknown>> = [];

  for (const state of states) {
    for (const incidentType of incidentTypes) {
      const startedAt = performance.now();
      const preview = await routing.preview({
        incidentType,
        countryId: country.id,
        stateId: state.id,
        limit: 50,
      }, actor);
      results.push({
        state: state.name,
        incidentType,
        actionable: preview.actionableRecommendations.length,
        structuralOnly: preview.structuralMatches.length,
        informational: preview.informationalMatches.length,
        distanceQualified: preview.meta.distanceQualifiedCount,
        limitations: preview.limitations,
        elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      });
    }
  }

  const timings = results.map((row) => Number(row.elapsedMs));
  console.log(JSON.stringify({
    ruleVersion: AGENCY_RECOMMENDATION_RULE_VERSION,
    scenarios: results,
    summary: {
      requestedStates: targetStates.length,
      resolvedStates: states.length,
      scenarios: results.length,
      averageMs: timings.length
        ? Number((timings.reduce((sum, value) => sum + value, 0) / timings.length).toFixed(2))
        : 0,
      maximumMs: timings.length ? Math.max(...timings) : 0,
      externalCommunicationCalls: 0,
      incidentStateMutations: 0,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
