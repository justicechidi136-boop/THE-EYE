import 'dart:async';

import 'package:flutter/material.dart';

import '../eye_tokens.dart';

bool isRoundWatchLayout(BuildContext context) {
  final size = MediaQuery.sizeOf(context);
  return size.shortestSide < 220 && (size.width - size.height).abs() < 24;
}

/// Prototype-aligned watch screen shell with top bar clock + optional back.
class WatchScaffold extends StatelessWidget {
  const WatchScaffold({
    super.key,
    required this.child,
    this.showTopBar = true,
    this.enableBack = true,
    this.onBack,
    this.onLeadingTap,
    this.leadingLabel = 'Back',
    this.padding = const EdgeInsets.symmetric(horizontal: EyeTokens.spaceMd),
    this.backgroundColor = EyeTokens.watchBackground,
  });

  final Widget child;
  final bool showTopBar;
  final bool enableBack;
  final VoidCallback? onBack;
  final VoidCallback? onLeadingTap;
  final String leadingLabel;
  final EdgeInsets padding;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    final round = isRoundWatchLayout(context);
    return Scaffold(
      backgroundColor: backgroundColor,
      body: SafeArea(
        minimum: round
            ? const EdgeInsets.all(EyeTokens.safeAreaInsetRound)
            : const EdgeInsets.all(EyeTokens.safeAreaInsetSquare),
        child: Padding(
          padding: padding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (showTopBar)
                _WatchTopBar(
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

class _WatchTopBar extends StatefulWidget {
  const _WatchTopBar({this.onBack, this.leadingLabel = 'Back'});

  final VoidCallback? onBack;
  final String leadingLabel;

  @override
  State<_WatchTopBar> createState() => _WatchTopBarState();
}

class _WatchTopBarState extends State<_WatchTopBar> {
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
      padding: const EdgeInsets.only(
        top: EyeTokens.spaceXs,
        bottom: EyeTokens.spaceSm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: widget.onBack,
            child: Text(
              widget.leadingLabel,
              style: const TextStyle(
                color: EyeTokens.white,
                fontSize: 12,
                fontWeight: FontWeight.w400,
              ),
            ),
          ),
          Text(
            _formatTime(_now),
            style: TextStyle(
              color: EyeTokens.white.withValues(alpha: 0.85),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
