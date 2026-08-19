import "package:flutter/material.dart";
import "package:flutter/semantics.dart";
import "package:flutter/services.dart";
import "package:url_launcher/url_launcher.dart";

import "../brand.dart";
import "../design_system/components/eye_primary_button.dart";
import "../incidents/incident_submission_service.dart";
import "../neighborhood_watch/neighborhood_watch_prototype_chrome.dart";
import "community_verification_service.dart";

const kCommunityVerificationSafetyWarning =
    "Do not approach danger or place yourself at risk. Respond only based on what you can safely observe.";

class CommunityVerificationScreen extends StatefulWidget {
  const CommunityVerificationScreen({
    required this.requestId,
    required this.service,
    required this.accessToken,
    this.highContrast = false,
    super.key,
  });

  final String requestId;
  final CommunityVerificationService service;
  final String accessToken;
  final bool highContrast;

  @override
  State<CommunityVerificationScreen> createState() =>
      _CommunityVerificationScreenState();
}

class _CommunityVerificationScreenState
    extends State<CommunityVerificationScreen> {
  CommunityVerificationPayload? _payload;
  CommunityVerificationCompletion? _completion;
  String? _error;
  bool _loading = true;
  bool _submitting = false;

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
    try {
      final payload = await widget.service.fetchPayload(
        requestId: widget.requestId,
        accessToken: widget.accessToken,
      );
      if (!payload.alreadyResponded && !payload.isExpired) {
        await widget.service.markOpened(
          requestId: widget.requestId,
          accessToken: widget.accessToken,
        );
      }
      if (!mounted) return;
      setState(() {
        _payload = payload;
        _loading = false;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load verification request.";
        _loading = false;
      });
    }
  }

  Future<void> _submit(String responseType) async {
    if (_payload == null || _submitting) return;
    setState(() => _submitting = true);
    HapticFeedback.mediumImpact();
    try {
      final completion = await widget.service.respond(
        requestId: widget.requestId,
        accessToken: widget.accessToken,
        responseType: responseType,
        clientActionId:
            "${widget.requestId}-${DateTime.now().millisecondsSinceEpoch}",
        confidence: responseType == "Confirmed" ? "High" : "Medium",
      );
      if (!mounted) return;
      setState(() {
        _completion = completion;
        _submitting = false;
      });
      HapticFeedback.heavyImpact();
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Unable to submit response. Try again when online."),
        ),
      );
    }
  }

  Future<void> _skip() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final completion = await widget.service.skip(
        requestId: widget.requestId,
        accessToken: widget.accessToken,
        clientActionId:
            "${widget.requestId}-skip-${DateTime.now().millisecondsSinceEpoch}",
      );
      if (!mounted) return;
      setState(() {
        _completion = completion;
        _submitting = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
    }
  }

  void _announceSummary() {
    final text =
        _payload?.spokenSummaryTemplate ?? kCommunityVerificationSafetyWarning;
    SemanticsService.announce(text, TextDirection.ltr);
    HapticFeedback.selectionClick();
  }

  void _finish() {
    Navigator.of(context).pushNamedAndRemoveUntil("/home", (route) => false);
  }

  Future<void> _openEvidence(
      CommunityVerificationEvidencePreview preview) async {
    final url = preview.previewUrl?.trim();
    if (url == null || url.isEmpty) return;
    if (preview.isImage) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => Dialog(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: InteractiveViewer(
                  child: Image.network(
                    url,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text("Photo preview is unavailable right now."),
                    ),
                  ),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text("Close"),
              ),
            ],
          ),
        ),
      );
      return;
    }
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  String _formatReportedTime(String raw) {
    final parsed = DateTime.tryParse(raw)?.toLocal();
    if (parsed == null) return raw;
    final hour24 = parsed.hour;
    final hour12 = hour24 == 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
    final suffix = hour24 >= 12 ? "PM" : "AM";
    final minute = parsed.minute.toString().padLeft(2, "0");
    return "${parsed.day}/${parsed.month}/${parsed.year} $hour12:$minute $suffix";
  }

  @override
  Widget build(BuildContext context) {
    return NwPrototypeScaffold(
      title: _payload?.categoryDisplayLabel ?? "Community Verification",
      leading: NwPrototypeIconButton(
        icon: Icons.arrow_back,
        onPressed: () => Navigator.of(context).maybePop(),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: NwPrototypeNotice(
                      title: "Verification unavailable",
                      message: _error!,
                      icon: Icons.error_outline,
                      color: BrandColors.danger,
                    ),
                  ),
                )
              : _completion != null
                  ? _buildThankYou(_completion!)
                  : _buildForm(_payload!),
    );
  }

  Widget _buildThankYou(CommunityVerificationCompletion completion) {
    return Semantics(
      label: completion.message,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: NwPrototypeCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.check_circle_outline,
                  size: 72, color: BrandColors.green),
              const SizedBox(height: 16),
              Text(
                completion.message,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              EyePrimaryButton(label: "Return home", onPressed: _finish),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildForm(CommunityVerificationPayload payload) {
    if (payload.isExpired || payload.alreadyResponded) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            payload.isExpired
                ? "This verification request has expired."
                : "You already responded.",
          ),
        ),
      );
    }

    final actions = _responseActions(payload.allowedResponses);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NwPrototypeCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    "Verification Detail",
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  payload.categoryDisplayLabel,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                    "${payload.approximateArea} • ${payload.approximateDistance}"),
                Text("Reported ${_formatReportedTime(payload.reportTime)}"),
                const SizedBox(height: 12),
                Text(payload.sanitizedDescription),
              ],
            ),
          ),
          if (payload.approvedEvidencePreviews.isNotEmpty) ...[
            const SizedBox(height: 18),
            const NwPrototypeSectionHeading(title: "Evidence"),
            const SizedBox(height: 8),
            ...payload.approvedEvidencePreviews.map(
              (preview) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: NwPrototypeListCard(
                  title: preview.isImage
                      ? "Photo evidence"
                      : preview.isVideo
                          ? "Video evidence"
                          : preview.isAudio
                              ? "Audio evidence"
                              : "Evidence",
                  subtitle:
                      preview.previewUrl == null || preview.previewUrl!.isEmpty
                          ? "Preview unavailable right now"
                          : preview.isImage
                              ? "Tap to view"
                              : "Tap to open",
                  leading: preview.isImage
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: SizedBox(
                            width: 52,
                            height: 52,
                            child: preview.previewUrl == null ||
                                    preview.previewUrl!.isEmpty
                                ? const ColoredBox(
                                    color: Color(0xFFF3F4F6),
                                    child: Icon(
                                        Icons.image_not_supported_outlined),
                                  )
                                : Image.network(
                                    preview.previewUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) =>
                                        const ColoredBox(
                                      color: Color(0xFFF3F4F6),
                                      child: Icon(Icons.broken_image_outlined),
                                    ),
                                  ),
                          ),
                        )
                      : Icon(
                          preview.isVideo
                              ? Icons.videocam_outlined
                              : preview.isAudio
                                  ? Icons.audiotrack
                                  : Icons.attach_file,
                        ),
                  trailing:
                      preview.previewUrl == null || preview.previewUrl!.isEmpty
                          ? null
                          : const Icon(Icons.open_in_new),
                  onTap:
                      preview.previewUrl == null || preview.previewUrl!.isEmpty
                          ? null
                          : () => _openEvidence(preview),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          NwPrototypeNotice(
            title: "Stay safe",
            message: payload.safetyNotice.isNotEmpty
                ? payload.safetyNotice
                : kCommunityVerificationSafetyWarning,
            icon: Icons.emergency_outlined,
            color: BrandColors.orange,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () =>
                Navigator.of(context).pushNamed("/report/emergency"),
            icon: const Icon(Icons.emergency_outlined),
            label: const Text("Immediate danger? Report Emergency"),
          ),
          const SizedBox(height: 12),
          EyePrimaryButton(
              label: "Listen to summary", onPressed: _announceSummary),
          const SizedBox(height: 20),
          if (actions.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                "This request can only be reviewed safely later. You can skip it for now.",
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            )
          else
            ...actions.map(
              (action) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Semantics(
                  button: true,
                  label: action.label,
                  child: EyePrimaryButton(
                    label: action.label,
                    onPressed: _submitting ? null : () => _submit(action.type),
                  ),
                ),
              ),
            ),
          TextButton(
            onPressed: _submitting ? null : _skip,
            child: const Text("Skip"),
          ),
        ],
      ),
    );
  }

  List<_ResponseAction> _responseActions(List<String> allowed) {
    const labels = {
      "Confirmed": "Confirm Incident",
      "NotFound": "Incident Not Found",
    };
    return allowed
        .where((type) => labels.containsKey(type))
        .map((type) => _ResponseAction(type: type, label: labels[type]!))
        .toList();
  }
}

class _ResponseAction {
  const _ResponseAction({required this.type, required this.label});

  final String type;
  final String label;
}
