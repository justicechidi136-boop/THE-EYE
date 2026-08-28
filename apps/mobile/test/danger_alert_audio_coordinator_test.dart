import "dart:async";

import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/danger_trigger/danger_alert_audio_coordinator.dart";
import "package:the_eye_mobile/danger_trigger/incoming_danger_alert.dart";

class _Speaker implements DangerWarningSpeaker {
  _Speaker(this.events);
  final List<String> events;

  @override
  Future<void> speak(String text, String locale) async {
    events.add("tts:$text:$locale");
    events.add("tts-complete");
  }

  @override
  Future<void> stop() async {}
}

class _Player implements OriginalVoicePlayer {
  _Player(this.events);
  final List<String> events;

  @override
  Future<void> play(String signedUrl) async {
    events.add("voice:$signedUrl");
  }

  @override
  Future<void> stop() async {}

  @override
  Future<void> dispose() async {}
}

class _BlockingSpeaker implements DangerWarningSpeaker {
  _BlockingSpeaker(this.events);
  final List<String> events;
  Completer<void>? _current;

  @override
  Future<void> speak(String text, String locale) {
    events.add("tts:$text");
    _current = Completer<void>();
    return _current!.future;
  }

  @override
  Future<void> stop() async {
    if (_current?.isCompleted == false) _current!.complete();
  }
}

class _Store implements DangerAudioCompletionStore {
  final values = <String>{};

  @override
  Future<void> add(String key) async {
    values.add(key);
  }

  @override
  Future<bool> contains(String key) async => values.contains(key);
}

IncomingDangerAlert _alert({
  String id = "alert-1",
  bool hasOriginalVoice = true,
}) =>
    IncomingDangerAlert(
      eventId: "event-1",
      alertId: id,
      version: 1,
      dangerType: "Fire",
      area: "Rumuola",
      issuedAt: DateTime.now(),
      hasOriginalVoice: hasOriginalVoice,
      priority: "CRITICAL",
    );

void main() {
  test("plays generated warning fully before original voice", () async {
    final events = <String>[];
    final store = _Store();
    final coordinator = DangerAlertAudioCoordinator(
      warningSpeaker: _Speaker(events),
      originalVoicePlayer: _Player(events),
      completionStore: store,
    );

    final played = await coordinator.playAutomatic(
      _alert(),
      locale: "en-NG",
      loadOriginalVoice: () async => "https://signed.example/voice",
    );

    expect(played, isTrue);
    expect(events, [
      "tts:Danger alert. Fire reported in Rumuola.:en-NG",
      "tts-complete",
      "voice:https://signed.example/voice",
    ]);
    expect(coordinator.state.value, DangerAlertAudioState.completed);
    await coordinator.dispose();
  });

  test("skips missing original voice and suppresses automatic replay",
      () async {
    final events = <String>[];
    final coordinator = DangerAlertAudioCoordinator(
      warningSpeaker: _Speaker(events),
      originalVoicePlayer: _Player(events),
      completionStore: _Store(),
    );
    final alert = _alert(hasOriginalVoice: false);

    expect(
      await coordinator.playAutomatic(
        alert,
        locale: "en-NG",
        loadOriginalVoice: () async => null,
      ),
      isTrue,
    );
    expect(
      await coordinator.playAutomatic(
        alert,
        locale: "en-NG",
        loadOriginalVoice: () async => null,
      ),
      isFalse,
    );
    expect(events.where((value) => value.startsWith("voice:")), isEmpty);
    expect(events.where((value) => value.startsWith("tts:")), hasLength(1));
    await coordinator.dispose();
  });

  test("acknowledge stops audio and a newer critical alert interrupts",
      () async {
    final events = <String>[];
    final coordinator = DangerAlertAudioCoordinator(
      warningSpeaker: _BlockingSpeaker(events),
      originalVoicePlayer: _Player(events),
      completionStore: _Store(),
    );
    final older = IncomingDangerAlert(
      eventId: "event-1",
      alertId: "older",
      version: 1,
      dangerType: "Fire",
      area: "Rumuola",
      issuedAt: DateTime.now().subtract(const Duration(minutes: 1)),
      priority: "HIGH",
    );
    final newer = IncomingDangerAlert(
      eventId: "event-2",
      alertId: "newer",
      version: 1,
      dangerType: "Shooting or gunfire",
      area: "Rumuola",
      issuedAt: DateTime.now(),
      priority: "CRITICAL",
    );

    final first = coordinator.playAutomatic(
      older,
      locale: "en-NG",
      loadOriginalVoice: () async => null,
    );
    await Future<void>.delayed(const Duration(milliseconds: 950));
    final second = coordinator.playAutomatic(
      newer,
      locale: "en-NG",
      loadOriginalVoice: () async => null,
    );
    await Future<void>.delayed(const Duration(milliseconds: 950));
    expect(events.last, contains("Shooting or gunfire"));
    await coordinator.acknowledge();
    expect(coordinator.state.value, DangerAlertAudioState.idle);
    expect(await first, isFalse);
    expect(await second, isFalse);
    await coordinator.dispose();
  });
}
