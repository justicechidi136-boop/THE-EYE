import "package:flutter/material.dart";

import "../tokens.dart";
import "../typography.dart";

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
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
        onTap: onTap,
        child: SizedBox(
          height: EyeTokens.serviceCardHeight,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              children: [
                const SizedBox(height: 16),
                Container(
                  width: 50,
                  height: 47,
                  decoration: BoxDecoration(
                    color: EyeTokens.whiteBg,
                    borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 32, color: EyeTokens.black1),
                ),
                const SizedBox(height: 10),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: EyeTypography.serviceTitle,
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: EyeTypography.serviceDescription,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
