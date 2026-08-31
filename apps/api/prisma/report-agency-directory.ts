import { PrismaClient } from "@prisma/client";
import { AgencyDirectoryService } from "../src/modules/agencies/agency-directory.service";

const prisma = new PrismaClient();

function duplicateCount<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
}

async function main() {
  const service = new AgencyDirectoryService(prisma as never);
  const actor = { typ: "admin", sub: "directory-certification", role: "Super Admin" } as never;
  const [coverage, freshness, agencies, offices, contacts, jurisdictions, capabilities] = await Promise.all([
    service.getCoverageReport(actor, {}),
    service.getVerificationFreshnessReport(actor, { staleDays: 365, limit: 10_000 }),
    prisma.agency.findMany({ where: { isActive: true }, select: { id: true, code: true, governmentLevel: true } }),
    prisma.agencyOffice.findMany({ where: { isActive: true }, select: {
      id: true, agencyId: true, countryId: true, name: true, latitude: true, longitude: true, physicalAddress: true,
      agency: { select: { governmentLevel: true } },
    } }),
    prisma.agencyContact.findMany({ where: { isActive: true }, select: {
      id: true, agencyId: true, officeId: true, type: true, value: true, publiclyVerified: true, verificationStatus: true,
      emergencyOnly: true,
    } }),
    prisma.agencyJurisdiction.findMany({ where: { isActive: true }, select: {
      id: true, agencyId: true, officeId: true, coverageType: true, countryId: true, stateId: true, lgaId: true, wardId: true,
    } }),
    prisma.agencyIncidentCapability.findMany({ where: { isActive: true }, select: {
      id: true, canDispatch: true, canEscalate: true,
    } }),
  ]);
  const [orphanResult] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT (
      (SELECT COUNT(*) FROM agency_offices office LEFT JOIN agencies agency ON agency.id = office.agency_id WHERE agency.id IS NULL)
      + (SELECT COUNT(*) FROM agency_contacts contact LEFT JOIN agencies agency ON agency.id = contact.agency_id WHERE agency.id IS NULL)
      + (SELECT COUNT(*) FROM agency_jurisdictions jurisdiction LEFT JOIN agencies agency ON agency.id = jurisdiction.agency_id WHERE agency.id IS NULL)
      + (SELECT COUNT(*) FROM agency_jurisdictions jurisdiction LEFT JOIN countries country ON country.id = jurisdiction.country_id WHERE country.id IS NULL)
      + (SELECT COUNT(*) FROM agency_jurisdictions jurisdiction LEFT JOIN administrative_states state ON state.id = jurisdiction.state_id WHERE jurisdiction.state_id IS NOT NULL AND state.id IS NULL)
    ) AS count
  `;

  console.log("State/FCT\tEmergency Management\tFire Structural\tFire Operational\tAmbulance/EMS\tTraffic\tPolice Structural\tPolice Operational\tNSCDC Structural\tNSCDC Operational\tFRSC Structural\tFRSC Operational\tVerified Emergency Contacts\tVerified Public Offices\tVerified Coordinates\tPending Research");
  for (const row of coverage.data) {
    const cells = [
      row.emergencyManagement,
      row.fire,
      row.ambulanceEms,
      row.traffic,
      row.policeCommand,
      row.nscdcCommand,
      row.frscCommand,
    ];
    const emergencyContacts = cells.reduce((sum, cell) => sum + cell.evidence.verifiedEmergencyContactCount, 0);
    const publicOffices = cells.reduce((sum, cell) => sum + cell.evidence.verifiedPublicOfficeCount, 0);
    const coordinates = cells.reduce((sum, cell) => sum + cell.evidence.verifiedCoordinatesCount, 0);
    const pendingResearch = cells.some((cell) => cell.operationalStatus !== "VERIFIED") ? "YES" : "NO";
    console.log([
      row.state,
      row.emergencyManagement.operationalStatus,
      row.fire.structuralStatus,
      row.fire.operationalStatus,
      row.ambulanceEms.operationalStatus,
      row.traffic.operationalStatus,
      row.policeCommand.structuralStatus,
      row.policeCommand.operationalStatus,
      row.nscdcCommand.structuralStatus,
      row.nscdcCommand.operationalStatus,
      row.frscCommand.structuralStatus,
      row.frscCommand.operationalStatus,
      emergencyContacts,
      publicOffices,
      coordinates,
      pendingResearch,
    ].join("\t"));
  }

  const coverageCells = coverage.data.flatMap((row) => coverageColumnsForMetrics(row));

  const metrics = {
    agencies: agencies.length,
    independentStateAgencies: agencies.filter((agency) => agency.governmentLevel === "STATE").length,
    federalAgencies: agencies.filter((agency) => agency.governmentLevel === "FEDERAL").length,
    federalFormations: offices.filter((office) => office.agency.governmentLevel === "FEDERAL").length,
    offices: offices.length,
    verifiedContacts: contacts.filter((contact) => contact.verificationStatus === "VERIFIED").length,
    partiallyVerifiedContacts: contacts.filter((contact) => contact.verificationStatus === "PARTIALLY_VERIFIED").length,
    verifiedEmergencyContacts: contacts.filter((contact) => (
      contact.verificationStatus === "VERIFIED" && contact.publiclyVerified && contact.emergencyOnly
    )).length,
    jurisdictions: jurisdictions.length,
    incidentCapabilities: capabilities.length,
    recordsMissingCoordinates: offices.filter((office) => office.latitude == null || office.longitude == null).length,
    recordsMissingPublicAddress: offices.filter((office) => !office.physicalAddress?.trim()).length,
    staleVerificationRecords: freshness.data.filter((finding) => finding.issue === "STALE_VERIFICATION").length,
    recordsMissingProvenance: freshness.data.filter((finding) => finding.issue === "MISSING_PROVENANCE").length,
    duplicateAgencies: duplicateCount(agencies, (agency) => agency.code),
    duplicateOffices: duplicateCount(offices, (office) => `${office.agencyId}|${office.countryId}|${office.name}`),
    duplicateContacts: duplicateCount(contacts, (contact) => `${contact.agencyId}|${contact.officeId ?? ""}|${contact.type}|${contact.value}`),
    duplicateJurisdictions: duplicateCount(jurisdictions, (row) => (
      `${row.agencyId}|${row.officeId ?? ""}|${row.coverageType}|${row.countryId}|${row.stateId ?? ""}|${row.lgaId ?? ""}|${row.wardId ?? ""}`
    )),
    automaticDispatchOrEscalationMappings: capabilities.filter((row) => row.canDispatch || row.canEscalate).length,
    orphanRelationships: Number(orphanResult.count),
    freshnessFindings: freshness.meta.findings,
    structuralCoverageCells: coverageCells.filter((cell) => cell.structuralStatus === "VERIFIED").length,
    operationalCoverageCells: coverageCells.filter((cell) => cell.operationalStatus === "VERIFIED").length,
    routingReadyCoverageCells: coverageCells.filter((cell) => cell.routingReadiness === "READY").length,
  };
  console.log(`METRICS\t${JSON.stringify(metrics)}`);
}

function coverageColumnsForMetrics(row: Record<string, any>) {
  return [
    row.emergencyManagement,
    row.fire,
    row.ambulanceEms,
    row.traffic,
    row.policeCommand,
    row.nscdcCommand,
    row.frscCommand,
  ];
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
