import { publicApiBaseUrl, publicAppEnvBadgeTone, publicAppEnvLabel } from "../lib/public-env.client";
import { StatusBadge } from "./ui";

export function EnvironmentBadge() {
  return (
    <StatusBadge tone={publicAppEnvBadgeTone} title={`API base: ${publicApiBaseUrl}`}>
      {publicAppEnvLabel}
    </StatusBadge>
  );
}
