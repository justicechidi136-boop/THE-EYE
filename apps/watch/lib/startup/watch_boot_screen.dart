import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../config/watch_flavor.dart';
import '../design_system/components/watch_scaffold.dart';
import '../design_system/eye_tokens.dart';
import '../screens/routes.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../widgets/watch_ui.dart';
import 'watch_boot_sequencer.dart';
import 'watch_boot_stage.dart';

/// Branded THE EYE Wear OS boot screen — shown immediately after native splash.
class WatchBootScreen extends StatefulWidget {
  const WatchBootScreen({
    super.key,
    required this.services,
    required this.launcher,
    this.sequencer,
    this.minDisplay = const Duration(milliseconds: 600),
  });

  final WatchAppServices services;
  final LauncherService launcher;
  final WatchBootSequencer? sequencer;
  final Duration minDisplay;

  @override
  State<WatchBootScreen> createState() => _WatchBootScreenState();
}

class _WatchBootScreenState extends State<WatchBootScreen>
    with SingleTickerProviderStateMixin {
  double _progress = 0.08;
  String _status = 'Initializing...';
  String? _error;
  bool _busy = true;
  bool _isDebug = kDebugMode;
  late final AnimationController _fadeOut;

  @override
  void initState() {
    super.initState();
    _fadeOut = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _boot();
  }

  @override
  void dispose() {
    _fadeOut.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0.08;
      _status = 'Initializing...';
    });

    final started = DateTime.now();
    final sequencer =
        widget.sequencer ?? WatchBootSequencer(services: widget.services);
    final result = await sequencer.run(
      onStage: (stage, status, progress) {
        if (!mounted) return;
        setState(() {
          _status = status;
          _progress = progress.clamp(0.0, 1.0);
        });
      },
    );

    final elapsed = DateTime.now().difference(started);
    if (elapsed < widget.minDisplay) {
      await Future<void>.delayed(widget.minDisplay - elapsed);
    }

    if (!mounted) return;

    if (!result.success) {
      final debug = await widget.launcher.isDebugBuild();
      if (!mounted) return;
      setState(() {
        _busy = false;
        _isDebug = debug;
        _error = result.errorMessage ?? 'Startup failed';
        _status = 'Recovery';
      });
      return;
    }

    await _navigateSuccess(result);
  }

  Future<void> _navigateSuccess(WatchBootResult result) async {
    if (!WatchFlavor.isManagedLauncher) {
      final dismissed =
          await widget.services.preferences.isLauncherOnboardingDismissed();
      final isDefault = await widget.launcher.isDefaultHome();
      if (!dismissed && !isDefault) {
        if (!mounted) return;
        await _fadeAndReplace(WatchRoutes.defaultHomeOnboarding);
        return;
      }
    }

    if (!mounted) return;
    final destination = widget.services.pairing.state.isPaired
        ? WatchRoutes.locationOnboarding
        : WatchRoutes.pairing;
    await _fadeAndReplace(destination);
  }

  Future<void> _fadeAndReplace(String route) async {
    await _fadeOut.forward();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(route);
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0).animate(
        CurvedAnimation(parent: _fadeOut, curve: Curves.easeOut),
      ),
      child: WatchScaffold(
        showTopBar: false,
        enableBack: false,
        backgroundColor: EyeTokens.bootBlack,
        padding: const EdgeInsets.symmetric(horizontal: EyeTokens.spaceMd),
        child: _error != null ? _buildRecovery() : _buildBoot(),
      ),
    );
  }

  Widget _buildBoot() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final round = isRoundWatchLayout(context);
        final logoSize = round
            ? (constraints.maxWidth * 0.36).clamp(48.0, 72.0)
            : (constraints.maxWidth * 0.32).clamp(56.0, 88.0);
        final barWidth =
            round ? constraints.maxWidth * 0.55 : constraints.maxWidth * 0.62;

        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                WatchBrandAssets.bootLogo,
                width: logoSize,
                height: logoSize,
                fit: BoxFit.contain,
                filterQuality: FilterQuality.high,
                errorBuilder: (_, __, ___) => Icon(
                  Icons.visibility,
                  color: EyeTokens.green,
                  size: logoSize * 0.7,
                ),
              ),
              SizedBox(height: round ? 10 : 14),
              const Text(
                'THE EYE',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EyeTokens.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'SMART WATCH',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EyeTokens.logoGreen,
                  fontSize: round ? 9 : 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                ),
              ),
              SizedBox(height: round ? 14 : 18),
              Text(
                _status,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: EyeTokens.white.withValues(alpha: 0.92),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: barWidth,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: _busy ? _progress : 1,
                    minHeight: 3,
                    backgroundColor: const Color(0xFF1A1A1A),
                    color: EyeTokens.green,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRecovery() {
    return SingleChildScrollView(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: MediaQuery.sizeOf(context).height * 0.7,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              WatchBrandAssets.bootLogo,
              width: 48,
              height: 48,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 8),
            const Text(
              'THE EYE',
              style: TextStyle(
                color: EyeTokens.white,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _error ?? 'Startup failed',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EyeTokens.muted,
                fontSize: 10,
              ),
            ),
            const SizedBox(height: 12),
            _RecoveryButton(
              label: 'Retry',
              onTap: _busy ? null : _boot,
            ),
            const SizedBox(height: 6),
            _RecoveryButton(
              label: 'Open Settings',
              onTap: () => widget.launcher.openSystemSettings(),
            ),
            if (_isDebug) ...[
              const SizedBox(height: 6),
              _RecoveryButton(
                label: 'Change Default Launcher',
                onTap: () => widget.launcher.openHomeSettings(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RecoveryButton extends StatelessWidget {
  const _RecoveryButton({required this.label, this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: EyeTokens.white,
          side: const BorderSide(color: EyeTokens.green),
          minimumSize: const Size.fromHeight(36),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          textStyle: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
        child: Text(label, textAlign: TextAlign.center),
      ),
    );
  }
}
