import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../alerts/danger_alert_models.dart';
import '../l10n/generated/watch_localizations.dart';
import '../models/watch_safety_status.dart';
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

class _DangerAlertScreenState extends State<DangerAlertScreen>
    with SingleTickerProviderStateMixin {
  bool _acknowledged = false;
  bool _languageFallback = false;
  late final AnimationController _alertPulse;
  late final Animation<double> _alertOpacity;

  @override
  void initState() {
    super.initState();
    _alertPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _alertOpacity = Tween<double>(
      begin: 0.35,
      end: 1,
    ).animate(CurvedAnimation(parent: _alertPulse, curve: Curves.easeInOut));
    if (!widget.payload.allClear) {
      _alertPulse.repeat(reverse: true, count: 8);
    }
    _languageFallback = widget.services.dangerAlerts.tts.languageUnavailable;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      SemanticsService.sendAnnouncement(
        View.of(context),
        WatchLocalizations.of(context).dangerAlertReceived,
        Directionality.of(context),
      );
    });
  }

  @override
  void dispose() {
    _alertPulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final payload = widget.payload;
    final l10n = WatchLocalizations.of(context);
    final title = payload.allClear ? l10n.areaCleared : l10n.dangerAlert;
    final subtitle = payload.allClear
        ? l10n.areaCleared
        : WatchDangerLabels.nearbyLabel(l10n, payload.alertCode);
    final meta = _alertMeta(payload);
    final isCritical = payload.priority == DangerAlertPriority.critical;

    return WatchScreenShell(
      child: Semantics(
        label: '${l10n.dangerAlert}. $title. $subtitle',
        child: Column(
          children: [
            const SizedBox(height: 8),
            FadeTransition(
              opacity: payload.allClear
                  ? const AlwaysStoppedAnimation<double>(1)
                  : _alertOpacity,
              child: Icon(
                payload.allClear
                    ? Icons.check_circle_outline
                    : Icons.warning_amber_rounded,
                color: payload.allClear ? EyeColors.green : EyeColors.danger,
                size: 42,
                semanticLabel: payload.allClear
                    ? l10n.areaCleared
                    : l10n.dangerWarning,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
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
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: EyeColors.muted,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (meta != null) ...[
              const SizedBox(height: 4),
              Text(
                meta,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: EyeColors.muted,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
            if (_languageFallback) ...[
              const SizedBox(height: 6),
              Text(
                l10n.voiceUnavailableShowingText,
                textAlign: TextAlign.center,
                style: const TextStyle(color: EyeColors.orange, fontSize: 10),
              ),
            ],
            const Spacer(),
            WatchPrimaryButton(
              label: l10n.iUnderstand,
              onPressed: _acknowledged ? null : _acknowledge,
            ),
            const SizedBox(height: 8),
            WatchOutlineButton(
              label: l10n.hearAgain,
              onPressed: () => widget.services.dangerAlerts.replayActive(),
            ),
            const SizedBox(height: 8),
            WatchOutlineButton(
              label: l10n.muteAlert,
              onPressed: () async {
                final navigator = Navigator.of(context);
                await widget.services.dangerAlerts.muteActive();
                if (!context.mounted) return;
                navigator.pop();
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
    final navigator = Navigator.of(context);
    final view = View.of(context);
    await widget.services.dangerAlerts.acknowledgeActive(widget.payload);
    if (!mounted) return;
    SemanticsService.sendAnnouncement(
      view,
      WatchLocalizations.of(context).alertAcknowledged,
      Directionality.of(context),
    );
    navigator.pop();
  }

  String? _alertMeta(DangerAlertPayload payload) {
    final parts = <String>[];
    final area = payload.areaName?.trim();
    if (area != null && area.isNotEmpty) parts.add(area);
    final distance = payload.distanceMeters;
    if (distance != null && distance > 0) {
      parts.add(
        distance >= 1000
            ? '${(distance / 1000).toStringAsFixed(1)} km'
            : '$distance m',
      );
    }
    return parts.isEmpty ? null : parts.join(' - ');
  }
}
