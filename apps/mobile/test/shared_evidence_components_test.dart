import "dart:convert";
import "dart:typed_data";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/evidence/all_evidence_screen.dart";
import "package:the_eye_mobile/evidence/evidence_collection.dart";
import "package:the_eye_mobile/evidence/evidence_item.dart";
import "package:the_eye_mobile/evidence/evidence_video_thumbnail.dart";
import "package:the_eye_mobile/evidence/evidence_viewer_screen.dart";

void main() {
  test("local and authorized remote evidence resolve without public fallback",
      () async {
    final local = _video(localPath: "C:/tmp/evidence.mp4");
    final remote = _video(
      authorizedUri: Uri.parse("https://storage.googleapis.com/private/video"),
    );

    expect((await local.resolveUri()).scheme, "file");
    expect(await remote.resolveUri(),
        Uri.parse("https://storage.googleapis.com/private/video"));
    await expectLater(
      _video(authorizedUri: Uri.parse("http://example.test/video"))
          .resolveUri(),
      throwsA(isA<EvidenceUnavailableException>()),
    );
  });

  testWidgets("video thumbnail renders generated frame", (tester) async {
    await tester.pumpWidget(_app(
      EvidenceMediaTile(
        item: _video(),
        thumbnailProvider: _ThumbnailProvider(_pixel),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey("video-thumbnail-image")), findsOneWidget);
  });

  testWidgets("video thumbnail failure renders fallback", (tester) async {
    await tester.pumpWidget(_app(
      EvidenceMediaTile(
        item: _video(),
        thumbnailProvider: const _ThumbnailProvider(null),
      ),
    ));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey("video-thumbnail-fallback")),
      findsOneWidget,
    );
  });

  testWidgets("video tile opens the in-app viewer", (tester) async {
    await tester.pumpWidget(_app(
      CompactEvidenceCollection(
        items: [_video()],
        thumbnailProvider: _ThumbnailProvider(_pixel),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(EvidenceMediaTile));
    await tester.pumpAndSettle();

    expect(find.byType(EvidenceViewerScreen), findsOneWidget);
  });

  testWidgets("viewer starts video playback immediately", (tester) async {
    final session = _VideoSession();
    await tester.pumpWidget(_app(EvidenceViewerScreen(
      item: _video(),
      videoSessionFactory: (_) => session,
    )));
    await tester.pumpAndSettle();
    expect(session.initialized, isTrue);
    expect(session.playCalls, 1);
    expect(find.byKey(const ValueKey("fake-video-view")), findsOneWidget);
  });

  testWidgets("viewer handles playback error and retry", (tester) async {
    await tester.pumpWidget(_app(EvidenceViewerScreen(
      item: _video(),
      videoSessionFactory: (_) => _VideoSession(failPlay: true),
    )));
    await tester.pumpAndSettle();

    expect(
        find.text("This evidence is unavailable right now."), findsOneWidget);
    expect(find.text("Retry"), findsOneWidget);
  });

  testWidgets("All Evidence supports mixed media and toolbar back",
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => FilledButton(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              settings: const RouteSettings(name: AllEvidenceScreen.routeName),
              builder: (_) => AllEvidenceScreen(
                thumbnailProvider: _ThumbnailProvider(_pixel),
                items: [
                  _video(),
                  EvidenceItem(
                    id: "audio-1",
                    mediaType: "audio",
                    label: "Voice note",
                    durationSeconds: 9,
                    authorizedUri: Uri.parse(
                      "https://storage.googleapis.com/private/audio",
                    ),
                  ),
                ],
              ),
            ),
          ),
          child: const Text("Open all"),
        ),
      ),
    ));
    await tester.tap(find.text("Open all"));
    await tester.pumpAndSettle();

    expect(find.text("All Evidence"), findsOneWidget);
    expect(find.text("Voice note"), findsOneWidget);
    await tester.tap(find.byTooltip("Back"));
    await tester.pumpAndSettle();
    expect(find.text("Open all"), findsOneWidget);
  });

  testWidgets("All Evidence empty state offers retry", (tester) async {
    var retries = 0;
    await tester.pumpWidget(_app(AllEvidenceScreen(
      items: const [],
      onRetry: () => retries++,
    )));
    expect(find.text("No evidence is available."), findsOneWidget);
    await tester.tap(find.text("Retry"));
    expect(retries, 1);
  });
}

EvidenceItem _video({String? localPath, Uri? authorizedUri}) => EvidenceItem(
      id: "video-1",
      mediaType: "video",
      label: "Video evidence",
      durationSeconds: 12,
      localPath: localPath,
      authorizedUri: authorizedUri ??
          Uri.parse("https://storage.googleapis.com/private/video"),
    );

Widget _app(Widget child) => MaterialApp(home: Scaffold(body: child));

final Uint8List _pixel = base64Decode(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8WQAAAABJRU5ErkJggg==",
);

class _ThumbnailProvider implements EvidenceVideoThumbnailProvider {
  const _ThumbnailProvider(this.bytes);

  final Uint8List? bytes;

  @override
  Future<Uint8List?> load(EvidenceItem item) async => bytes;
}

class _VideoSession implements EvidenceVideoSession {
  _VideoSession({this.failPlay = false});

  final bool failPlay;
  bool initialized = false;
  bool playing = false;
  int playCalls = 0;

  @override
  double get aspectRatio => 16 / 9;

  @override
  bool get isInitialized => initialized;

  @override
  bool get isPlaying => playing;

  @override
  Widget buildView() => const ColoredBox(
        key: ValueKey("fake-video-view"),
        color: Colors.black,
      );

  @override
  Future<void> dispose() async {}

  @override
  Future<void> initialize() async => initialized = true;

  @override
  Future<void> pause() async => playing = false;

  @override
  Future<void> play() async {
    playCalls++;
    if (failPlay) throw StateError("playback failed");
    playing = true;
  }
}
