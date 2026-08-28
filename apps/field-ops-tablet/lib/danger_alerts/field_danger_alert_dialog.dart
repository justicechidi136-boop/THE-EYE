import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../theme/field_theme.dart';
import 'field_danger_alert.dart';
import 'field_danger_alert_service.dart';

class FieldDangerAlertDialog extends StatelessWidget {
  const FieldDangerAlertDialog({
    super.key,
    required this.alert,
    required this.elapsedLabel,
    required this.onOpenMap,
    required this.onAcknowledge,
    required this.audioState,
    required this.onReplay,
  });

  final FieldDangerAlert alert;
  final String elapsedLabel;
  final VoidCallback onOpenMap;
  final VoidCallback onAcknowledge;
  final ValueListenable<FieldDangerAudioState> audioState;
  final VoidCallback onReplay;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final media = MediaQuery.sizeOf(context);

    return Dialog(
      insetPadding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 680,
          maxHeight: media.height - 48,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.warning_rounded,
                color: FieldColors.danger,
                size: 56,
                semanticLabel: 'Red danger triangle',
              ),
              const SizedBox(height: 8),
              Text(
                'DANGER ALERT',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                alert.dangerType,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleLarge?.copyWith(
                  color: FieldColors.danger,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                alert.area,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium,
              ),
              if (alert.distanceMeters != null) ...[
                const SizedBox(height: 8),
                Text(alert.distanceLabel),
              ],
              const SizedBox(height: 8),
              Text('Triggered $elapsedLabel ago'),
              const SizedBox(height: 12),
              ValueListenableBuilder<FieldDangerAudioState>(
                valueListenable: audioState,
                builder:
                    (context, state, _) => Text(
                      switch (state) {
                        FieldDangerAudioState.speakingWarning =>
                          'THE EYE generated warning',
                        FieldDangerAudioState.playingOriginalVoice =>
                          'Original voice',
                        FieldDangerAudioState.completed =>
                          'Audio alert completed',
                        _ => 'Preparing safety audio',
                      },
                      textAlign: TextAlign.center,
                      style: theme.textTheme.labelLarge,
                    ),
              ),
              if (alert.hasOriginalVoice) ...[
                const SizedBox(height: 6),
                Text(
                  'Original voice follows the THE EYE generated warning',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall,
                ),
              ],
              const SizedBox(height: 12),
              const Text(
                'Approximate area only. Reporter identity and exact GPS remain private.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 12,
                runSpacing: 10,
                children: [
                  OutlinedButton.icon(
                    onPressed: onOpenMap,
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('Open Map'),
                  ),
                  OutlinedButton.icon(
                    onPressed: onReplay,
                    icon: const Icon(Icons.replay_outlined),
                    label: const Text('Replay audio'),
                  ),
                  FilledButton.icon(
                    onPressed: onAcknowledge,
                    icon: const Icon(Icons.check),
                    label: const Text('I have seen this alert'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
