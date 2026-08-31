import { readFile } from "node:fs/promises";
import { AGENCY_TYPES, IncidentType } from "@the-eye/shared";

const officeTypes = new Set([
  "HEADQUARTERS", "COMMAND", "FORMATION", "DIVISION", "STATION", "ZONAL_OFFICE",
  "STATE_OFFICE", "LOCAL_OFFICE", "OTHER",
]);
const contactTypes = new Set([
  "PHONE", "EMERGENCY_PHONE", "TOLL_FREE", "SMS", "WHATSAPP", "EMAIL", "WEBSITE",
  "REPORTING_PORTAL", "SOCIAL_MEDIA_OFFICIAL",
]);
const phoneTypes = new Set(["PHONE", "EMERGENCY_PHONE", "WHATSAPP"]);
const shortCodeTypes = new Set(["TOLL_FREE", "SMS"]);
const urlTypes = new Set(["WEBSITE", "REPORTING_PORTAL", "SOCIAL_MEDIA_OFFICIAL"]);
const incidentTypes = new Set<string>(Object.values(IncidentType));

export type AgencySeed = {
  code: string;
  governmentLevel?: "FEDERAL" | "STATE";
  stateName?: string;
  verificationStatus?: "VERIFIED" | "PARTIALLY_VERIFIED";
  officialName: string;
  shortName: string;
  aliases: string[];
  description: string;
  type: string;
  website?: string;
  sourceUrl: string;
  office?: AgencyOfficeSeed;
  contacts: AgencyContactSeed[];
  incidentTypes: string[];
};

export type AgencyContactSeed = {
  type: string;
  value: string;
  label: string;
  emergencyOnly?: boolean;
  emergencyUseVerified?: boolean;
  sourceUrl: string;
};

export type AgencyOfficeSeed = {
  name: string;
  address?: string;
  type: string;
  is24Hours?: boolean;
};

export type FederalFormationSeed = {
  parentAgencyCode: string;
  stateName: string;
  name: string;
  type: string;
  address?: string;
  sourceUrl: string;
  verificationStatus?: "VERIFIED" | "PARTIALLY_VERIFIED";
  contacts: AgencyContactSeed[];
};

export type FederalFormationGroupSeed = {
  parentAgencyCode: string;
  type: string;
  sourceUrl: string;
  verificationStatus?: "VERIFIED" | "PARTIALLY_VERIFIED";
  formations: Array<{
    name: string;
    officeStateName?: string;
    jurisdictionStateNames: string[];
    address?: string;
    contacts?: AgencyContactSeed[];
  }>;
};

export type NormalizedFederalFormationSeed = Omit<FederalFormationSeed, "stateName"> & {
  officeStateName?: string;
  jurisdictionStateNames: string[];
};

export type AgencySeedDocument = {
  countryCode: string;
  retrievedAt: string;
  agencies: AgencySeed[];
  federalFormations?: FederalFormationSeed[];
  federalFormationGroups?: FederalFormationGroupSeed[];
};

export async function loadAgencySeed(path: string): Promise<AgencySeedDocument> {
  return JSON.parse(await readFile(path, "utf8")) as AgencySeedDocument;
}

