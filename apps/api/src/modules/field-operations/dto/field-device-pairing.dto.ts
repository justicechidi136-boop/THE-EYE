export type IssuePairingCodeDto = {
  ttlMinutes?: number;
};

export type CancelPairingDto = {
  reason?: string;
};

export type ClaimFieldPairingDto = {
  pairingToken?: string;
  shortCode?: string;
};

export type FieldPairingChallengeDto = {
  pairingToken?: string;
  shortCode?: string;
};

export type CompleteFieldPairingClaimDto = {
  pairingToken?: string;
  shortCode?: string;
  challengeId: string;
  challenge: string;
  challengeSignature: string;
  publicKey: string;
  installationIdHash: string;
  serialHash?: string;
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  androidVersion?: string;
  appVersion?: string;
  buildNumber?: string;
  packageName?: string;
  appEnvironment?: string;
};

export type FieldPairingStatusQuery = {
  pairingToken?: string;
  shortCode?: string;
};
