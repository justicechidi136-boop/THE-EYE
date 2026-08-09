import 'package:flutter/material.dart';

import '../../launcher/approved_app.dart';
import '../../launcher/approved_app_launcher.dart';
import '../../launcher/approved_app_registry.dart';
import '../../launcher/launcher_policy.dart';

class ApprovedAppsScreen extends StatelessWidget {
  const ApprovedAppsScreen({
    super.key,
    required this.policy,
    required this.launcher,
  });

  final LauncherPolicy policy;
  final ApprovedAppLauncher launcher;

  @override
  Widget build(BuildContext context) {
    final apps = launcher.visibleApps(policy);
    return Scaffold(
      backgroundColor: const Color(0xFF0B1420),
      appBar: AppBar(
        title: const Text('Approved Apps'),
        backgroundColor: const Color(0xFF152437),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final category in ApprovedAppCategory.values) ...[
            if (ApprovedAppRegistry.byCategory(apps, category).isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 8),
                child: Text(
                  _categoryLabel(category),
                  style: const TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              ...ApprovedAppRegistry.byCategory(apps, category).map(
                (app) => Card(
                  color: const Color(0xFF152437),
                  child: ListTile(
                    leading: Icon(_icon(app.iconName), color: Colors.white),
                    title: Text(app.displayName,
                        style: const TextStyle(color: Colors.white)),
                    subtitle: Text(
                      app.packageName,
                      style: const TextStyle(color: Colors.white54),
                    ),
                    trailing: const Icon(Icons.open_in_new, color: Colors.white54),
                    onTap: () async {
                      final result =
                          await launcher.launch(app, policy: policy);
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(result.message),
                          backgroundColor:
                              result.ok ? Colors.green.shade800 : Colors.red.shade800,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ],
          if (apps.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'No approved applications are available for your role and device policy.',
                style: TextStyle(color: Colors.white70),
              ),
            ),
        ],
      ),
    );
  }

  String _categoryLabel(ApprovedAppCategory category) {
    switch (category) {
      case ApprovedAppCategory.operations:
        return 'OPERATIONS';
      case ApprovedAppCategory.navigation:
        return 'NAVIGATION';
      case ApprovedAppCategory.communication:
        return 'COMMUNICATION';
      case ApprovedAppCategory.deviceTools:
        return 'DEVICE TOOLS';
    }
  }

  IconData _icon(String name) {
    switch (name) {
      case 'map':
        return Icons.map_outlined;
      case 'camera':
        return Icons.photo_camera_outlined;
      case 'phone':
        return Icons.phone;
      case 'language':
        return Icons.language;
      case 'sms':
        return Icons.sms_outlined;
      case 'settings':
        return Icons.settings_outlined;
      default:
        return Icons.apps;
    }
  }
}
