import "dart:io";

import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";
import "../presentation/citizen_date_time.dart";
import "evidence_item.dart";
import "evidence_video_thumbnail.dart";
import "evidence_viewer_screen.dart";

class CompactEvidenceCollection extends StatelessWidget {
  const CompactEvidenceCollection({
    required this.items,
    this.emptyMessage = "No evidence attached.",
    this.onViewAll,
    this.onAddMore,
    this.thumbnailProvider = const DeviceEvidenceVideoThumbnailProvider(),
    this.showHeader = true,
    super.key,
  });

  final List<EvidenceItem> items;
  final String emptyMessage;
  final VoidCallback? onViewAll;
  final VoidCallback? onAddMore;
  final EvidenceVideoThumbnailProvider thumbnailProvider;
  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    final visible = items.take(3).toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showHeader)
          Row(
            children: [
              const Expanded(
                child: Text(
                  "Evidence",
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (items.isNotEmpty && onViewAll != null)
                TextButton(onPressed: onViewAll, child: const Text("View All")),
            ],
          ),
        if (items.isEmpty)
          Text(emptyMessage)
        else ...[
          LayoutBuilder(
            builder: (context, constraints) {
              final width = (constraints.maxWidth - 16) / 3;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final item in visible)
                    if (item.kind == EvidenceItemKind.audio)
                      SizedBox(
                        width: constraints.maxWidth,
                        child: EvidenceAudioRow(item: item),
                      )
                    else
                      SizedBox(
                        width: width,
                        height: width,
                        child: EvidenceMediaTile(
                          item: item,
                          thumbnailProvider: thumbnailProvider,
                        ),
                      ),
                ],
              );
            },
          ),
          if (items.length > visible.length && onViewAll != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: onViewAll,
                icon: const Icon(Icons.grid_view_outlined),
                label: Text("View all ${items.length} items"),
              ),
            ),
        ],
        if (onAddMore != null)
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: onAddMore,
              icon: const Icon(Icons.add),
              label: const Text("Add more"),
            ),
          ),
      ],
    );
  }
}

class EvidenceMediaTile extends StatelessWidget {
  const EvidenceMediaTile({
    required this.item,
    this.thumbnailProvider = const DeviceEvidenceVideoThumbnailProvider(),
    this.onTap,
    super.key,
  });

  final EvidenceItem item;
  final EvidenceVideoThumbnailProvider thumbnailProvider;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Semantics(
      button: true,
      label: "Open ${item.label}",
      child: Material(
        color: colors.elevatedSurface,
        borderRadius: BorderRadius.circular(8),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap ?? () => _open(context),
          child: Stack(
            fit: StackFit.expand,
            children: [
              _preview(colors),
              if (item.kind == EvidenceItemKind.video)
                const Center(
                  child: Icon(
                    Icons.play_circle_fill,
                    color: Colors.white,
                    size: 38,
                  ),
                ),
              Align(
                alignment: Alignment.bottomCenter,
                child: ColoredBox(
                  color: Colors.black.withValues(alpha: 0.68),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 4,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (item.durationSeconds != null)
                          Text(
                            formatEvidenceDuration(item.durationSeconds!),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _preview(EyeSemanticColors colors) {
    if (item.kind == EvidenceItemKind.video) {
      return EvidenceVideoThumbnail(
        item: item,
        provider: thumbnailProvider,
      );
    }
    if (item.kind == EvidenceItemKind.photo) {
      final path = item.localPath;
      if (path != null && path.isNotEmpty) {
        return Image.file(
          File(path),
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) =>
              _fallback(Icons.broken_image_outlined, colors),
        );
      }
      return FutureBuilder<Uri>(
        future: item.resolveUri(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
                child: CircularProgressIndicator(strokeWidth: 2));
          }
          if (!snapshot.hasData) {
            return _fallback(Icons.broken_image_outlined, colors);
          }
          return Image.network(
            snapshot.data.toString(),
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) =>
                _fallback(Icons.broken_image_outlined, colors),
          );
        },
      );
    }
    return _fallback(Icons.attach_file, colors);
  }

  Widget _fallback(IconData icon, EyeSemanticColors colors) => Center(
        child: Icon(icon, color: colors.mutedText, size: 32),
      );

  void _open(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => EvidenceViewerScreen(item: item),
        settings: RouteSettings(name: "/evidence/${item.id}"),
      ),
    );
  }
}

class EvidenceAudioRow extends StatelessWidget {
  const EvidenceAudioRow({required this.item, super.key});

  final EvidenceItem item;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Material(
      color: colors.elevatedSurface,
      borderRadius: BorderRadius.circular(8),
      child: ListTile(
        dense: true,
        leading: const Icon(Icons.graphic_eq),
        title: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text([
          if (item.durationSeconds != null)
            formatEvidenceDuration(item.durationSeconds!),
          if (item.createdAt != null)
            CitizenDateTimeFormatter.formatReportedAt(item.createdAt!),
        ].join(" · ")),
        trailing: const Icon(Icons.play_arrow),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => EvidenceViewerScreen(item: item),
            settings: RouteSettings(name: "/evidence/${item.id}"),
          ),
        ),
      ),
    );
  }
}
