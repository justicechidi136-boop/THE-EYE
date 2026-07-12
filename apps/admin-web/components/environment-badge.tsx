import { publicApiBaseUrl, publicAppEnvBadgeTone, publicAppEnvLabel } from "../lib/public-env";
import { StatusBadge } from "./ui";

export function EnvironmentBadge() {
  return (
    <StatusBadge tone={publicAppEnvBadgeTone} title={`API base: ${publicApiBaseUrl}`}>
      {publicAppEnvLabel}
    </StatusBadge>
  );
}
