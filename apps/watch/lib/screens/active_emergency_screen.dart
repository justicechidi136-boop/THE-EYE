import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../models/sos_event.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class ActiveEmergencyScreen extends StatelessWidget {
  const ActiveEmergencyScreen({super.key, required this.services});

  final WatchAppServices services;

  bool _isQueued(SosEventState state) {
    return state.errorMessage?.contains('Queued') == true &&
        (state.lifecycle == SosLifecycle.failed ||
            state.lifecycle == SosLifecycle.active);
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SosEventState>(
      stream: services.sos.states,
      initialData: services.sos.state,
      builder: (context, snapshot) {
        final state = snapshot.data!;
        final isSending = state.lifecycle == SosLifecycle.submitting;
        final isQueued = _isQueued(state);

        final statusTitle = isSending
            ? 'Sending SOS…'
            : isQueued
                ? 'SOS Queued'
                : 'SOS Sent';

        final statusBody = isQueued
            ? (state.errorMessage ??
                'Queued offline — will retry when connected')
            : 'Your live location has been shared. Stay on the line if possible.';

        return WatchScaffold(
          onBack: () => Navigator.popUntil(
            context,
            ModalRoute.withName(WatchRoutes.home),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: EyeColors.danger.withValues(alpha: 0.15),
                  border: Border.all(color: EyeColors.danger, width: 2),
                ),
                child: Icon(
                  isQueued ? Icons.cloud_queue : Icons.sensors,
                  color: EyeColors.danger,
                  size: isQueued ? 28 : 24,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                statusTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EyeColors.danger,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                statusBody,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EyeColors.muted,
                  fontSize: 10,
                  height: 1.4,
                ),
              ),
              const Spacer(),
              WatchPrimaryButton(
                label: 'Done',
                color: EyeColors.danger,
                onPressed: () => Navigator.popUntil(
                  context,
                  ModalRoute.withName(WatchRoutes.home),
                ),
              ),
              const SizedBox(height: 6),
              WatchOutlineButton(
                label: 'View Map',
                onPressed: () =>
                    Navigator.pushNamed(context, WatchRoutes.tracking),
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
