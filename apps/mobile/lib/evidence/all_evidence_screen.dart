import "package:flutter/material.dart";

import "../design_system/components/eye_page_header.dart";
import "evidence_collection.dart";
import "evidence_item.dart";
import "evidence_video_thumbnail.dart";

class AllEvidenceScreen extends StatelessWidget {
  const AllEvidenceScreen({
    required this.items,
    this.title = "All Evidence",
    this.onRetry,
    this.thumbnailProvider = const DeviceEvidenceVideoThumbnailProvider(),
    super.key,
  });

  static const routeName = "/all-evidence";

  final List<EvidenceItem> items;
  final String title;
  final VoidCallback? onRetry;
  final EvidenceVideoThumbnailProvider thumbnailProvider;

  static Future<void> open(
    BuildContext context, {
    required List<EvidenceItem> items,
    String title = "All Evidence",
    VoidCallback? onRetry,
  }) {
    return Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            settings: const RouteSettings(name: routeName),
            builder: (_) => AllEvidenceScreen(
              items: items,
              title: title,
              onRetry: onRetry,
            ),
          ),
        )
        .then((_) {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EyePageHeader.secondary(title: title),
          Expanded(
            child: items.isEmpty
                ? _EmptyEvidence(onRetry: onRetry)
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                    children: [
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: items
                            .where(
                                (item) => item.kind != EvidenceItemKind.audio)
                            .length,
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                        ),
                        itemBuilder: (context, index) {
                          final visual = items
                              .where(
                                  (item) => item.kind != EvidenceItemKind.audio)
                              .toList(growable: false);
                          return EvidenceMediaTile(
                            item: visual[index],
                            thumbnailProvider: thumbnailProvider,
                          );
                        },
                      ),
                      for (final item in items.where(
                          (item) => item.kind == EvidenceItemKind.audio)) ...[
                        const SizedBox(height: 8),
                        EvidenceAudioRow(item: item),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _EmptyEvidence extends StatelessWidget {
  const _EmptyEvidence({this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.perm_media_outlined, size: 48),
            const SizedBox(height: 12),
            const Text("No evidence is available."),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text("Retry"),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
