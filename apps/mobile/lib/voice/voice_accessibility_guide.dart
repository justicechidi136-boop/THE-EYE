import { FlutterTts } from "flutter_tts";

class VoiceAccessibilityGuide {
  VoiceAccessibilityGuide._();

  static final VoiceAccessibilityGuide instance = VoiceAccessibilityGuide._();

  final FlutterTts _tts = FlutterTts();
  bool _initialized = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await _tts.setSpeechRate(0.48);
    await _tts.setVolume(1);
    await _tts.setPitch(1);
    _initialized = true;
  }

  Future<void> speak(String message) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty) return;
    await _ensureInitialized();
    await _tts.stop();
    await _tts.speak(trimmed);
  }

  Future<void> dispose() async {
    await _tts.stop();
  }
}

Future<void> speakVoiceAccessibilityGuidance(String message) {
  return VoiceAccessibilityGuide.instance.speak(message);
}
