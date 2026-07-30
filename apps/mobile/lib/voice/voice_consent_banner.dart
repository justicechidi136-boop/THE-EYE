import "package:flutter/material.dart";

class VoiceConsentBanner extends StatelessWidget {
  const VoiceConsentBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: "Voice recording consent",
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          "By recording, you consent that your voice will be uploaded securely, may be listened to by authorised officials, and may be transcribed automatically. For anonymous reports, your voice may still be recognisable.",
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
      ),
    );
  }
}
