import 'package:flutter/material.dart';
import 'package:the_eye_flutter_l10n/the_eye_locales.dart';

import '../l10n/generated/field_localizations.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class LanguageRegionScreen extends StatefulWidget {
  const LanguageRegionScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<LanguageRegionScreen> createState() => _LanguageRegionScreenState();
}

class _LanguageRegionScreenState extends State<LanguageRegionScreen> {
  bool _saving = false;
  String? _warning;

  Future<void> _select(String code) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _warning = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    final l10n = FieldLocalizations.of(context);
    final result = await widget.services.accountLocale.selectLocale(code);
    if (!mounted) return;
    setState(() {
      _saving = false;
      _warning = result.synced ? null : result.warning;
    });
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          result.synced
              ? l10n.preferredLanguageSaved
              : l10n.languageSyncWarning,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    final current = widget.services.accountLocale.locale.languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.languageRegion)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            l10n.preferredLanguage,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.languageRegionDescription,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          for (final option in TheEyeLocaleCatalog.enabled)
            Card(
              child: ListTile(
                enabled: !_saving,
                onTap: _saving ? null : () => _select(option.code),
                title: Text(option.englishName),
                subtitle: Text('${option.nativeName} - ${l10n.nigeria}'),
                leading:
                    current == option.code
                        ? const Icon(
                          Icons.radio_button_checked,
                          color: FieldColors.orange,
                        )
                        : const Icon(Icons.radio_button_unchecked),
                trailing:
                    current == option.code
                        ? const Icon(
                          Icons.check_circle,
                          color: FieldColors.success,
                        )
                        : const Icon(Icons.language),
              ),
            ),
          if (_warning != null) ...[
            const SizedBox(height: 12),
            Text(
              l10n.languageSyncWarning,
              style: const TextStyle(color: FieldColors.orange),
            ),
          ],
        ],
      ),
    );
  }
}
