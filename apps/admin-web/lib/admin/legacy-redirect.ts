import { redirect } from "next/navigation";
import { resolveCanonicalPath } from "./admin-route-registry";

/** Redirect legacy admin paths to their canonical management console. */
export function redirectLegacyAdminPath(path: string): never {
  redirect(resolveCanonicalPath(path));
}
