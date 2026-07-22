import type { NotificationDispatchResult } from "./notification.types";

export type DeliveryLogStatus =
  | "Queued"
  | "Processing"
  | "ProviderAccepted"
  | "DeviceReceived"
  | "Delivered"
  | "Failed"
  | "Retrying"
  | "InvalidToken";

export type LegacyNotificationStatus = "Pending" | "Sent" | "Delivered" | "Failed" | "Read";

export function mapProviderResultToDeliveryLogStatus(result: NotificationDispatchResult): DeliveryLogStatus {
  if (result.responsePayload?.simulated) return "Failed";
  if (result.provider === "in-app") return "Delivered";
  if (result.status === "Delivered") return "Delivered";
  return "ProviderAccepted";
}

export function mapProviderResultToNotificationStatus(result: NotificationDispatchResult): LegacyNotificationStatus {
  if (result.responsePayload?.simulated) return "Failed";
  if (result.provider === "in-app" || result.status === "Delivered") return "Delivered";
  return "Sent";
}

export function mapBroadcastDeliveryStatusFromProvider(result: NotificationDispatchResult): "Sent" | "Delivered" | "Failed" {
  if (result.responsePayload?.simulated) return "Failed";
  if (result.status === "Delivered") return "Delivered";
  return "Sent";
}
