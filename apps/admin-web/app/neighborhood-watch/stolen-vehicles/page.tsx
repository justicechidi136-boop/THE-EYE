import { redirectLegacyAdminPath } from "../../../lib/admin/legacy-redirect";

export default function LegacyStolenVehiclesRedirect() {
  redirectLegacyAdminPath("/neighborhood-watch/stolen-vehicles");
}
