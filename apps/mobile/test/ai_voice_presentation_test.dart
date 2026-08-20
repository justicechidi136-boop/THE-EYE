import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/voice/ai_voice_service.dart";

void main() {
  test("AI voice contract preserves original and labels derived content", () {
    final voice = AiVoicePresentation.fromJson({
      "mediaId": "media-1",
      "original": {
        "provenance": "ORIGINAL",
        "signedUrl": "https://storage.example/original",
        "locale": "ha",
      },
      "transcript": {
        "provenance": "TRANSCRIPT",
        "status": "COMPLETED",
        "sourceLocale": "ha",
        "text": "Ina bukatar taimako",
      },
      "translation": {
        "provenance": "TRANSLATION",
        "targetLocale": "en",
        "text": "I need help",
      },
      "synthesis": {
        "provenance": "SYNTHESIZED_SPEECH",
        "label": "AI translated audio",
        "status": "COMPLETED",
        "signedUrl": "https://storage.example/derived",
      },
    });

    expect(voice.originalUrl, contains("original"));
    expect(voice.originalLocale, "ha");
    expect(voice.transcript, "Ina bukatar taimako");
    expect(voice.translation, "I need help");
    expect(voice.targetLocale, "en");
    expect(voice.synthesisUrl, contains("derived"));
  });

  test("provider failure status never removes original playback", () {
    final voice = AiVoicePresentation.fromJson({
      "mediaId": "media-2",
      "original": {
        "provenance": "ORIGINAL",
        "signedUrl": "https://storage.example/original-2",
      },
      "transcript": {
        "provenance": "TRANSCRIPT",
        "status": "FAILED",
      },
    });

    expect(voice.transcriptStatus, "FAILED");
    expect(voice.originalUrl, contains("original-2"));
  });
}
