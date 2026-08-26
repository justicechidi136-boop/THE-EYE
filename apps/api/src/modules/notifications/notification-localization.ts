import {
  DEFAULT_PREFERRED_LOCALE,
  type PreferredLocale,
  effectivePreferredLocale,
  isEnabledPreferredLocale,
} from "@the-eye/shared";
import type { NotificationType } from "./dto/notification.dto";

type NotificationParams = Record<string, string | number | boolean | null>;
type LocalizedTemplate = {
  title: (params: NotificationParams) => string;
  body: (params: NotificationParams) => string;
};
type TemplateBundle = Partial<Record<PreferredLocale, LocalizedTemplate>>;

export type NotificationRecipient = {
  userId?: string;
  adminUserId?: string;
  distanceMeters?: number;
  preferredLocale?: string | null;
};

export type NotificationLocalizationResult = {
  title: string;
  body: string;
  locale: PreferredLocale;
  templateKey: string;
  params: NotificationParams;
  fallbackLocale?: PreferredLocale;
  missingTemplate?: boolean;
};

const templates: Record<string, TemplateBundle> = {
  "emergency.alert": bundle({
    en: ["Emergency alert", "Emergency reported near {areaName}. Follow official instructions."],
    ha: ["Gargadin gaggawa", "An bayar da rahoton gaggawa kusa da {areaName}. Bi umarnin hukuma."],
    yo: ["Ikilo pajawiri", "A royin pajawiri nitosi {areaName}. Tẹle ilana osise."],
    ig: ["Nti mberede", "A kọrọ ihe mberede nso {areaName}. Soro nduzi ndi ochichi."],
    pcm: ["Emergency alert", "Emergency happen near {areaName}. Follow official instruction."],
  }),
  "incident.statusUpdate": bundle({
    en: ["Incident update", "Status update for incident {incidentId}: {status}."],
    ha: ["Sabunta lamari", "Sabunta matsayin lamari {incidentId}: {status}."],
    yo: ["Imudojuiwon iṣẹlẹ", "Imudojuiwon ipo fun iṣẹlẹ {incidentId}: {status}."],
    ig: ["Mmelite ihe omume", "Mmelite onodu maka ihe omume {incidentId}: {status}."],
    pcm: ["Incident update", "Update for incident {incidentId}: {status}."],
  }),
  "danger.armedRobberyNearby": bundle({
    en: ["Armed robbery nearby", "Armed robbery reported near {areaName}, about {distanceMeters}m away."],
    ha: ["Fashi da makami a kusa", "An samu rahoton fashi da makami kusa da {areaName}, kusan mita {distanceMeters}."],
    yo: ["Ole oloro nitosi", "A royin ole oloro nitosi {areaName}, bii mita {distanceMeters} kuro."],
    ig: ["Ohi egbe nso", "A kọrọ ohi egbe nso {areaName}, ihe dika mita {distanceMeters}."],
    pcm: ["Armed robbery dey near", "Armed robbery happen near {areaName}, about {distanceMeters}m away."],
  }),
  "danger.generalNearby": bundle({
    en: ["Danger nearby", "Safety alert near {areaName}. Keep away from the area."],
    ha: ["Hadari a kusa", "Gargadin tsaro kusa da {areaName}. Ka nisanci yankin."],
    yo: ["Ewu nitosi", "Ikilo aabo nitosi {areaName}. Yago fun agbegbe naa."],
    ig: ["Ihe egwu nso", "Nti nchekwa nso {areaName}. Zere mpaghara ahu."],
    pcm: ["Danger dey near", "Safety alert near {areaName}. No go that side."],
  }),
  "missingPerson.alert": bundle({
    en: ["Missing person alert", "Help find {personName}. Last seen near {areaName}."],
    ha: ["Sanarwar bataccen mutum", "A taimaka a nemo {personName}. An ganshi na karshe kusa da {areaName}."],
    yo: ["Ikilo eni ti o sonu", "E jowo ran wa lowo lati wa {personName}. Won ri i kẹhin nitosi {areaName}."],
    ig: ["Nti onye efuru", "Biko nyere aka chota {personName}. A huru ya ikpeazu nso {areaName}."],
    pcm: ["Missing person alert", "Help find {personName}. Dem last see am near {areaName}."],
  }),
  "stolenVehicle.alert": bundle({
    en: ["Stolen vehicle alert", "Watch for {vehicleDescription} with plate {plateNumber}."],
    ha: ["Sanarwar motar da aka sace", "A kula da {vehicleDescription} mai lamba {plateNumber}."],
    yo: ["Ikilo oko ti won ji", "Wo fun {vehicleDescription} pelu nomba awo {plateNumber}."],
    ig: ["Nti ugbo ala ezuru", "Lezie anya maka {vehicleDescription} nwere plate {plateNumber}."],
    pcm: ["Stolen vehicle alert", "Look out for {vehicleDescription} with plate {plateNumber}."],
  }),
  "sighting.alert": bundle({
    en: ["New sighting", "A sighting was reported near {areaName}."],
    ha: ["Sabon gani", "An bayar da rahoton gani kusa da {areaName}."],
    yo: ["Ariyanjiyan tuntun", "A royin ohun ti a ri nitosi {areaName}."],
    ig: ["Ihe ahuru ohuru", "A kọrọ ihe ahuru nso {areaName}."],
    pcm: ["New sighting", "Person report sighting near {areaName}."],
  }),
  "sighting.missingPerson": bundle({
    en: ["Missing person sighting", "A possible sighting of {personName} was reported."],
    ha: ["An ga mutumin da ya bata", "An bayar da rahoton yiwuwar ganin {personName}."],
    yo: ["A ri eni ti o sonu", "A royin pe o seese ki won ti ri {personName}."],
    ig: ["Ahuru onye efuru", "A kọrọ na enwere ike ihuru {personName}."],
    pcm: ["Missing person sighting", "Person report say dem fit don see {personName}."],
  }),
  "sighting.stolenVehicle": bundle({
    en: ["Stolen vehicle sighting", "A possible sighting of {vehicleDescription}, plate {plateNumber}, was reported."],
    ha: ["An ga motar da aka sace", "An bayar da rahoton yiwuwar ganin {vehicleDescription}, mai lamba {plateNumber}."],
    yo: ["A ri oko ti won ji", "A royin pe o seese ki won ti ri {vehicleDescription}, pelu nomba awo {plateNumber}."],
    ig: ["Ahuru ugbo ala ezuru", "A kọrọ na enwere ike ihuru {vehicleDescription}, nwere plate {plateNumber}."],
    pcm: ["Stolen vehicle sighting", "Person report say dem fit don see {vehicleDescription}, plate {plateNumber}."],
  }),
  "broadcast.alert": bundle({
    en: ["Broadcast update", "{broadcastTitle}"],
    ha: ["Sabunta watsawa", "{broadcastTitle}"],
    yo: ["Imudojuiwon ikede", "{broadcastTitle}"],
    ig: ["Mmelite mgbasa ozi", "{broadcastTitle}"],
    pcm: ["Broadcast update", "{broadcastTitle}"],
  }),
  "neighborhoodWatch.alert": bundle({
    en: ["Neighborhood Watch", "{communityName}: {message}"],
    ha: ["Tsaron Unguwa", "{communityName}: {message}"],
    yo: ["Aabo Adugbo", "{communityName}: {message}"],
    ig: ["Nche Obodo", "{communityName}: {message}"],
    pcm: ["Neighborhood Watch", "{communityName}: {message}"],
  }),
  "field.assignment": bundle({
    en: ["Field assignment", "You have been assigned to incident {incidentId}."],
    ha: ["Aikin fili", "An baka aiki kan lamari {incidentId}."],
    yo: ["Iṣẹ aaye", "A ti yan ọ si iṣẹlẹ {incidentId}."],
    ig: ["Ọrụ ubi", "E kenyela gi ihe omume {incidentId}."],
    pcm: ["Field assignment", "Dem assign you to incident {incidentId}."],
  }),
  "field.backupRequest": bundle({
    en: ["Backup requested", "Backup requested for assignment {assignmentId}."],
    ha: ["An nemi karin taimako", "An nemi karin taimako ga aiki {assignmentId}."],
    yo: ["A beere iranlowo", "A beere iranlowo fun iṣẹ {assignmentId}."],
    ig: ["A choro nkwado", "A choro nkwado maka oru {assignmentId}."],
    pcm: ["Backup requested", "Dem request backup for assignment {assignmentId}."],
  }),
  "officer.safety": bundle({
    en: ["Officer safety alert", "Officer safety alert from {officerName}."],
    ha: ["Gargadin tsaron jami'i", "Gargadin tsaron jami'i daga {officerName}."],
    yo: ["Ikilo aabo osise", "Ikilo aabo osise lati odo {officerName}."],
    ig: ["Nti nchekwa onye oru", "Nti nchekwa onye oru sitere na {officerName}."],
    pcm: ["Officer safety alert", "Officer safety alert from {officerName}."],
  }),
  "admin.operational": bundle({
    en: ["Operational alert", "{message}"],
    ha: ["Gargadin aiki", "{message}"],
    yo: ["Ikilo iṣiṣẹ", "{message}"],
    ig: ["Nti oru", "{message}"],
    pcm: ["Operational alert", "{message}"],
  }),
};

