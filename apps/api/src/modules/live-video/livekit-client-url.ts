import { LiveVideoErrorCode } from "./live-video.errors";

const INTERNAL_HOST_PATTERN =
  /^wss?:\/\/(?:livekit|localhost|127\.0\.0\.1|api|admin-web)(?:[:/]|$)/i;
const PRIVATE_IPV4_PATTERN =
  /^wss?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i;

export class LiveKitClientUrlError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LiveKitClientUrlError";
  }
}

export function assertClientLivekitUrl(
  rawUrl: string,
  options: { requireWss?: boolean } = {},
): string {
  const url = String(rawUrl ?? "").trim();
  if (!url) {
    throw new LiveKitClientUrlError(
      LiveVideoErrorCode.CLIENT_LIVEKIT_URL_INVALID,
      "NEXT_PUBLIC_LIVEKIT_URL is required for client live video",
    );
  }
  if (options.requireWss !== false && !url.startsWith("wss://")) {
    throw new LiveKitClientUrlError(
      LiveVideoErrorCode.CLIENT_LIVEKIT_URL_INVALID,
      "Client LiveKit URL must use wss:// for staging and production",
    );
  }
  if (INTERNAL_HOST_PATTERN.test(url) || PRIVATE_IPV4_PATTERN.test(url)) {
    throw new LiveKitClientUrlError(
      LiveVideoErrorCode.CLIENT_LIVEKIT_URL_INVALID,
      "Client LiveKit URL must not use container hostnames or private addresses",
    );
  }
  return url.replace(/\/+$/, "");
}
