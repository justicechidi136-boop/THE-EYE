import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../alerts/danger_alert_models.dart';
import '../alerts/danger_alert_templates.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';

class DangerAlertScreen extends StatefulWidget {
  const DangerAlertScreen({
    super.key,
    required this.services,
    required this.payload,
  });

  final WatchAppServices services;
  final DangerAlertPayload payload;

  @override
  State<DangerAlertScreen> createState() => _DangerAlertScreenState();
}

class _DangerAlertScreenState extends State<DangerAlertScreen> {
  bool _acknowledged = false;
  bool _languageFallback = false;

  @override
  void initState() {
    super.initState();
    _languageFallback = widget.services.dangerAlerts.tts.languageUnavailable;
    SemanticsService.announce('Danger alert received', TextDirection.ltr);
  }

  @override
  Widget build(BuildContext context) {
    final payload = widget.payload;
    final title = payload.displayTitle ??
        DangerAlertDisplayLabels.titleFor(payload.alertCode);
    final subtitle = DangerAlertDisplayLabels.subtitleFor(payload);
    final isCritical = payload.priority == DangerAlertPriority.critical;

    return WatchScreenShell(
      child: Semantics(
        label: 'Danger alert. $title. $subtitle',
        child: Column(
          children: [
            const SizedBox(height: 8),
            Icon(
              payload.allClear ? Icons.check_circle_outline : Icons.warning_amber_rounded,
              color: payload.allClear ? EyeColors.green : EyeColors.danger,
              size: 42,
              semanticLabel: payload.allClear ? 'Area cleared' : 'Danger warning',
            ),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: EyeColors.white,
                fontSize: isCritical ? 16 : 14,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EyeColors.muted,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (_languageFallback) ...[
              const SizedBox(height: 6),
              const Text(
                'Voice unavailable — showing text',
                textAlign: TextAlign.center,
                style: TextStyle(color: EyeColors.orange, fontSize: 10),
              ),
            ],
            const Spacer(),
            WatchPrimaryButton(
              label: 'I understand',
              onPressed: _acknowledged ? null : _acknowledge,
            ),
            const SizedBox(height: 8),
            WatchOutlineButton(
              label: 'Hear again',
              onPressed: () => widget.services.dangerAlerts.replayActive(),
            ),
            const SizedBox(height: 8),
            WatchOutlineButton(
              label: 'Mute alert',
              onPressed: () async {
                await widget.services.dangerAlerts.muteActive();
                if (mounted) Navigator.pop(context);
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _acknowledge() async {
    setState(() => _acknowledged = true);
    await widget.services.dangerAlerts.acknowledgeActive(widget.payload);
    SemanticsService.announce('Alert acknowledged', TextDirection.ltr);
    if (mounted) Navigator.pop(context);
  }
}
