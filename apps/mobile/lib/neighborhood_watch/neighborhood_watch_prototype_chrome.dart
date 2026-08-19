import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";

class NwPrototypeScaffold extends StatelessWidget {
  const NwPrototypeScaffold({
    required this.title,
    required this.body,
    this.leading,
    this.actions = const [],
    this.tabs,
    this.floatingActionButton,
    super.key,
  });

  final String title;
  final Widget body;
  final Widget? leading;
  final List<Widget> actions;
  final Widget? tabs;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Scaffold(
      backgroundColor: semantics.background,
      floatingActionButton: floatingActionButton,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Row(
                children: [
                  if (leading != null) ...[
                    leading!,
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0,
                          ),
                    ),
                  ),
                  ...actions,
                ],
              ),
            ),
            if (tabs != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: tabs!,
              ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

class NwPrototypeIconButton extends StatelessWidget {
  const NwPrototypeIconButton({
    required this.icon,
    required this.onPressed,
    this.hasDot = false,
    super.key,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool hasDot;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(17),
            child: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: semantics.elevatedSurface,
                borderRadius: BorderRadius.circular(17),
                border: Border.all(color: semantics.divider),
              ),
              child: Icon(icon, size: 18),
            ),
          ),
          if (hasDot)
            Positioned(
              right: 2,
              top: 2,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFFFF9933),
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class NwPrototypeSegmentTabs extends StatelessWidget {
  const NwPrototypeSegmentTabs({
    required this.labels,
    required this.selectedIndex,
    this.onSelected,
    super.key,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int>? onSelected;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: InkWell(
              onTap: onSelected == null ? null : () => onSelected!(i),
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: i == selectedIndex
                      ? const Color(0x22FF9933)
                      : semantics.elevatedSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: i == selectedIndex
                        ? const Color(0x66FF9933)
                        : semantics.divider,
                  ),
                ),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    labels[i],
                    maxLines: 1,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: i == selectedIndex
                              ? const Color(0xFFFF9933)
                              : semantics.secondaryText,
                        ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class NwPrototypeCard extends StatelessWidget {
  const NwPrototypeCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.highlight = false,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: highlight ? const Color(0x14FF9933) : semantics.cardSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: highlight ? const Color(0x55FF9933) : semantics.divider,
        ),
      ),
      child: child,
    );
  }
}

class NwPrototypePill extends StatelessWidget {
  const NwPrototypePill({
    required this.label,
    this.selected = false,
    this.color,
    super.key,
  });

  final String label;
  final bool selected;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final accent = color ?? const Color(0xFFFF9933);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: selected
            ? accent.withValues(alpha: 0.14)
            : semantics.elevatedSurface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: selected ? accent.withValues(alpha: 0.45) : semantics.divider,
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: selected ? accent : semantics.secondaryText,
            ),
      ),
    );
  }
}

class NwPrototypeSectionHeading extends StatelessWidget {
  const NwPrototypeSectionHeading({
    required this.title,
    this.actionLabel,
    this.onAction,
    super.key,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            child: Text(actionLabel!),
          ),
      ],
    );
  }
}

class NwPrototypeStatTile extends StatelessWidget {
  const NwPrototypeStatTile({
    required this.value,
    required this.label,
    this.accent,
    this.onTap,
    super.key,
  });

  final String value;
  final String label;
  final Color? accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: semantics.elevatedSurface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: accent,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 11,
                    color: semantics.secondaryText,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class NwPrototypeActionTile extends StatelessWidget {
  const NwPrototypeActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
    this.color,
    super.key,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool primary;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final accent = color ?? const Color(0xFFFF9933);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
          decoration: BoxDecoration(
            color: primary
                ? accent.withValues(alpha: 0.14)
                : semantics.elevatedSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color:
                  primary ? accent.withValues(alpha: 0.45) : semantics.divider,
            ),
          ),
          child: Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: primary ? accent : accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: primary ? const Color(0xFF1A1206) : accent,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class NwPrototypeListCard extends StatelessWidget {
  const NwPrototypeListCard({
    required this.title,
    required this.subtitle,
    this.leading,
    this.trailing,
    this.badge,
    this.onTap,
    this.child,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget? leading;
  final Widget? trailing;
  final Widget? badge;
  final VoidCallback? onTap;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: semantics.cardSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: semantics.divider),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (leading != null) ...[
              leading!,
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                      ),
                      if (badge != null) ...[
                        const SizedBox(width: 8),
                        badge!,
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 12,
                          color: semantics.secondaryText,
                          height: 1.4,
                        ),
                  ),
                  if (child != null) ...[
                    const SizedBox(height: 10),
                    child!,
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: 10),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}

class NwPrototypeNotice extends StatelessWidget {
  const NwPrototypeNotice({
    required this.title,
    required this.message,
    this.icon = Icons.info_outline,
    this.color,
    super.key,
  });

  final String title;
  final String message;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? const Color(0xFFFF9933);
    return NwPrototypeCard(
      highlight: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: accent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: accent,
                      ),
                ),
                const SizedBox(height: 4),
                Text(message, style: const TextStyle(fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class NwPrototypeFilterChips extends StatelessWidget {
  const NwPrototypeFilterChips({
    required this.labels,
    required this.selectedLabel,
    required this.onSelected,
    super.key,
  });

  final List<String> labels;
  final String selectedLabel;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            ChoiceChip(
              label: Text(labels[i]),
              labelStyle: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
              selected: labels[i] == selectedLabel,
              onSelected: (_) => onSelected(labels[i]),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ],
      ),
    );
  }
}