export function localizeNotification(input: {
  type: NotificationType | string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  recipientPreferredLocale?: string | null;
}): NotificationLocalizationResult {
  const locale = effectivePreferredLocale(input.recipientPreferredLocale);
  const params = extractNotificationParams(input);
  const templateKey = resolveNotificationTemplateKey(input.type, input.metadata);
  const template = templates[templateKey];

  if (!template) {
    return {
      title: input.title,
      body: input.body,
      locale,
      templateKey,
      params,
      fallbackLocale: DEFAULT_PREFERRED_LOCALE,
      missingTemplate: true,
    };
  }

  const localized = template[locale] ?? template[DEFAULT_PREFERRED_LOCALE];
  const fallbackLocale = template[locale] ? undefined : DEFAULT_PREFERRED_LOCALE;
  if (!localized) {
    return {
      title: input.title,
      body: input.body,
      locale,
      templateKey,
      params,
      fallbackLocale: DEFAULT_PREFERRED_LOCALE,
      missingTemplate: true,
    };
  }

  return {
    title: localized.title(params),
    body: localized.body(params),
    locale,
    templateKey,
    params,
    fallbackLocale,
  };
}

export function groupNotificationRecipientsByLocale<T extends NotificationRecipient>(
  recipients: readonly T[],
): Map<PreferredLocale, T[]> {
  const grouped = new Map<PreferredLocale, T[]>();
  for (const recipient of recipients) {
    const locale = effectivePreferredLocale(recipient.preferredLocale);
    grouped.set(locale, [...(grouped.get(locale) ?? []), recipient]);
  }
  return grouped;
}

