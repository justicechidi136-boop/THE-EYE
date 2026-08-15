import "dart:async";

import "package:flutter/material.dart";

import "../app/app_scope.dart";
import "../app/session_accessor.dart";
import "../brand.dart";
import "../contracts/the_eye_api_client.dart";
import "../l10n/generated/app_localizations.dart";
import "../profile/profile_widgets.dart";
import "../widgets/section_card.dart";
import "language_region_preference_store.dart";
import "language_region_registry.dart";
import "language_region_selector.dart";

class LanguageRegionSettingsScreen extends StatefulWidget {
  const LanguageRegionSettingsScreen({super.key});

  @override
  State<LanguageRegionSettingsScreen> createState() =>
      _LanguageRegionSettingsScreenState();
}

class _LanguageRegionSettingsScreenState
    extends State<LanguageRegionSettingsScreen> {
  CitizenProfile? _profile;
  CountryRegionOption? _country;
  PreferredLanguageOption? _language;
  LanguageRegionPreferenceStore? _store;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  bool _loadStarted = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loadStarted) return;
    _loadStarted = true;
    unawaited(_load(AppScope.of(context)));
  }

  Future<void> _load(SessionAccessor session) async {
    try {
      final store = await LanguageRegionPreferenceStore.create();
      final profile = await session.loadCitizenProfile(forceRefresh: true);
      if (!mounted) return;
      final profileCountry = profile == null
          ? null
          : LanguageRegionRegistry.countryByCode(profile.profile.countryCode) ??
              LanguageRegionRegistry.countryFromLegacyName(
                profile.profile.country,
              );
      final country = profileCountry ??
          LanguageRegionRegistry.countryByCode(store.countryCode) ??
          LanguageRegionRegistry.defaultCountry();
      final language = LanguageRegionRegistry.suggestedLanguage(
        deviceLocales: WidgetsBinding.instance.platformDispatcher.locales,
        countryCode: country.code,
        cachedLocale: store.preferredLocale,
        serverLocale: profile?.effectivePreferredLocale ??
            profile?.profile.preferredLocale,
      );
      await store.save(
        countryCode: country.code,
        preferredLocale: language.locale,
      );
      setState(() {
        _store = store;
        _profile = profile;
        _country = country;
        _language = language;
        _loading = false;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load language and region.";
        _loading = false;
      });
    }
  }

  Future<void> _changeLanguage(PreferredLanguageOption language) async {
    final previous = _language;
    setState(() {
      _language = language;
      _saving = true;
      _error = null;
    });
    try {
      final updated = await AppScope.of(context).updateCitizenProfile({
        "preferredLocale": language.locale,
      });
      await (_store ?? await LanguageRegionPreferenceStore.create())
          .saveFromProfile(updated);
      if (!mounted) return;
      setState(() {
        _profile = updated;
        _language = LanguageRegionRegistry.effectiveLanguage(
          updated.effectivePreferredLocale ?? updated.profile.preferredLocale,
        );
        _saving = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context).preferredLanguageSaved,
            ),
          ),
        );
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _language = previous;
        _saving = false;
        _error = error.userMessage;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _language = previous;
        _saving = false;
        _error = "Unable to save preferred language.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.languageRegion)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionCard(
                  title: l10n.languageRegion,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ProfileRow(
                        l10n.countryRegion,
                        _country?.displayName ?? l10n.notSet,
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          l10n.languageRegionNotice,
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      profileLabeledField(
                        context: context,
                        label: l10n.preferredLanguage,
                        field: LanguageRegionSelectorField<
                            PreferredLanguageOption>(
                          label: l10n.preferredLanguage,
                          valueLabel: _language?.displayName ?? l10n.select,
                          options: LanguageRegionRegistry.enabledLanguages,
                          optionLabel: (language) => language.displayName,
                          optionSearchText: (language) =>
                              "${language.locale} ${language.englishName} ${language.nativeName}",
                          enabled: !_saving,
                          onChanged: _changeLanguage,
                        ),
                      ),
                      if (_saving)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: LinearProgressIndicator(),
                        ),
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            _error!,
                            style: const TextStyle(color: BrandColors.danger),
                          ),
                        ),
                      if (_profile?.preferredLocale == null)
                        Text(
                          l10n.pilotEnglishNotice,
                          style: const TextStyle(fontSize: 12),
                        ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
