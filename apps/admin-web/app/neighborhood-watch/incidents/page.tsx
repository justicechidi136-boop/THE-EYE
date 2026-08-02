import { redirectLegacyAdminPath } from "../../../lib/admin/legacy-redirect";

export default function LegacyIncidentCentreRedirect() {
  redirectLegacyAdminPath("/neighborhood-watch/incidents");
}
