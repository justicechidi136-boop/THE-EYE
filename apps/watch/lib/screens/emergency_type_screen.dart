import 'package:flutter/material.dart';

import '../models/emergency_mode.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class EmergencyTypeScreen extends StatelessWidget {
  const EmergencyTypeScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  Widget build(BuildContext context) {
    return WatchScreenShell(
      onBack: () {
        services.sos.cancelHold();
        Navigator.pop(context);
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const WatchSectionTitle('How severe?'),
          const Text(
            'Select emergency type',
            textAlign: TextAlign.center,
            style: TextStyle(color: EyeColors.muted, fontSize: 10),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView(
              children: [
                for (final mode in WatchEmergencyMode.values)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: WatchPrimaryButton(
                      label: mode.label,
                      color: mode == WatchEmergencyMode.normalSos
                          ? EyeColors.green
                          : EyeColors.orange,
                      onPressed: () async {
                        await services.sos.submitSos(emergencyMode: mode);
                        if (!context.mounted) return;
                        Navigator.pushReplacementNamed(
                          context,
                          WatchRoutes.activeEmergency,
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
