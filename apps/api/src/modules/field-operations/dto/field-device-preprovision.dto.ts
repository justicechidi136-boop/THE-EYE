export type PreProvisionFieldDeviceDto = {
  deviceName: string;
  operationalRole?: string;
  permissionProfileId?: string;
  assignedTeamId?: string;
  assignedUserId?: string;
  assignedUnitId?: string;
  agencyId?: string;
  countryCode?: string;
  stateCode?: string;
  lgaCode?: string;
  deviceMode?: string;
  activationPolicy?: string;
  activationExpiresAt?: string;
  reviewAt?: string;
  notes?: string;
  inventoryAssetRef?: string;
  permissionOverrides?: string[];
  permissionDenies?: string[];
};

export type UpdateFieldDeviceProvisioningDto = {
  operationalRole?: string;
  permissionProfileId?: string | null;
  assignedTeamId?: string | null;
  deviceMode?: string | null;
  activationPolicy?: string;
  activationExpiresAt?: string | null;
  reviewAt?: string | null;
  notes?: string | null;
  inventoryAssetRef?: string | null;
  permissionOverrides?: string[];
  permissionDenies?: string[];
};
