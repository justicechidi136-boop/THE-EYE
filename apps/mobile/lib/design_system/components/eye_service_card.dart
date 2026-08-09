import "package:flutter/material.dart";

import "../eye_semantic_colors.dart";

class EyeServiceCard extends StatelessWidget {
  const EyeServiceCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.onTap,
    super.key,
  });

  final String title;
  final String description;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Material(
      color: semantics.cardSurface,
      borderRadius: BorderRadius.circular(8),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 12, 8, 10),
          child: Column(
            children: [
              Container(
                width: 44,
                height: 42,
                decoration: BoxDecoration(
                  color: semantics.elevatedSurface,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 28, color: semantics.bodyText),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  height: 1.15,
                  color: semantics.bodyText,
                ),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: Text(
                  description,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    height: 1.2,
                    color: semantics.secondaryText,
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
