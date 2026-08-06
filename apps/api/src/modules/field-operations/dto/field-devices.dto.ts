export type RegisterFieldDeviceDto = {
  challengeId: string;
  challenge: string;
  challengeSignature: string;
  publicKey: string;
  installationIdHash: string;
  serialHash?: string;
  deviceName: string;
  manufacturer?: string;
  model?: string;
  androidVersion?: string;
  appVersion?: string;
  buildNumber?: string;
  packageName?: string;
  appEnvironment?: string;
  metadata?: Record<string, unknown>;
};

export type CompleteFieldPairingDto = {
  publicDeviceId: string;
  challengeId: string;
  challenge: string;
  challengeSignature: string;
};

export type FieldDeviceRegistrationStatusQuery = {
  publicDeviceId?: string;
  installationIdHash?: string;
};

export type FieldDeviceHeartbeatDto = {
  appVersion?: string;
  androidVersion?: string;
  buildNumber?: string;
  batteryLevel?: number;
  chargingState?: string;
  networkType?: string;
  notificationPermission?: string;
  locationPermission?: string;
  cameraPermission?: string;
  microphonePermission?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  isRootRiskDetected?: boolean;
  lastSyncAt?: string;
  activeMode?: string;
  crashCount?: number;
};

export type FieldLoginDto = {
  email: string;
  password: string;
  publicDeviceId: string;
  challengeId: string;
  challenge: string;
  challengeSignature: string;
  packageName?: string;
  appEnvironment?: string;
};

export type FieldRefreshDto = {
  refreshToken: string;
  publicDeviceId: string;
};

export type FieldDeviceAdminActionDto = {
  reason?: string;
  note?: string;
  assignedUserId?: string;
  assignedUnitId?: string;
};
