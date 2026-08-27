import type {
  DangerAlertCodeValue,
  DangerClassification,
  DangerSourceType,
} from "@the-eye/shared";

export const DANGER_CLASSIFIER = Symbol("DANGER_CLASSIFIER");

export type DangerClassifierInput = {
  sourceType: DangerSourceType;
  sourceId: string;
  text: string;
  sourceLocale?: string;
  occurredAt?: Date;
  userDeclaredDangerAlertCode?: DangerAlertCodeValue;
};

export type DangerClassifierResult = DangerClassification & {
  provider: string;
  model?: string;
  version: number;
};

export interface DangerClassifier {
  classify(input: DangerClassifierInput): Promise<DangerClassifierResult>;
}
