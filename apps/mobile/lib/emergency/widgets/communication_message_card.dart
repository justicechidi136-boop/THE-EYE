import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "../../presentation/citizen_presentation.dart";
import "../incident_communication_contract.dart";

class CommunicationMessageCard extends StatelessWidget {
  const CommunicationMessageCard({
    super.key,
    required this.message,
    this.onPlayVoice,
    this.aiVoice,
    this.queued = false,
  });

  final IncidentThreadMessage message;
  final VoidCallback? onPlayVoice;
  final Widget? aiVoice;
  final bool queued;

  bool get _isYou =>
      message.senderRole == "Reporter" || message.senderLabel == "You";

  bool get _isOfficial =>
      message.senderRole == "Agency" ||
      message.senderRole == "Dispatcher" ||
      message.senderRole == "Responder";

  String get _typeLabel {
    return switch (message.messageType) {
      "Text" || "QuickReply" => "TEXT UPDATE",
      "Image" => "PHOTO",
      "Video" => "VIDEO",
      "Voice" => "VOICE",
      "LocationUpdate" => "LOCATION",
      "InformationRequest" => "INFO REQUEST",
      _ => message.messageType.toUpperCase(),
    };
  }

  Color _accent(EyeSemanticColors colors) {
    if (_isYou) return colors.success;
    if (_isOfficial) return colors.information;
    return colors.mutedText;
  }

  String get _receiptLabel {
    if (queued) return "Queued offline";
    return switch (message.deliveryState) {
      "Read" => "Seen",
      "Delivered" => "Delivered",
      "Sent" || null => "Sent",
      _ => message.deliveryState!,
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final accent = _accent(colors);
    final time = CitizenDateTimeFormatter.formatTime(message.createdAt);
    final isVoice = message.messageType == "Voice";
    final isPhoto =
        message.messageType == "Image" || message.messageType == "Video";

    return Semantics(
      label:
          "${message.senderLabel}, $_typeLabel, $time, ${message.body}, $_receiptLabel",
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.cardSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(13),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: accent.withValues(alpha: 0.12),
                      border: Border.all(color: Colors.transparent),
                    ),
                    child: Icon(
                      _isOfficial
                          ? Icons.shield_outlined
                          : Icons.person_outline,
                      size: 14,
                      color: accent,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          message.senderLabel,
                          style: TextStyle(
                            color: colors.bodyText,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          time,
                          style: TextStyle(
                            color: accent,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(left: 37, top: 8, bottom: 5),
                child: Text(
                  _typeLabel,
                  style: TextStyle(
                    color: accent,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              if (isVoice)
                Padding(
                  padding: const EdgeInsets.only(left: 37),
                  child: aiVoice ?? _VoiceRow(onPlay: onPlayVoice),
                )
              else if (isPhoto)
                Padding(
                  padding: const EdgeInsets.only(left: 37),
                  child: _MediaPlaceholder(
                    label: message.messageType == "Video"
                        ? "Video attached"
                        : "Photo attached",
                    icon: message.messageType == "Video"
                        ? Icons.play_circle_outline
                        : Icons.image_outlined,
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(left: 37),
                  child: Text(
                    message.body,
                    style: TextStyle(
                      color: colors.bodyText.withValues(alpha: 0.92),
                      fontSize: 12.5,
                      height: 1.4,
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  _receiptLabel,
                  style: TextStyle(
                    color: colors.mutedText,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VoiceRow extends StatelessWidget {
  const _VoiceRow({this.onPlay});

  final VoidCallback? onPlay;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Semantics(
      button: true,
      label: "Play voice message",
      child: Material(
        color: colors.elevatedSurface,
        borderRadius: BorderRadius.circular(9),
        child: InkWell(
          onTap: onPlay,
          borderRadius: BorderRadius.circular(9),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.cardSurface,
                    border: Border.all(color: colors.border),
                  ),
                  child:
                      Icon(Icons.play_arrow, size: 14, color: colors.bodyText),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    height: 14,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      color: colors.border.withValues(alpha: 0.55),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  "Voice",
                  style: TextStyle(
                    color: colors.mutedText,
                    fontSize: 10.5,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MediaPlaceholder extends StatelessWidget {
  const _MediaPlaceholder({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Container(
      width: 110,
      height: 82,
      decoration: BoxDecoration(
        color: colors.elevatedSurface,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: colors.mutedText),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.mutedText, fontSize: 10),
          ),
        ],
      ),
    );
  }
}
