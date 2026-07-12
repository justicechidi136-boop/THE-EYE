import 'package:flutter/material.dart';

import '../models/sos_event.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class ActiveEmergencyScreen extends StatelessWidget {
  const ActiveEmergencyScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SosEventState>(
      stream: services.sos.states,
      initialData: services.sos.state,
      builder: (context, snapshot) {
        final state = snapshot.data!;
        final isSending = state.lifecycle == SosLifecycle.submitting;

        return WatchScreenShell(
          onBack: () => Navigator.popUntil(
            context,
            ModalRoute.withName(WatchRoutes.home),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: EyeColors.danger.withValues(alpha: 0.15),
                  border: Border.all(color: EyeColors.danger, width: 2),
                ),
                child: const Icon(Icons.sos, color: EyeColors.danger, size: 32),
              ),
              const SizedBox(height: 12),
              Text(
                isSending ? 'Sending SOS…' : 'SOS Sent',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EyeColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              WatchStatusChip(
                label: state.emergencyMode.label,
                tone: WatchStatusTone.danger,
              ),
              if (state.errorMessage != null) ...[
                const SizedBox(height: 8),
                Text(
                  state.errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: EyeColors.muted, fontSize: 10),
                ),
              ],
              const Spacer(),
              WatchPrimaryButton(
                label: 'View Tracking',
                onPressed: () =>
                    Navigator.pushNamed(context, WatchRoutes.tracking),
              ),
              const SizedBox(height: 6),
              WatchOutlineButton(
                label: 'End (Demo)',
                onPressed: () {
                  services.sos.reset();
                  Navigator.popUntil(
                    context,
                    ModalRoute.withName(WatchRoutes.home),
                  );
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
