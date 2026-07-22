import { EmergencyCategory, IncidentPriority, IncidentType } from "@the-eye/shared";

export type ClassifiedEmergency = {
  category: EmergencyCategory;
  incidentType: IncidentType;
  priority: IncidentPriority;
  silent: boolean;
  title: string;
  suggestedAgencyTypes: string[];
};

const categoryToIncidentType: Record<EmergencyCategory, IncidentType> = {
  [EmergencyCategory.SecurityCrime]: IncidentType.Crime,
  [EmergencyCategory.Medical]: IncidentType.Medical,
  [EmergencyCategory.Fire]: IncidentType.Fire,
  [EmergencyCategory.RoadTraffic]: IncidentType.Accident,
  [EmergencyCategory.DomesticViolence]: IncidentType.Abuse,
  [EmergencyCategory.Kidnapping]: IncidentType.Kidnapping,
  [EmergencyCategory.MissingPerson]: IncidentType.MissingPerson,
  [EmergencyCategory.NaturalDisaster]: IncidentType.Emergency,
  [EmergencyCategory.SilentSos]: IncidentType.SOS,
  [EmergencyCategory.Other]: IncidentType.Emergency,
};

const categoryAgencyTypes: Record<EmergencyCategory, string[]> = {
  [EmergencyCategory.SecurityCrime]: ["police", "nscdc", "private_security"],
  [EmergencyCategory.Medical]: ["ambulance", "hospital_emergency"],
  [EmergencyCategory.Fire]: ["fire_service", "emergency_management"],
  [EmergencyCategory.RoadTraffic]: ["frsc", "police", "ambulance"],
  [EmergencyCategory.DomesticViolence]: ["police", "nscdc"],
  [EmergencyCategory.Kidnapping]: ["police", "nscdc"],
  [EmergencyCategory.MissingPerson]: ["police", "nscdc"],
  [EmergencyCategory.NaturalDisaster]: ["emergency_management", "fire_service", "ambulance"],
  [EmergencyCategory.SilentSos]: ["police", "nscdc"],
  [EmergencyCategory.Other]: ["police", "emergency_management"],
};

const categoryPriority: Record<EmergencyCategory, IncidentPriority> = {
  [EmergencyCategory.SecurityCrime]: IncidentPriority.P2ActiveCrimeAccident,
  [EmergencyCategory.Medical]: IncidentPriority.P1LifeThreatening,
  [EmergencyCategory.Fire]: IncidentPriority.P1LifeThreatening,
  [EmergencyCategory.RoadTraffic]: IncidentPriority.P2ActiveCrimeAccident,
  [EmergencyCategory.DomesticViolence]: IncidentPriority.P1LifeThreatening,
  [EmergencyCategory.Kidnapping]: IncidentPriority.P1LifeThreatening,
  [EmergencyCategory.MissingPerson]: IncidentPriority.P2ActiveCrimeAccident,
  [EmergencyCategory.NaturalDisaster]: IncidentPriority.P1LifeThreatening,
  [EmergencyCategory.SilentSos]: IncidentPriority.P1LifeThreatening,
  [EmergencyCategory.Other]: IncidentPriority.P2ActiveCrimeAccident,
};

export function classifyEmergencyCategory(category: EmergencyCategory, silent = false): ClassifiedEmergency {
  const incidentType = categoryToIncidentType[category];
  return {
    category,
    incidentType,
    priority: categoryPriority[category],
    silent: silent || category === EmergencyCategory.SilentSos,
    title: silent || category === EmergencyCategory.SilentSos ? "Silent SOS" : `${incidentType} emergency`,
    suggestedAgencyTypes: categoryAgencyTypes[category],
  };
}

export function incidentTypeAgencyTypes(type: IncidentType): string[] {
  switch (type) {
    case IncidentType.Crime:
    case IncidentType.SuspiciousActivity:
    case IncidentType.SOS:
      return ["police", "nscdc", "private_security"];
    case IncidentType.Medical:
      return ["ambulance", "hospital_emergency"];
    case IncidentType.Fire:
      return ["fire_service", "emergency_management"];
    case IncidentType.Accident:
      return ["frsc", "police", "ambulance"];
    case IncidentType.Abuse:
      return ["police", "nscdc"];
    case IncidentType.Kidnapping:
    case IncidentType.MissingPerson:
      return ["police", "nscdc"];
    case IncidentType.Emergency:
      return ["emergency_management", "fire_service", "ambulance", "police"];
    default:
      return ["police", "emergency_management"];
  }
}
