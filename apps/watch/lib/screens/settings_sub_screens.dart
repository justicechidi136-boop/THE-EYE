import 'package:flutter/material.dart';
import 'package:the_eye_flutter_l10n/the_eye_locales.dart';

import '../design_system/design_system.dart';
import '../l10n/generated/watch_localizations.dart';
import '../services/watch_app_services.dart';
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
          const WatchSectionTitle('SOS Contacts'),
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

class SettingsLanguageScreen extends StatelessWidget {
  const SettingsLanguageScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  Widget build(BuildContext context) {
    final l10n = WatchLocalizations.of(context);
    return WatchScaffold(
      child: ValueListenableBuilder<Locale>(
        valueListenable: services.accountLanguage.locale,
        builder: (context, locale, _) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              WatchSectionTitle(l10n.selectLanguage),
              const SizedBox(height: EyeTokens.spaceXs),
              Expanded(
                child: ListView.separated(
                  itemCount: TheEyeLocaleCatalog.enabled.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: EyeTokens.spaceXs),
                  itemBuilder: (context, index) {
                    final option = TheEyeLocaleCatalog.enabled[index];
                    final selected = locale.languageCode == option.code;
                    final label = selected
                        ? '${option.nativeName} (${l10n.preferredLanguageSaved})'
                        : option.nativeName;
                    return WatchOutlineButton(
                      label: label,
                      onPressed: () async {
                        await services.accountLanguage.selectLocale(
                          option.code,
                        );
                      },
                    );
                  },
                ),
              ),
              Text(
                l10n.preferredLanguageSaved,
                textAlign: TextAlign.center,
                style: EyeTokens.bodySmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: EyeTokens.spaceSm),
            ],
          );
        },
      ),
    );
  }
}
