import "dart:async";

import "package:flutter/material.dart";
import "package:just_audio/just_audio.dart";

import "../design_system/eye_semantic_colors.dart";
import "ai_voice_service.dart";

typedef AiVoiceLoader = Future<AiVoicePresentation> Function();

class AiVoiceNoteCard extends StatefulWidget {
  const AiVoiceNoteCard({
    required this.load,
    required this.requestTranslation,
    required this.requestSynthesis,
    this.initialOriginalUrl,
    super.key,
  });

  final AiVoiceLoader load;
  final Future<void> Function() requestTranslation;
  final Future<void> Function() requestSynthesis;
  final String? initialOriginalUrl;

  @override
  State<AiVoiceNoteCard> createState() => _AiVoiceNoteCardState();
}

class _AiVoiceNoteCardState extends State<AiVoiceNoteCard> {
  final _player = AudioPlayer();
  AiVoicePresentation? _voice;
  bool _loading = true;
  bool _requesting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final voice = await widget.load();
      if (!mounted) return;
      setState(() {
        _voice = voice;
        _loading = false;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = "AI transcript unavailable";
      });
    }
  }

  Future<void> _play(String? url) async {
    if (url == null || url.isEmpty) return;
    await _player.setUrl(url);
    await _player.play();
  }

  Future<void> _request(Future<void> Function() action) async {
    setState(() => _requesting = true);
    try {
      await action();
      await _load();
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final voice = _voice;
    final originalUrl = voice?.originalUrl.isNotEmpty == true
        ? voice!.originalUrl
        : widget.initialOriginalUrl;
    final status = voice?.transcriptStatus.toUpperCase() ?? "PENDING";
    final processing =
        const {"PENDING", "QUEUED", "PROCESSING"}.contains(status);
    return Semantics(
      label: processing ? "Voice note. Preparing transcript." : "Voice note",
      liveRegion: processing,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Voice note", style: Theme.of(context).textTheme.titleSmall),
          Text(
              "Original${voice?.originalLocale == null ? "" : " · ${voice!.originalLocale}"}"),
          IconButton(
            tooltip: "Play original voice note",
            onPressed: originalUrl == null || originalUrl.isEmpty
                ? null
                : () => unawaited(_play(originalUrl)),
            icon: const Icon(Icons.play_circle_outline),
          ),
          if (_loading || processing) const Text("Preparing transcript..."),
          if (_error != null) ...[
            Text(_error!,
                style: TextStyle(color: EyeSemanticColors.of(context).warning)),
            const Text("The original audio remains available."),
          ],
          if (voice?.transcript?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
                "Transcript · ${voice!.transcriptLocale ?? "Detected language"}",
                style: Theme.of(context).textTheme.labelLarge),
            SelectableText(voice.transcript!),
          ],
          if (voice?.translation?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text("Translation · ${voice!.targetLocale}",
                style: Theme.of(context).textTheme.labelLarge),
            SelectableText(voice.translation!),
            const Text("AI-assisted translation"),
          ] else if (voice?.transcript?.trim().isNotEmpty == true) ...[
            TextButton(
              onPressed: _requesting
                  ? null
                  : () => unawaited(_request(widget.requestTranslation)),
              child: const Text("Prepare translation"),
            ),
          ],
          if (voice?.synthesisUrl?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            FilledButton.tonalIcon(
              onPressed: () => unawaited(_play(voice!.synthesisUrl)),
              icon: const Icon(Icons.record_voice_over_outlined),
              label: const Text("Listen to AI translated audio"),
            ),
            const Text(
                "AI-generated translation · Not the sender's original voice"),
          ] else if (voice?.translation?.trim().isNotEmpty == true) ...[
            TextButton(
              onPressed: _requesting
                  ? null
                  : () => unawaited(_request(widget.requestSynthesis)),
              child: const Text("Prepare AI translated audio"),
            ),
          ],
          if (!_loading)
            IconButton(
              tooltip: "Refresh voice processing status",
              onPressed: () => unawaited(_load()),
              icon: const Icon(Icons.refresh),
            ),
        ],
      ),
    );
  }
}