export function toNotificationLocalizationMetadata(result: NotificationLocalizationResult) {
  return {
    notificationTemplateKey: result.templateKey,
    notificationLocale: result.locale,
    notificationParams: result.params,
    ...(result.fallbackLocale ? { notificationFallbackLocale: result.fallbackLocale } : {}),
    ...(result.missingTemplate ? { notificationLocalizationMissingTemplate: true } : {}),
  };
}

export function resolveNotificationTemplateKey(
  type: NotificationType | string,
  metadata?: Record<string, unknown> | null,
): string {
  const explicit = stringParam(metadata?.notificationTemplateKey) ?? stringParam(metadata?.templateKey);
  if (explicit) return explicit;

  const dangerCode = stringParam((metadata?.dangerAlert as Record<string, unknown> | undefined)?.alertCode)
    ?? stringParam(metadata?.dangerAlertCode)
    ?? stringParam(metadata?.alertCode);
  if (dangerCode === "DANGER_ZONE_ARMED_ROBBERY_NEARBY") return "danger.armedRobberyNearby";
  if (dangerCode?.startsWith("DANGER_ZONE_")) return "danger.generalNearby";

  const routeType = stringParam(metadata?.routeType);
  const notificationType = stringParam(metadata?.notificationType);
  if (routeType?.startsWith("NW_")) return "neighborhoodWatch.alert";
  if (notificationType === "FIELD_BACKUP_REQUEST") return "field.backupRequest";
  if (notificationType === "FIELD_OFFICER_SAFETY_ALERT") return "officer.safety";

  switch (type) {
    case "EmergencyAlert":
    case "FamilySosAlert":
      return "emergency.alert";
    case "IncidentStatusUpdate":
    case "IncidentMessageReceived":
    case "IncidentInformationRequest":
      return "incident.statusUpdate";
    case "NearbyDangerWarning":
      return "danger.generalNearby";
    case "MissingPersonAlert":
      return "missingPerson.alert";
    case "StolenVehicleAlert":
      return "stolenVehicle.alert";
    case "BroadcastSightingAlert":
      return "sighting.alert";
    case "BroadcastAlert":
      return "broadcast.alert";
    case "AdminAssignmentAlert":
      return "field.assignment";
    default:
      return "admin.operational";
  }
}

