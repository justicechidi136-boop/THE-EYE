import "package:flutter/material.dart";

import "../app/app_scope.dart";
import "../brand.dart";
import "../config/the_eye_api_config.dart";
import "../contracts/the_eye_api_client.dart";
import "../widgets/section_card.dart";
import "profile_widgets.dart";

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  final TheEyeApiClient _apiClient =
      TheEyeApiClient(baseUrl: TheEyeApiConfig.resolveBaseUrl());
  final _documentNumberController = TextEditingController();

  String _documentType = "NationalID";
  CitizenProfile? _profile;
  String? _error;
  bool _loading = true;
  bool _submitting = false;

  static const _documentTypes = <String>[
    "NationalID",
    "Passport",
    "DriversLicense",
    "VotersCard",
  ];

  bool _loadStarted = false;

  @override
  void dispose() {
    _documentNumberController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loadStarted) {
      _loadStarted = true;
      _load();
    }
  }

  Future<void> _load() async {
    final session = AppScope.of(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await session.loadCitizenProfile(forceRefresh: true);
      if (!mounted) return;
      setState(() {
        _profile = profile;
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
        _error = "Unable to load KYC status.";
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    final token = AppScope.of(context).accessToken;
    if (token == null) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await _apiClient.submitKyc(
        accessToken: token,
        documentType: _documentType,
        documentNumber: _documentNumberController.text.trim().isEmpty
            ? null
            : _documentNumberController.text.trim(),
      );
      AppScope.of(context).clearCitizenProfileCache();
      await _load();
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("KYC submitted for review.")),
      );
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _submitting = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to submit KYC right now.";
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _profile?.kycStatus ?? "Unverified";
    final canSubmit = status != "Verified" && status != "Pending";

    return Scaffold(
      appBar: AppBar(title: const Text("Identity verification")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionCard(
                  title: "KYC status",
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ProfileRow("Status", status),
                      if (_profile?.kycRejectionReason != null &&
                          _profile!.kycRejectionReason!.isNotEmpty)
                        ProfileRow("Reason", _profile!.kycRejectionReason!),
                      const SizedBox(height: 8),
                      const Text(
                        "Document uploads use private storage. Approvals are made by authorized admins only.",
                        style: TextStyle(color: BrandColors.lightTextMuted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (canSubmit)
                  SectionCard(
                    title: "Submit verification",
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        profileLabeledField(
                          label: "Document type",
                          field: DropdownButtonFormField<String>(
                            value: _documentType,
                            items: _documentTypes
                                .map(
                                  (type) => DropdownMenuItem(
                                    value: type,
                                    child: Text(type),
                                  ),
                                )
                                .toList(),
                            onChanged: _submitting
                                ? null
                                : (value) {
                                    if (value == null) return;
                                    setState(() => _documentType = value);
                                  },
                            decoration: profileFieldDecoration(
                              hintText: "Document type",
                            ),
                          ),
                        ),
                        profileLabeledField(
                          label: "Document number (optional)",
                          field: TextField(
                            controller: _documentNumberController,
                            decoration: profileFieldDecoration(
                              hintText: "ID number",
                            ),
                          ),
                        ),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              _error!,
                              style: const TextStyle(color: BrandColors.danger),
                            ),
                          ),
                        FilledButton(
                          onPressed: _submitting ? null : _submit,
                          child: _submitting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text("Submit for review"),
                        ),
                      ],
                    ),
                  )
                else if (_error != null)
                  SectionCard(
                    title: "KYC",
                    child: Text(
                      _error!,
                      style: const TextStyle(color: BrandColors.danger),
                    ),
                  ),
              ],
            ),
    );
  }
}