export function validateAgencySeed(document: AgencySeedDocument): string[] {
  const errors: string[] = [];
  const codes = new Set<string>();
  const formationKeys = new Set<string>();
  if (document.countryCode !== "NG") errors.push("Agency seed countryCode must be NG");
  if (Number.isNaN(Date.parse(document.retrievedAt))) errors.push("Agency seed retrievedAt is invalid");

  for (const agency of document.agencies) {
    if (!agency.code.trim() || codes.has(agency.code)) errors.push(`${agency.code || "<blank>"}: duplicate or blank code`);
    codes.add(agency.code);
    if (!agency.officialName.trim() || !agency.shortName.trim()) errors.push(`${agency.code}: missing official/short name`);
    if (!(AGENCY_TYPES as readonly string[]).includes(agency.type)) errors.push(`${agency.code}: unknown agency type ${agency.type}`);
    const governmentLevel = agency.governmentLevel ?? "FEDERAL";
    if (governmentLevel === "STATE" && !agency.stateName?.trim()) {
      errors.push(`${agency.code}: State agency requires stateName`);
    }
    if (governmentLevel === "FEDERAL" && agency.stateName) {
      errors.push(`${agency.code}: Federal agency cannot declare stateName`);
    }
    if (agency.office && !officeTypes.has(agency.office.type)) errors.push(`${agency.code}: unknown office type ${agency.office.type}`);
    if (!agency.description.trim() || (agency.office && !agency.office.name.trim())) {
      errors.push(`${agency.code}: missing public description or office identity`);
    }
    if ((agency.website && !isSecureUrl(agency.website)) || !isSecureUrl(agency.sourceUrl)) {
      errors.push(`${agency.code}: website/source must use HTTPS when present`);
    }
    if ((agency.verificationStatus ?? "VERIFIED") === "VERIFIED" && agency.incidentTypes.length === 0) {
      errors.push(`${agency.code}: verified agency has no evidenced incident capabilities`);
    }
    for (const incidentType of agency.incidentTypes) {
      if (!incidentTypes.has(incidentType)) errors.push(`${agency.code}: unknown incident type ${incidentType}`);
    }
    validateContacts(agency.code, agency.contacts, errors);
  }

  for (const formation of normalizeFederalFormations(document)) {
    const key = `${formation.parentAgencyCode}:${formation.jurisdictionStateNames.join("|")}:${formation.name}`;
    if (formationKeys.has(key)) errors.push(`${key}: duplicate federal formation`);
    formationKeys.add(key);
    if (!formation.parentAgencyCode.trim() || formation.jurisdictionStateNames.length === 0 || !formation.name.trim()) {
      errors.push(`${key}: missing parent agency, canonical jurisdiction, or formation name`);
    }
    if (formation.jurisdictionStateNames.some((stateName) => !stateName.trim())) {
      errors.push(`${key}: blank canonical jurisdiction`);
    }
    if (new Set(formation.jurisdictionStateNames).size !== formation.jurisdictionStateNames.length) {
      errors.push(`${key}: duplicate canonical jurisdiction`);
    }
    if (!officeTypes.has(formation.type)) errors.push(`${key}: unknown office type ${formation.type}`);
    if (!isSecureUrl(formation.sourceUrl)) errors.push(`${key}: formation lacks HTTPS provenance`);
    validateContacts(key, formation.contacts, errors);
  }
  return errors;
}

export function normalizeFederalFormations(
  document: AgencySeedDocument,
): NormalizedFederalFormationSeed[] {
  return [
    ...(document.federalFormations ?? []).map((formation) => ({
      parentAgencyCode: formation.parentAgencyCode,
      name: formation.name,
      type: formation.type,
      address: formation.address,
      sourceUrl: formation.sourceUrl,
      verificationStatus: formation.verificationStatus,
      contacts: formation.contacts,
      officeStateName: formation.stateName,
      jurisdictionStateNames: [formation.stateName],
    })),
    ...(document.federalFormationGroups ?? []).flatMap((group) => group.formations.map((formation) => ({
      parentAgencyCode: group.parentAgencyCode,
      name: formation.name,
      type: group.type,
      address: formation.address,
      sourceUrl: group.sourceUrl,
      verificationStatus: group.verificationStatus,
      contacts: formation.contacts ?? [],
      officeStateName: formation.officeStateName,
      jurisdictionStateNames: formation.jurisdictionStateNames,
    }))),
  ];
}

function validateContacts(owner: string, contacts: AgencyContactSeed[], errors: string[]) {
  const contactKeys = new Set<string>();
  for (const contact of contacts) {
    const key = `${contact.type}:${contact.value}`;
    if (!contact.value.trim() || contactKeys.has(key)) errors.push(`${owner}: duplicate or blank contact ${key}`);
    contactKeys.add(key);
    if (!contactTypes.has(contact.type)) errors.push(`${owner}: unknown contact type ${contact.type}`);
    if (phoneTypes.has(contact.type) && !/^\+[1-9]\d{7,14}$/.test(contact.value)) {
      errors.push(`${owner}: invalid public phone ${contact.label}`);
    }
    if (shortCodeTypes.has(contact.type) && !/^(?:\d{3,6}|\+[1-9]\d{7,14})$/.test(contact.value)) {
      errors.push(`${owner}: invalid public short code ${contact.label}`);
    }
    if (contact.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value)) {
      errors.push(`${owner}: invalid public email ${contact.label}`);
    }
    if (urlTypes.has(contact.type) && !isSecureUrl(contact.value)) {
      errors.push(`${owner}: invalid public URL ${contact.label}`);
    }
    if ((contact.emergencyOnly || contact.type === "EMERGENCY_PHONE") && !contact.emergencyUseVerified) {
      errors.push(`${owner}: emergency contact ${contact.label} lacks explicit classification evidence`);
    }
    if (!isSecureUrl(contact.sourceUrl)) errors.push(`${owner}: public contact lacks HTTPS provenance`);
  }
}

function isSecureUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
