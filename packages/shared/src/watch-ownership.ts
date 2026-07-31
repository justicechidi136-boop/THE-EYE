/** Watch ownership and inventory lifecycle states. */
export const WatchOwnershipStatus = {
  UnassignedInventory: "UNASSIGNED_INVENTORY",
  PersonOwned: "PERSON_OWNED",
  OrganizationOwned: "ORGANIZATION_OWNED",
  OrganizationAssignedToPerson: "ORGANIZATION_ASSIGNED_TO_PERSON",
  Transferred: "TRANSFERRED",
  Retired: "RETIRED",
  LostOrStolen: "LOST_OR_STOLEN",
  ReplacementPending: "REPLACEMENT_PENDING",
} as const;

export type WatchOwnershipStatusValue =
  (typeof WatchOwnershipStatus)[keyof typeof WatchOwnershipStatus];

export const WatchOwnerType = {
  UnassignedInventory: "UNASSIGNED_INVENTORY",
  Person: "PERSON",
  Organization: "ORGANIZATION",
} as const;

export type WatchOwnerTypeValue = (typeof WatchOwnerType)[keyof typeof WatchOwnerType];

export const WatchAssignmentStatus = {
  Unassigned: "UNASSIGNED",
  Assigned: "ASSIGNED",
  Temporary: "TEMPORARY",
  Custodian: "CUSTODIAN",
} as const;

export type WatchAssignmentStatusValue =
  (typeof WatchAssignmentStatus)[keyof typeof WatchAssignmentStatus];

export const WatchInventoryStatus = {
  InStock: "IN_STOCK",
  InTransit: "IN_TRANSIT",
  Deployed: "DEPLOYED",
  Returned: "RETURNED",
  Retired: "RETIRED",
  LostOrStolen: "LOST_OR_STOLEN",
  ReplacementPending: "REPLACEMENT_PENDING",
} as const;

export type WatchInventoryStatusValue =
  (typeof WatchInventoryStatus)[keyof typeof WatchInventoryStatus];

export const WatchBulkOperationType = {
  Assign: "ASSIGN",
  Unassign: "UNASSIGN",
  Transfer: "TRANSFER",
  UpdateConfig: "UPDATE_CONFIG",
  FirmwareCampaign: "FIRMWARE_CAMPAIGN",
  ExportInventory: "EXPORT_INVENTORY",
  MarkLostOrStolen: "MARK_LOST_OR_STOLEN",
  Retire: "RETIRE",
} as const;

export type WatchBulkOperationTypeValue =
  (typeof WatchBulkOperationType)[keyof typeof WatchBulkOperationType];

export const WATCH_OWNERSHIP_BLOCKED_STATUSES: WatchOwnershipStatusValue[] = [
  WatchOwnershipStatus.LostOrStolen,
  WatchOwnershipStatus.Retired,
];
