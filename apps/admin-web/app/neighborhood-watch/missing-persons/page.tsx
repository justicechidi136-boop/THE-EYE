import { redirectLegacyAdminPath } from "../../../lib/admin/legacy-redirect";

export default function LegacyMissingPersonsRedirect() {
  redirectLegacyAdminPath("/neighborhood-watch/missing-persons");
}
