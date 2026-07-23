export type ProviderDeliveryResult = {
  provider: string;
  providerMessageId?: string;
  status: "ProviderAccepted" | "Failed";
  retryable: boolean;
  metadata?: Record<string, unknown>;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SmsMessage = {
  to: string;
  text: string;
  purpose?: string;
};
