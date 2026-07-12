export class NotificationDispatchError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable = true,
    readonly responsePayload?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NotificationDispatchError";
  }
}
