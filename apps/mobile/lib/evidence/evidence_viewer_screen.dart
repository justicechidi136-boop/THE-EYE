import "dart:async";
import "dart:io";

import "package:flutter/material.dart";
import "package:just_audio/just_audio.dart";
import "package:video_player/video_player.dart";

import "../design_system/components/eye_page_header.dart";
import "../design_system/eye_semantic_colors.dart";
import "evidence_item.dart";

abstract class EvidenceVideoSession {
  bool get isInitialized;
  bool get isPlaying;
  double get aspectRatio;
  Widget buildView();
  Future<void> initialize();
  Future<void> play();
  Future<void> pause();
  Future<void> dispose();
}

typedef EvidenceVideoSessionFactory = EvidenceVideoSession Function(Uri uri);

class FlutterEvidenceVideoSession implements EvidenceVideoSession {
  FlutterEvidenceVideoSession(Uri uri)
      : _controller = uri.isScheme("file")
            ? VideoPlayerController.file(File(uri.toFilePath()))
            : VideoPlayerController.networkUrl(uri);

  final VideoPlayerController _controller;

  @override
  bool get isInitialized => _controller.value.isInitialized;

  @override
  bool get isPlaying => _controller.value.isPlaying;

  @override
  double get aspectRatio => _controller.value.aspectRatio == 0
      ? 16 / 9
      : _controller.value.aspectRatio;

  @override
  Widget buildView() => VideoPlayer(_controller);

  @override
  Future<void> initialize() => _controller.initialize();

  @override
  Future<void> play() => _controller.play();

  @override
  Future<void> pause() => _controller.pause();

  @override
  Future<void> dispose() => _controller.dispose();
}

class EvidenceViewerScreen extends StatefulWidget {
  const EvidenceViewerScreen({
    required this.item,
    this.videoSessionFactory,
    super.key,
  });

  final EvidenceItem item;
  final EvidenceVideoSessionFactory? videoSessionFactory;

  @override
  State<EvidenceViewerScreen> createState() => _EvidenceViewerScreenState();
}

class _EvidenceViewerScreenState extends State<EvidenceViewerScreen> {
  EvidenceVideoSession? _video;
  AudioPlayer? _audio;
  Uri? _uri;
  String? _error;
  bool _loading = true;
  bool _audioPlaying = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final uri = await widget.item.resolveUri();
      if (widget.item.kind == EvidenceItemKind.video) {
        final session = (widget.videoSessionFactory ??
            (uri) => FlutterEvidenceVideoSession(uri))(uri);
        await session.initialize();
        await session.play();
        if (!mounted) {
          await session.dispose();
          return;
        }
        _video = session;
      } else if (widget.item.kind == EvidenceItemKind.audio) {
        final player = AudioPlayer();
        if (uri.isScheme("file")) {
          await player.setFilePath(uri.toFilePath());
        } else {
          await player.setUrl(uri.toString());
        }
        _audio = player;
      }
      if (!mounted) {
        await _audio?.dispose();
        return;
      }
      setState(() {
        _uri = uri;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = "This evidence is unavailable right now.";
      });
    }
  }

  Future<void> _toggleVideo() async {
    final video = _video;
    if (video == null) return;
    if (video.isPlaying) {
      await video.pause();
    } else {
      await video.play();
    }
    if (mounted) setState(() {});
  }

  Future<void> _toggleAudio() async {
    final audio = _audio;
    if (audio == null) return;
    if (audio.playing) {
      await audio.pause();
      _audioPlaying = false;
    } else {
      unawaited(audio.play());
      _audioPlaying = true;
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    unawaited(_video?.dispose());
    unawaited(_audio?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EyePageHeader.secondary(title: widget.item.label),
          Expanded(
            child: Center(
              child: _loading
                  ? const CircularProgressIndicator()
                  : _error != null
                      ? Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.error_outline,
                                  color: colors.error, size: 42),
                              const SizedBox(height: 12),
                              Text(_error!, textAlign: TextAlign.center),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: _load,
                                icon: const Icon(Icons.refresh),
                                label: const Text("Retry"),
                              ),
                            ],
                          ),
                        )
                      : _content(colors),
            ),
          ),
        ],
      ),
    );
  }

  Widget _content(EyeSemanticColors colors) {
    final uri = _uri!;
    switch (widget.item.kind) {
      case EvidenceItemKind.photo:
        return InteractiveViewer(
          child: uri.isScheme("file")
              ? Image.file(File(uri.toFilePath()), fit: BoxFit.contain)
              : Image.network(
                  uri.toString(),
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) =>
                      const Text("Unable to display this photo."),
                ),
        );
      case EvidenceItemKind.video:
        final video = _video!;
        return LayoutBuilder(
          builder: (context, constraints) {
            const horizontalPadding = 32.0;
            const verticalPadding = 32.0;
            const controlsHeight = 60.0;
            final ratio = video.aspectRatio > 0 ? video.aspectRatio : 16 / 9;
            final maxWidth = (constraints.maxWidth - horizontalPadding)
                .clamp(0.0, double.infinity);
            final maxHeight =
                (constraints.maxHeight - verticalPadding - controlsHeight)
                    .clamp(0.0, double.infinity);
            var width = maxWidth;
            var height = width / ratio;
            if (height > maxHeight) {
              height = maxHeight;
              width = height * ratio;
            }

            return Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: width,
                    height: height,
                    child: ColoredBox(
                      color: Colors.black,
                      child: video.buildView(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  IconButton.filled(
                    tooltip: video.isPlaying ? "Pause video" : "Play video",
                    onPressed: _toggleVideo,
                    icon:
                        Icon(video.isPlaying ? Icons.pause : Icons.play_arrow),
                  ),
                ],
              ),
            );
          },
        );
      case EvidenceItemKind.audio:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.graphic_eq, size: 64, color: colors.information),
            const SizedBox(height: 12),
            Text(widget.item.durationSeconds == null
                ? "Audio evidence"
                : "Duration ${formatEvidenceDuration(widget.item.durationSeconds!)}"),
            const SizedBox(height: 12),
            IconButton.filled(
              tooltip: _audioPlaying ? "Pause audio" : "Play audio",
              onPressed: _toggleAudio,
              icon: Icon(_audioPlaying ? Icons.pause : Icons.play_arrow),
            ),
          ],
        );
      case EvidenceItemKind.other:
        return const Text("Preview is unavailable for this evidence type.");
    }
  }
}
