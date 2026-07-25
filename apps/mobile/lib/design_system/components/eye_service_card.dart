import "package:flutter/material.dart";

import "../eye_semantic_colors.dart";
import "../eye_input_theme.dart";

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
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: SizedBox(
          height: 150,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              children: [
                const SizedBox(height: 16),
                Container(
                  width: 50,
                  height: 47,
                  decoration: BoxDecoration(
                    color: semantics.elevatedSurface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 32, color: semantics.bodyText),
                ),
                const SizedBox(height: 10),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: semantics.bodyText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                    color: semantics.secondaryText,
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
