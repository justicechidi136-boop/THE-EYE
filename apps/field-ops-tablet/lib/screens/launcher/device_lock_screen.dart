import 'package:flutter/material.dart';

import '../../config/app_flavor.dart';
import '../../launcher/field_launcher_platform.dart';
import '../../launcher/launcher_policy.dart';

/// Secure lock state for revoked / lost / suspended / expired sessions.
/// Does not expose cached incidents, maps, or communications.
class DeviceLockScreen extends StatelessWidget {
  const DeviceLockScreen({
    super.key,
    required this.reason,
    required this.deviceReference,
    required this.policy,
    this.supportGuidance =
        'Contact your agency Field Operations supervisor for assistance.',
  });

  final String reason;
  final String deviceReference;
  final LauncherPolicy? policy;
  final String supportGuidance;

  @override
  Widget build(BuildContext context) {
    final platform = FieldLauncherPlatform();
    final dialerAllowed = policy?.emergencyDialerAllowed ?? true;

    return Scaffold(
      backgroundColor: const Color(0xFF0A1018),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'THE EYE',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    AppFlavor.isStaging ? 'Field Tablet · Staging' : 'Field Tablet',
                    style: const TextStyle(color: Colors.white54),
                  ),
                  const SizedBox(height: 28),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A2433),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF5A1F1F)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          reason,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Device reference: $deviceReference',
                          style: const TextStyle(color: Colors.white70),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          supportGuidance,
                          style: const TextStyle(color: Colors.white60),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (dialerAllowed)
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton.icon(
                        onPressed: () => platform.openEmergencyDialer(),
                        icon: const Icon(Icons.phone),
                        label: const Text('Emergency call'),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
