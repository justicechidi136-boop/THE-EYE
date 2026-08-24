import "package:flutter/material.dart";

import "../../brand.dart";
import "../../theme/the_eye_theme.dart";
import "../eye_semantic_colors.dart";
import "../tokens.dart";
import "../typography.dart";

/// Primary navigation: Home, local Feed, Eye (SOS), Broadcast, Settings.
abstract final class EyeNavRoutes {
  static const home = "/home";
  static const neighborhoodWatch = "/neighborhood-watch";
  static const broadcast = "/broadcasts";
  static const settings = "/settings";

  static const tabs = [home, neighborhoodWatch, broadcast, settings];

  static int selectedIndexForRoute(String? route) {
    if (route == null) return 0;
    if (route == home) return 0;
    if (route.startsWith("/neighborhood-watch")) {
      return 1;
    }
    if (route == broadcast || route == "/notifications") return 3;
    if (route.startsWith("/broadcasts/")) return 3;
    if (route == settings || route == "/profile" || route == "/your-car") {
      return 4;
    }
    return 0;
  }
}

class EyeBottomNav extends StatelessWidget {
  const EyeBottomNav({
    required this.selectedIndex,
    required this.onTabSelected,
    required this.onEyePressed,
    this.homeLabel = "Home",
    this.neighborhoodLabel = "Feed",
    this.broadcastLabel = "Broadcast",
    this.settingsLabel = "Settings",
    super.key,
  });

  final int selectedIndex;
  final ValueChanged<int> onTabSelected;
  final VoidCallback onEyePressed;
  final String homeLabel;
  final String neighborhoodLabel;
  final String broadcastLabel;
  final String settingsLabel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: EyeTokens.bottomNavHeight + MediaQuery.paddingOf(context).bottom,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: context.eyeSurface,
                border: Border(
                    top: BorderSide(
                        color: context.isDarkTheme
                            ? context.eyeBorder
                            : EyeTokens.stroke)),
              ),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  height: EyeTokens.bottomNavHeight,
                  child: Row(
                    children: [
                      _NavItem(
                        icon: Icons.home_rounded,
                        label: homeLabel,
                        selected: selectedIndex == 0,
                        onTap: () => onTabSelected(0),
                      ),
                      _NavItem(
                        icon: Icons.forum_rounded,
                        label: neighborhoodLabel,
                        selected: selectedIndex == 1,
                        onTap: () => onTabSelected(1),
                      ),
                      const Expanded(child: SizedBox()),
                      _NavItem(
                        icon: Icons.campaign_outlined,
                        label: broadcastLabel,
                        selected: selectedIndex == 3,
                        onTap: () => onTabSelected(3),
                      ),
                      _NavItem(
                        icon: Icons.settings_outlined,
                        label: settingsLabel,
                        selected: selectedIndex == 4,
                        onTap: () => onTabSelected(4),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: -18,
            child: Semantics(
              button: true,
              label: "Send SOS emergency alert",
              child: Material(
                color: context.eyeSurface,
                shape: const CircleBorder(),
                elevation: 4,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: onEyePressed,
                  child: Container(
                    width: EyeTokens.eyeFabSize,
                    height: EyeTokens.eyeFabSize,
                    padding: const EdgeInsets.all(5),
                    child: DecoratedBox(
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: EyeTokens.greenMain,
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Image.asset(
                          BrandAssets.logomark,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.visibility,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final color = selected
        ? semantics.interactiveText
        : (context.isDarkTheme ? semantics.mutedText : EyeTokens.black1);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(
              label,
              style: EyeTypography.navLabelFor(context, selected: selected),
            ),
          ],
        ),
      ),
    );
  }
}
