import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../services/launcher_service.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';

/// Wear OS app drawer — lists launchable apps via native PackageManager.
class AppDrawerScreen extends StatefulWidget {
  const AppDrawerScreen({super.key, required this.launcher});

  final LauncherService launcher;

  @override
  State<AppDrawerScreen> createState() => _AppDrawerScreenState();
}

class _AppDrawerScreenState extends State<AppDrawerScreen> {
  List<WatchLaunchableApp> _apps = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final apps = await widget.launcher.listApps();
    if (!mounted) return;
    setState(() {
      _apps = apps;
      _loading = false;
      if (apps.isEmpty) _error = 'No apps found';
    });
  }

  Future<void> _open(String packageName) async {
    final ok = await widget.launcher.launchApp(packageName);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open app')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      leadingLabel: 'Apps',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const WatchSectionTitle('App Drawer'),
          if (_loading)
            const Expanded(
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    color: EyeColors.green,
                    strokeWidth: 2,
                  ),
                ),
              ),
            )
          else if (_error != null)
            Expanded(
              child: Center(
                child: Text(
                  _error!,
                  style: const TextStyle(color: EyeColors.muted, fontSize: 11),
                ),
              ),
            )
          else
            Expanded(
              child: ListView.separated(
                itemCount: _apps.length,
                separatorBuilder: (_, __) => const SizedBox(height: 4),
                itemBuilder: (context, index) {
                  final app = _apps[index];
                  return WatchAlertCard(
                    title: app.label,
                    subtitle: app.packageName,
                    onTap: () => _open(app.packageName),
                  );
                },
              ),
            ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchOutlineButton(
            label: 'System Settings',
            onPressed: widget.launcher.openSystemSettings,
          ),
          const SizedBox(height: EyeTokens.spaceXs),
          WatchOutlineButton(
            label: 'Change default home',
            onPressed: widget.launcher.openHomeSettings,
          ),
        ],
      ),
    );
  }
}
