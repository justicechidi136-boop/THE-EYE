import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../widgets/watch_ui.dart';

class SettingsRadiusScreen extends StatefulWidget {
  const SettingsRadiusScreen({super.key, this.initialRadiusM = 500});

  final int initialRadiusM;

  @override
  State<SettingsRadiusScreen> createState() => _SettingsRadiusScreenState();
}

class _SettingsRadiusScreenState extends State<SettingsRadiusScreen> {
  late double _radius;

  @override
  void initState() {
    super.initState();
    _radius = widget.initialRadiusM.toDouble();
  }

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const WatchSectionTitle('Alert Radius'),
          Text(
            '${_radius.round()}m',
            textAlign: TextAlign.center,
            style: EyeTokens.metricValue.copyWith(fontSize: 24),
          ),
          Slider(
            value: _radius,
            min: 100,
            max: 2000,
            divisions: 19,
            activeColor: EyeTokens.green,
            onChanged: (v) => setState(() => _radius = v),
          ),
          const Text(
            'Notifications within this distance',
            textAlign: TextAlign.center,
            style: EyeTokens.bodySmall,
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Save',
            onPressed: () => Navigator.pop(context, _radius.round()),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}

class SettingsContactsScreen extends StatelessWidget {
  const SettingsContactsScreen({super.key});

  static const _contacts = [
    'Emergency Contact 1',
    'Emergency Contact 2',
  ];

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const WatchSectionTitle('Emergency Contacts'),
          const SizedBox(height: EyeTokens.spaceSm),
          Expanded(
            child: ListView.separated(
              itemCount: _contacts.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: EyeTokens.spaceSm),
              itemBuilder: (context, index) {
                return WatchAlertCard(
                  title: _contacts[index],
                  subtitle: 'Managed on mobile app',
                );
              },
            ),
          ),
          WatchOutlineButton(
            label: 'Edit on Phone',
            onPressed: () => Navigator.pop(context),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}
