export type ProfileCompletenessInput = {
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  state?: string | null;
  lga?: string | null;
} | null;

const PLACEHOLDER_FIRST_NAMES = new Set(["Google", "Apple", "Citizen"]);

export function isCitizenProfileComplete(profile: ProfileCompletenessInput): boolean {
  if (!profile) return false;
  const firstName = profile.firstName?.trim() ?? "";
  const lastName = profile.lastName?.trim() ?? "";
  const country = profile.country?.trim() ?? "";
  const state = profile.state?.trim() ?? "";
  const lga = profile.lga?.trim() ?? "";
  if (!firstName || !lastName || !country || !state || !lga) return false;
  if (PLACEHOLDER_FIRST_NAMES.has(firstName) || lastName === "User") return false;
  return true;
}

export function incompleteProfileLocation() {
  return { country: "", state: "", lga: "" };
}
