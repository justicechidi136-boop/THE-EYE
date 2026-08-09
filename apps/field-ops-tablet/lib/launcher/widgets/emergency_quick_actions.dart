import 'package:flutter/material.dart';

import '../../services/field_app_services.dart';
import '../../widgets/backup_request_sheet.dart';
import '../../widgets/officer_safety_panel.dart';
import '../field_launcher_platform.dart';
import '../launcher_policy.dart';

/// Always-visible critical actions on the launcher shell.
class EmergencyQuickActions extends StatelessWidget {
  const EmergencyQuickActions({
    super.key,
    required this.services,
    required this.policy,
    required this.platform,
  });

  final FieldAppServices services;
  final LauncherPolicy policy;
  final FieldLauncherPlatform platform;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: FilledButton.tonal(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF8B1515),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(64),
            ),
            onPressed: () => _openPanic(context),
            child: const Text('OFFICER PANIC', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton.tonal(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF8A4B12),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(64),
            ),
            onPressed: () => _openBackup(context),
            child: const Text('REQUEST BACKUP', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ),
        if (policy.emergencyDialerAllowed) ...[
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton.tonal(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF15407A),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(64),
              ),
              onPressed: () => platform.openEmergencyDialer(),
              child: const Text('EMERGENCY CALL', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _openPanic(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF121C2A),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: OfficerSafetyPanel(services: services),
      ),
    );
  }

  Future<void> _openBackup(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF121C2A),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.viewInsetsOf(ctx).bottom + 20,
        ),
        child: BackupRequestSheet(services: services),
      ),
    );
  }
}
