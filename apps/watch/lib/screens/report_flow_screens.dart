import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

/// Prototype Flow D — report category picker (UI shell; API wired via mobile).
class ReportCategoryScreen extends StatelessWidget {
  const ReportCategoryScreen({super.key});

  static const _categories = [
    ('Theft', Icons.shopping_bag_outlined),
    ('Assault', Icons.warning_amber_rounded),
    ('Fire', Icons.local_fire_department_outlined),
    ('Other', Icons.more_horiz),
  ];

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const WatchSectionTitle('Report Incident'),
          const Text(
            'Select category',
            textAlign: TextAlign.center,
            style: EyeTokens.bodySmall,
          ),
          const SizedBox(height: EyeTokens.spaceMd),
          Expanded(
            child: ListView.separated(
              itemCount: _categories.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: EyeTokens.spaceSm),
              itemBuilder: (context, index) {
                final (label, _) = _categories[index];
                return WatchPrimaryButton(
                  label: label,
                  onPressed: () => Navigator.pushNamed(
                    context,
                    WatchRoutes.reportDescribe,
                    arguments: label,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class ReportDescribeScreen extends StatefulWidget {
  const ReportDescribeScreen({super.key, this.category = 'Incident'});

  final String category;

  @override
  State<ReportDescribeScreen> createState() => _ReportDescribeScreenState();
}

class _ReportDescribeScreenState extends State<ReportDescribeScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          WatchSectionTitle(widget.category),
          const SizedBox(height: EyeTokens.spaceSm),
          Expanded(
            child: TextField(
              controller: _controller,
              maxLines: 4,
              style: const TextStyle(fontSize: 11, color: EyeTokens.white),
              decoration: InputDecoration(
                hintText: 'Describe what happened…',
                hintStyle: EyeTokens.bodySmall,
                filled: true,
                fillColor: EyeTokens.surface,
                border: OutlineInputBorder(
                  borderRadius: EyeTokens.panelRadius,
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          WatchPrimaryButton(
            label: 'Continue',
            onPressed: () => Navigator.pushNamed(
              context,
              WatchRoutes.reportConfirm,
              arguments: _controller.text.trim(),
            ),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchOutlineButton(
            label: 'Voice Input',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.reportVoice),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}

class ReportVoiceScreen extends StatelessWidget {
  const ReportVoiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        children: [
          const Spacer(),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: EyeTokens.orange.withValues(alpha: 0.15),
              border: Border.all(color: EyeTokens.orange, width: 2),
            ),
            child: const Icon(Icons.mic, color: EyeTokens.orange, size: 32),
          ),
          const SizedBox(height: EyeTokens.spaceMd),
          const Text('Hold to record', style: EyeTokens.sectionTitle),
          const Text(
            'Voice report (prototype UI)',
            style: EyeTokens.bodySmall,
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Use Recording',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.reportConfirm),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}

class ReportConfirmScreen extends StatelessWidget {
  const ReportConfirmScreen({super.key, this.description = ''});

  final String description;

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        children: [
          const WatchSectionTitle('Report Sent'),
          const SizedBox(height: EyeTokens.spaceSm),
          Text(
            description.isEmpty
                ? 'Your location has been attached and alert shared with users nearby.'
                : description,
            textAlign: TextAlign.center,
            style: EyeTokens.bodySmall,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
          ),
          const Spacer(),
          WatchOutlineButton(
            label: 'Home',
            onPressed: () => Navigator.popUntil(
              context,
              ModalRoute.withName(WatchRoutes.home),
            ),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchPrimaryButton(
            label: 'View as Reporter',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.stillActive),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}
