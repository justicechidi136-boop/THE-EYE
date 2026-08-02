import { redirectLegacyAdminPath } from "../../../lib/admin/legacy-redirect";

export default function LegacyBroadcastsRedirect() {
  redirectLegacyAdminPath("/neighborhood-watch/broadcasts");
}
