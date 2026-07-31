import 'dart:async';

import 'package:flutter/material.dart';

import '../models/pairing_state.dart';
import '../services/watch_activation_diagnostics.dart';
import '../services/watch_activation_exception.dart';
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
        _navigateAfterPairing();
      } else if (state.phase == PairingPhase.failed) {
        _statusTimer?.cancel();
        setState(() => _error = state.errorMessage);
      } else {
        setState(() {});
      }
    });
  }

  Future<void> _navigateAfterPairing() async {
    if (!mounted) return;
    widget.services.standaloneAuth.diagnostics.log(
      WatchActivationCheckpoint.homeNavigationBegin,
    );
    await Navigator.of(context).pushNamedAndRemoveUntil(
      WatchRoutes.home,
      (route) => false,
    );
    if (!mounted) return;
    widget.services.standaloneAuth.diagnostics.log(
      WatchActivationCheckpoint.homeNavigationSuccess,
    );
  }

  Future<void> _simulatePaired() async {
    setState(() => _loading = true);
    await widget.services.pairing.completePairing(
      deviceSecret: 'dev-secret-${DateTime.now().millisecondsSinceEpoch}',
    );
    if (!mounted) return;
    await _navigateAfterPairing();
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
            onPressed: _loading ? null : () => _showStandaloneActivation(context),
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

  Future<void> _showStandaloneActivation(BuildContext context) async {
    final deviceIdController = TextEditingController();
    final codeController = TextEditingController();
    String? dialogError;
    var submitting = false;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> submit() async {
              if (submitting) return;
              setDialogState(() {
                submitting = true;
                dialogError = null;
              });
              try {
                final result =
                    await widget.services.standaloneAuth.activateWithAdminCode(
                  deviceId: deviceIdController.text,
                  pairingCode: codeController.text,
                );
                await widget.services.pairing.completePairing(
                  deviceSecret: result.deviceSecret,
                  deviceId: result.deviceId,
                );
                if (!dialogContext.mounted) return;
                Navigator.of(dialogContext).pop();
                if (!this.context.mounted) return;
                await _navigateAfterPairing();
              } on WatchActivationException catch (error) {
                setDialogState(() {
                  dialogError = '${error.code}\n${error.userMessage}';
                  submitting = false;
                });
              } catch (error) {
                setDialogState(() {
                  dialogError =
                      'WATCH-ACTIVATION-003\nThe watch was activated, but setup could not be completed.';
                  submitting = false;
                });
              }
            }

            return AlertDialog(
              backgroundColor: EyeColors.surface,
              title: const Text(
                'Standalone Activation',
                style: TextStyle(fontSize: 14),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Enter the device ID and 6-digit code from the admin dashboard.',
                      style: TextStyle(color: EyeColors.muted, fontSize: 10),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: deviceIdController,
                      enabled: !submitting,
                      style: const TextStyle(fontSize: 12),
                      decoration: const InputDecoration(
                        hintText: 'Device ID (e.g. EYE-WATCH-001)',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: codeController,
                      enabled: !submitting,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(fontSize: 12),
                      decoration: const InputDecoration(
                        hintText: '6-digit activation code',
                      ),
                    ),
                    if (dialogError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        dialogError!,
                        style: const TextStyle(
                          color: EyeColors.danger,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: submitting
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: submitting ? null : submit,
                  child: Text(submitting ? 'Activating…' : 'Login'),
                ),
              ],
            );
          },
        );
      },
    );

    deviceIdController.dispose();
    codeController.dispose();
  }
}
