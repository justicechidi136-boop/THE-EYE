import 'dart:async';

import 'package:flutter/material.dart';

import '../models/pairing_state.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  bool _loading = false;
  String? _error;
  Timer? _statusTimer;

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }

  Future<void> _startPairing() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.services.pairing.beginPairing();
      _watchPairingCompletion();
    } catch (error) {
      _error = error.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _watchPairingCompletion() {
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      final state = widget.services.pairing.state;
      if (!mounted) return;
      if (state.phase == PairingPhase.paired) {
        _statusTimer?.cancel();
        Navigator.pushReplacementNamed(context, WatchRoutes.home);
      } else if (state.phase == PairingPhase.failed) {
        _statusTimer?.cancel();
        setState(() => _error = state.errorMessage);
      } else {
        setState(() {});
      }
    });
  }

  Future<void> _simulatePaired() async {
    setState(() => _loading = true);
    await widget.services.pairing.completePairing(
      deviceSecret: 'dev-secret-${DateTime.now().millisecondsSinceEpoch}',
    );
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, WatchRoutes.home);
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.services.pairing.state;
    return WatchScreenShell(
      enableBack: false,
      leadingLabel: 'THE EYE',
      child: Column(
        children: [
          const Spacer(),
          const WatchLogomark(size: 70),
          const SizedBox(height: 12),
          const Text(
            'THE EYE',
            style: TextStyle(
              color: EyeColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Pair with mobile app',
            textAlign: TextAlign.center,
            style: TextStyle(color: EyeColors.muted, fontSize: 11),
          ),
          if (state.pairingCode != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: EyeColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: EyeColors.orange),
              ),
              child: Text(
                state.pairingCode!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 24,
                  letterSpacing: 6,
                  fontWeight: FontWeight.bold,
                  color: EyeColors.orange,
                ),
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: const TextStyle(color: EyeColors.danger, fontSize: 10)),
          ],
          const Spacer(),
          WatchPrimaryButton(
            label: _loading ? 'Pairing…' : 'Generate Code',
            onPressed: _loading ? null : _startPairing,
          ),
          const SizedBox(height: 6),
          WatchPrimaryButton(
            label: 'Standalone Login',
            color: EyeColors.orange,
            onPressed: () => _showStandaloneDialog(context),
          ),
          if (state.phase == PairingPhase.awaitingPhoneConfirmation) ...[
            const SizedBox(height: 6),
            WatchOutlineButton(
              label: 'Simulate Paired (Dev)',
              onPressed: _loading ? null : _simulatePaired,
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Future<void> _showStandaloneDialog(BuildContext context) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EyeColors.surface,
        title: const Text('Activation Code', style: TextStyle(fontSize: 14)),
        content: TextField(
          controller: controller,
          style: const TextStyle(fontSize: 12),
          decoration: const InputDecoration(hintText: 'Device secret'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Login'),
          ),
        ],
      ),
    );
    if (ok == true) {
      final success =
          await widget.services.standaloneAuth.loginWithActivationCode(
        activationCode: controller.text.trim(),
      );
      if (!context.mounted) return;
      if (success) {
        await widget.services.pairing.completePairing(
          deviceSecret: controller.text.trim(),
        );
        if (!context.mounted) return;
        Navigator.pushReplacementNamed(context, WatchRoutes.home);
      } else {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Standalone login failed')),
        );
      }
    }
  }
}
