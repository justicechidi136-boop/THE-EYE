export class SpeechProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = code;
  }
}

export class UnsupportedSpeechLanguageError extends SpeechProviderError {
  constructor(locale: string, provider: string) {
    super("UNSUPPORTED_LANGUAGE", `${provider} does not support ${locale}`);
  }
}