function bundle(input: Record<PreferredLocale, [string, string]>): TemplateBundle {
  return Object.fromEntries(
    Object.entries(input).map(([locale, [title, body]]) => [
      locale,
      {
        title: (params: NotificationParams) => render(title, params),
        body: (params: NotificationParams) => render(body, params),
      },
    ]),
  ) as TemplateBundle;
}

function render(template: string, params: NotificationParams) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => {
    const value = params[key];
    if (value === null || value === undefined || value === "") return fallbackParam(key);
    return String(value);
  });
}

function extractNotificationParams(input: {
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
}) {
  const metadata = input.metadata ?? {};
  const nested = metadata.notificationParams;
  const params: NotificationParams = {
    areaName: "your area",
    distanceMeters: stringOrNumber(metadata.distanceMeters) ?? "",
    status: stringParam(metadata.status) ?? "updated",
    incidentId: stringParam(metadata.incidentId) ?? "",
    broadcastTitle: stringParam(metadata.broadcastTitle) ?? input.title,
    message: stringParam(metadata.message) ?? input.body,
    personName: stringParam(metadata.personName) ?? "this person",
    vehicleDescription: stringParam(metadata.vehicleDescription) ?? "the vehicle",
    plateNumber: stringParam(metadata.plateNumber) ?? stringParam(metadata.vehicleRegistration) ?? "",
    communityName: stringParam(metadata.communityName) ?? "Community",
    assignmentId: stringParam(metadata.assignmentId) ?? "",
    officerName: stringParam(metadata.officerName) ?? "officer",
  };

  if (metadata.dangerAlert && typeof metadata.dangerAlert === "object") {
    const dangerAlert = metadata.dangerAlert as Record<string, unknown>;
    params.areaName = stringParam(dangerAlert.areaName) ?? params.areaName;
    params.distanceMeters = stringOrNumber(dangerAlert.distanceMeters) ?? params.distanceMeters;
    params.incidentId = stringParam(dangerAlert.incidentId) ?? params.incidentId;
  }

  if (nested && typeof nested === "object") {
    for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
      if (isPrimitiveParam(value)) params[key] = value;
    }
  }

  return params;
}

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringOrNumber(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return stringParam(value);
}

function isPrimitiveParam(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function fallbackParam(key: string) {
  if (key === "areaName") return "your area";
  if (key === "distanceMeters") return "nearby";
  return "";
}

export function normalizeNotificationLocale(value: string | null | undefined): PreferredLocale {
  return isEnabledPreferredLocale(value) ? value : DEFAULT_PREFERRED_LOCALE;
}
