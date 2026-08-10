export type CreateFieldPermissionProfileDto = {
  code: string;
  name: string;
  description?: string;
  operationalRole?: string;
  permissions: string[];
};

export type UpdateFieldPermissionProfileDto = {
  name?: string;
  description?: string;
  operationalRole?: string;
  permissions?: string[];
};

export type DisableFieldPermissionProfileDto = {
  reason?: string;
};

export type FieldPermissionProfileListQuery = {
  isActive?: string;
  operationalRole?: string;
};

export type FieldPermissionEffectivePreviewQuery = {
  profileId?: string;
  overrides?: string;
  denies?: string;
};
