import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/eye_colors.dart';

/// Brand asset paths (copied from mobile).
abstract final class WatchBrandAssets {
  static const logomark =
      'assets/images/brand/the-eye-logomark-transparent.png';
  static const appIcon = 'assets/images/brand/the-eye-app-icon-dark-green.png';
}

bool isRoundWatch(BuildContext context) {
  final size = MediaQuery.sizeOf(context);
  return size.shortestSide < 220 && (size.width - size.height).abs() < 24;
}

class WatchScreenShell extends StatelessWidget {
  const WatchScreenShell({
    super.key,
    required this.child,
    this.showTopBar = true,
    this.enableBack = true,
    this.onBack,
    this.onLeadingTap,
    this.leadingLabel = 'Back',
    this.padding = const EdgeInsets.symmetric(horizontal: 12),
  });

  final Widget child;
  final bool showTopBar;
  final bool enableBack;
  final VoidCallback? onBack;
  final VoidCallback? onLeadingTap;
  final String leadingLabel;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final round = isRoundWatch(context);
    return Scaffold(
      backgroundColor: EyeColors.dark,
      body: SafeArea(
        minimum: round ? const EdgeInsets.all(8) : EdgeInsets.zero,
        child: Padding(
          padding: padding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (showTopBar)
                WatchTopBar(
                  leadingLabel: leadingLabel,
                  onBack: enableBack
                      ? (onBack ??
                          () {
                            if (Navigator.canPop(context)) {
                              Navigator.pop(context);
                            }
                          })
                      : onLeadingTap,
                ),
              Expanded(child: child),
            ],
          ),
        ),
      ),
    );
  }
}

class WatchTopBar extends StatefulWidget {
  const WatchTopBar({
    super.key,
    this.onBack,
    this.leadingLabel = 'Back',
  });

  final VoidCallback? onBack;
  final String leadingLabel;

  @override
  State<WatchTopBar> createState() => _WatchTopBarState();
}

class _WatchTopBarState extends State<WatchTopBar> {
  late Timer _clock;
  late DateTime _now;

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    _clock = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  String _formatTime(DateTime time) {
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: widget.onBack,
            child: Text(
              widget.leadingLabel,
              style: TextStyle(
                color: EyeColors.white,
                fontSize: 12,
                fontWeight: FontWeight.w400,
                decoration: widget.onBack != null ? null : TextDecoration.none,
              ),
            ),
          ),
          Text(
            _formatTime(_now),
            style: TextStyle(
              color: EyeColors.white.withValues(alpha: 0.85),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class WatchLogomark extends StatelessWidget {
  const WatchLogomark({super.key, this.size = 70});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      WatchBrandAssets.logomark,
      width: size,
      height: size,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => Icon(
        Icons.visibility,
        color: EyeColors.green,
        size: size * 0.7,
      ),
    );
  }
}

class WatchStatusChip extends StatelessWidget {
  const WatchStatusChip({
    super.key,
    required this.label,
    this.tone = WatchStatusTone.safe,
  });

  final String label;
  final WatchStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      WatchStatusTone.safe => EyeColors.green,
      WatchStatusTone.warning => EyeColors.orange,
      WatchStatusTone.danger => EyeColors.danger,
    };

    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.4),
                  blurRadius: 15,
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 8,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

enum WatchStatusTone { safe, warning, danger }

class WatchMetricColumn extends StatelessWidget {
  const WatchMetricColumn({
    super.key,
    required this.value,
    required this.label,
    this.onTap,
  });

  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: EyeColors.green,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: EyeColors.white,
              fontSize: 7,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class WatchHomeSosButton extends StatelessWidget {
  const WatchHomeSosButton({
    super.key,
    required this.onHoldStart,
    required this.onHoldEnd,
    this.progress = 0,
  });

  final VoidCallback onHoldStart;
  final VoidCallback onHoldEnd;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPressStart: (_) => onHoldStart(),
      onLongPressEnd: (_) => onHoldEnd(),
      onLongPressCancel: onHoldEnd,
      child: SizedBox(
        width: 35,
        height: 35,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (progress > 0)
              CircularProgressIndicator(
                value: progress,
                strokeWidth: 2,
                color: EyeColors.orange,
                backgroundColor: EyeColors.surface,
              ),
            Container(
              width: 35,
              height: 35,
              decoration: const BoxDecoration(
                color: EyeColors.danger,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Text(
                'SOS',
                style: TextStyle(
                  color: EyeColors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WatchSosHoldButton extends StatelessWidget {
  const WatchSosHoldButton({
    super.key,
    required this.onHoldStart,
    required this.onHoldEnd,
    required this.progress,
    this.label = 'SOS',
    this.size = 64,
  });

  final VoidCallback onHoldStart;
  final VoidCallback onHoldEnd;
  final double progress;
  final String label;
  final double size;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPressStart: (_) => onHoldStart(),
      onLongPressEnd: (_) => onHoldEnd(),
      onLongPressCancel: onHoldEnd,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (progress > 0)
              SizedBox(
                width: size,
                height: size,
                child: CircularProgressIndicator(
                  value: progress,
                  strokeWidth: 3,
                  color: EyeColors.danger,
                  backgroundColor: EyeColors.danger.withValues(alpha: 0.15),
                ),
              ),
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: EyeColors.danger, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: EyeColors.danger.withValues(alpha: 0.5),
                    blurRadius: 8,
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: Text(
                label,
                style: const TextStyle(
                  color: EyeColors.danger,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WatchCountdownDisplay extends StatelessWidget {
  const WatchCountdownDisplay({
    super.key,
    required this.seconds,
    this.subtitle = 'Sending location + alert to your emergency contacts',
  });

  final int seconds;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$seconds',
          style: const TextStyle(
            color: EyeColors.danger,
            fontSize: 40,
            fontWeight: FontWeight.w800,
            height: 0.9,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: EyeColors.white,
            fontSize: 8,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class WatchOutlineButton extends StatelessWidget {
  const WatchOutlineButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.color = EyeColors.green,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 32,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          textStyle: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
        onPressed: onPressed,
        child: Text(label.toUpperCase()),
      ),
    );
  }
}

class WatchPrimaryButton extends StatelessWidget {
  const WatchPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.color = EyeColors.green,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 36,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: EyeColors.white,
          disabledBackgroundColor: EyeColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          textStyle: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
        onPressed: onPressed,
        child: Text(label.toUpperCase()),
      ),
    );
  }
}

class WatchNotificationBadge extends StatelessWidget {
  const WatchNotificationBadge({super.key, this.size = 80});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: EyeColors.green, width: 3),
              boxShadow: [
                BoxShadow(
                  color: EyeColors.green.withValues(alpha: 0.4),
                  blurRadius: 20,
                ),
              ],
            ),
          ),
          Container(
            width: size * 0.5,
            height: size * 0.5,
            decoration: const BoxDecoration(
              color: EyeColors.orange,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.notifications,
              color: EyeColors.white,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }
}

class WatchAlertCard extends StatelessWidget {
  const WatchAlertCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.onTap,
    this.onLongPress,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: EyeColors.surface,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: EyeColors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                color: EyeColors.muted,
                fontSize: 10,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class WatchInfoRow extends StatelessWidget {
  const WatchInfoRow({
    super.key,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: EyeColors.muted, fontSize: 11),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: valueColor ?? EyeColors.white,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WatchSectionTitle extends StatelessWidget {
  const WatchSectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: EyeColors.white,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

String formatWatchDate(DateTime date) {
  const weekdays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return '${weekdays[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}';
}
