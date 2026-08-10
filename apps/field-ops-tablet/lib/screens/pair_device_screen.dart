import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../api/field_api_client.dart';
import '../auth/field_auth_service.dart';
import '../config/app_flavor.dart';
import '../pairing/field_pairing_service.dart';
import '../pairing/pairing_qr_payload.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

/// Entry method the officer picked for supplying the pairing code.
enum _PairEntryMode { chooser, scanning, manualEntry }

/// Progress through the pairing handshake. Mirrors the server-side steps in
/// `FieldDevicePairingService` (claim → challenge → complete) plus UI-only
/// bookends (`idle`, `confirming`, `success`, `failed`).
enum PairingStage {
  idle,
  scanning,
  claiming,
  confirming,
  challenging,
  completing,
  success,
  failed,
}

/// Officer-facing screen for binding a **pre-provisioned** field tablet using
/// a supervisor-issued QR code or `EYE-XXXX-XXXX` short code.
///
/// This is additive to, and does not replace, [DeviceRegistrationScreen]'s
/// supervisor-token self-registration flow. Security invariants:
///
/// - The QR/short-code is a single-use, rate-limited, hashed-at-rest claim
///   ticket — never a bearer token and never a source of permissions.
/// - `operationalRole` / `deviceName` shown after `claim()` are a
///   confirmation hint only ("is this my tablet?"); they are **not** applied
///   to this device. Every permission, role, and activation decision is
///   resolved solely by the server's `complete()` response.
/// - The device's Ed25519 key pair is generated locally and only the public
///   key ever leaves the device; binding requires signing a fresh
///   server-issued challenge, so a captured QR code alone cannot be replayed
///   against a different physical device.
class PairDeviceScreen extends StatefulWidget {
  const PairDeviceScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<PairDeviceScreen> createState() => _PairDeviceScreenState();
}

class _PairDeviceScreenState extends State<PairDeviceScreen> {
  _PairEntryMode _mode = _PairEntryMode.chooser;
  PairingStage _stage = PairingStage.idle;

  final _manualCodeController = TextEditingController(text: 'EYE-');
  final _manualFormKey = GlobalKey<FormState>();
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  FieldPairingLookup? _lookup;
  FieldPairingClaim? _claim;
  String? _error;
  bool _scanLocked = false;

  @override
  void dispose() {
    _manualCodeController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------- Entry

  void _chooseScan() {
    setState(() {
      _mode = _PairEntryMode.scanning;
      _stage = PairingStage.scanning;
      _error = null;
      _scanLocked = false;
    });
  }

  void _chooseManualEntry() {
    setState(() {
      _mode = _PairEntryMode.manualEntry;
      _stage = PairingStage.idle;
      _error = null;
    });
  }

  void _resetToChooser() {
    setState(() {
      _mode = _PairEntryMode.chooser;
      _stage = PairingStage.idle;
      _error = null;
      _claim = null;
      _lookup = null;
      _scanLocked = false;
    });
  }

  void _onQrDetected(BarcodeCapture capture) {
    if (_scanLocked) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null || raw.isEmpty) continue;
      _scanLocked = true;
      unawaited(_scannerController.stop());
      _handleScannedValue(raw);
      return;
    }
  }

  void _handleScannedValue(String raw) {
    try {
      final payload = PairingQrPayload.parse(
        raw,
        currentEnvironment: AppFlavor.envName,
      );
      final lookup = FieldPairingLookup(
        pairingToken: payload.hasPairingToken ? payload.pairingToken : null,
        shortCode: payload.shortCode,
      );
      _beginClaim(lookup);
    } on PairingQrValidationException catch (error) {
      setState(() {
        _stage = PairingStage.failed;
        _error = error.message;
      });
    }
  }

  void _submitManualCode() {
    if (!(_manualFormKey.currentState?.validate() ?? false)) return;
    final code = PairingShortCode.normalize(_manualCodeController.text);
    _beginClaim(FieldPairingLookup(shortCode: code));
  }

  // -------------------------------------------------------------- Pairing

  Future<void> _beginClaim(FieldPairingLookup lookup) async {
    setState(() {
      _lookup = lookup;
      _stage = PairingStage.claiming;
      _error = null;
    });

    try {
      final claim = await widget.services.pairing.claim(lookup);
      if (!mounted) return;
      setState(() {
        _claim = claim;
        _stage = PairingStage.confirming;
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _stage = PairingStage.failed;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _stage = PairingStage.failed;
        _error = 'Could not read this pairing code. $error';
      });
    }
  }

  Future<void> _confirmAndComplete() async {
    final lookup = _lookup;
    if (lookup == null) return;

    setState(() {
      _stage = PairingStage.challenging;
      _error = null;
    });

    try {
      await widget.services.pairing.ensureKeyPair();
      final installationId =
          await FieldAuthService.ensureInstallationId(widget.services.session);
      final installationIdHash =
          await FieldAuthService.hashInstallationId(installationId);
      final publicKey = await widget.services.pairing.readPublicKeyBase64();
      if (publicKey == null || publicKey.isEmpty) {
        throw StateError('Device public key unavailable');
      }

      final signedChallenge =
          await widget.services.pairing.requestChallenge(lookup);

      if (!mounted) return;
      setState(() => _stage = PairingStage.completing);

      final completion = await widget.services.pairing.complete(
        lookup,
        signedChallenge: signedChallenge,
        publicKey: publicKey,
        installationIdHash: installationIdHash,
      );

      await widget.services.session.savePublicDeviceId(completion.publicDeviceId);

      if (!mounted) return;
      setState(() => _stage = PairingStage.success);

      Timer(const Duration(milliseconds: 1400), () {
        if (!mounted) return;
        if (completion.isActive) {
          Navigator.of(context).pushReplacementNamed(FieldRoutes.login);
        } else {
          Navigator.of(context).pushReplacementNamed(FieldRoutes.approvalPending);
        }
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _stage = PairingStage.failed;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _stage = PairingStage.failed;
        _error = error.toString();
      });
    }
  }

  // ----------------------------------------------------------------- UI

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pair this device'),
        backgroundColor: FieldColors.surface,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 900),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: SingleChildScrollView(child: _buildContent(context)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    switch (_stage) {
      case PairingStage.idle:
        return _mode == _PairEntryMode.manualEntry
            ? _buildManualEntry(context)
            : _buildChooser(context);
      case PairingStage.scanning:
        return _buildScanner(context);
      case PairingStage.claiming:
        return _buildProgress('Checking pairing code…');
      case PairingStage.confirming:
        return _buildConfirm(context);
      case PairingStage.challenging:
        return _buildProgress('Requesting a secure device challenge…');
      case PairingStage.completing:
        return _buildProgress('Completing secure pairing…');
      case PairingStage.success:
        return _buildSuccess(context);
      case PairingStage.failed:
        return _buildFailed(context);
    }
  }

  Widget _buildChooser(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Pair a pre-provisioned tablet',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        Text(
          'Ask your supervisor for this tablet\'s pairing QR code or '
          '${_shortCodeExampleLabel()} short code, issued from the admin '
          'console.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 32),
        Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Semantics(
                button: true,
                label: 'Scan QR code to pair this device',
                child: _PairOptionCard(
                  icon: Icons.qr_code_scanner,
                  title: 'Scan QR Code',
                  subtitle: 'Use the tablet camera',
                  onTap: _chooseScan,
                ),
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Semantics(
                button: true,
                label: 'Enter pairing code manually',
                child: _PairOptionCard(
                  icon: Icons.keyboard_alt_outlined,
                  title: 'Enter Pairing Code',
                  subtitle: _shortCodeExampleLabel(),
                  onTap: _chooseManualEntry,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text('Back to supervisor-token registration'),
          ),
        ),
      ],
    );
  }

  String _shortCodeExampleLabel() => 'EYE-XXXX-XXXX';

  Widget _buildManualEntry(BuildContext context) {
    return Form(
      key: _manualFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Enter pairing code',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Type the ${_shortCodeExampleLabel()} code shown by your '
            'supervisor.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _manualCodeController,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(
              fontSize: 28,
              letterSpacing: 4,
              fontWeight: FontWeight.w700,
              fontFamily: 'monospace',
            ),
            textAlign: TextAlign.center,
            inputFormatters: [_ShortCodeInputFormatter()],
            decoration: const InputDecoration(
              labelText: 'Pairing code',
              hintText: 'EYE-XXXX-XXXX',
            ),
            validator: (value) {
              final normalized = PairingShortCode.normalize(value ?? '');
              return PairingShortCode.isValid(normalized)
                  ? null
                  : 'Enter the full 8-character pairing code';
            },
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _submitManualCode,
            child: const Text('Continue'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _chooseScan,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan QR code instead'),
          ),
          const SizedBox(height: 12),
          TextButton(onPressed: _resetToChooser, child: const Text('Cancel')),
        ],
      ),
    );
  }

  Widget _buildScanner(BuildContext context) {
    final isWide = MediaQuery.of(context).size.width > 640;
    final preview = Semantics(
      label: 'Camera preview for scanning the pairing QR code',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: Stack(
            fit: StackFit.expand,
            children: [
              MobileScanner(
                controller: _scannerController,
                onDetect: _onQrDetected,
                errorBuilder: (context, error) => _buildScannerError(error),
              ),
              IgnorePointer(
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: FieldColors.orange, width: 3),
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    final instructions = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Scan the pairing QR code',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        Text(
          'Point the camera at the QR code shown on your supervisor\'s '
          'screen. This code is single-use and expires automatically.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: _chooseManualEntry,
          icon: const Icon(Icons.keyboard_alt_outlined),
          label: const Text('Enter code instead'),
        ),
        const SizedBox(height: 12),
        TextButton(onPressed: _resetToChooser, child: const Text('Cancel')),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: const TextStyle(color: FieldColors.danger)),
        ],
      ],
    );

    if (isWide) {
      return IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(flex: 5, child: preview),
            const SizedBox(width: 32),
            Expanded(flex: 4, child: instructions),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [preview, const SizedBox(height: 24), instructions],
    );
  }

  Widget _buildScannerError(MobileScannerException error) {
    return Container(
      color: FieldColors.surfaceElevated,
      padding: const EdgeInsets.all(16),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.videocam_off_outlined,
              color: FieldColors.danger,
              size: 40,
            ),
            const SizedBox(height: 12),
            Text(
              'Camera unavailable: ${error.errorDetails?.message ?? error.errorCode.name}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: FieldColors.white),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _chooseManualEntry,
              child: const Text('Enter code instead'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgress(String message) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: FieldColors.orange),
          const SizedBox(height: 24),
          Semantics(
            liveRegion: true,
            child: Text(message, textAlign: TextAlign.center),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirm(BuildContext context) {
    final claim = _claim;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.verified_outlined, size: 56, color: FieldColors.orange),
        const SizedBox(height: 16),
        Text(
          'Confirm this tablet',
          style: Theme.of(context).textTheme.headlineMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Make sure this matches the device your supervisor issued.',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ConfirmRow(label: 'Device name', value: claim?.deviceName ?? '—'),
                if (claim?.operationalRole != null) ...[
                  const SizedBox(height: 12),
                  _ConfirmRow(
                    label: 'Operational role',
                    value: claim!.operationalRole!,
                  ),
                ],
                const SizedBox(height: 12),
                _ConfirmRow(
                  label: 'Public device ID',
                  value: claim?.publicDeviceId ?? '—',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _confirmAndComplete,
          child: const Text('Confirm & Pair'),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: _resetToChooser,
          child: const Text('This isn\'t my tablet — use a different code'),
        ),
      ],
    );
  }

  Widget _buildSuccess(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.check_circle, size: 72, color: FieldColors.success),
          const SizedBox(height: 20),
          Text(
            'Pairing complete',
            style: Theme.of(context).textTheme.headlineMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Continuing…',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildFailed(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.error_outline, size: 56, color: FieldColors.danger),
        const SizedBox(height: 16),
        Text(
          'Pairing failed',
          style: Theme.of(context).textTheme.headlineMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Semantics(
          liveRegion: true,
          child: Text(
            _error ?? 'Something went wrong. Please try again.',
            style: const TextStyle(color: FieldColors.danger),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 24),
        ElevatedButton(onPressed: _resetToChooser, child: const Text('Try again')),
      ],
    );
  }
}

class _PairOptionCard extends StatelessWidget {
  const _PairOptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48, color: FieldColors.orange),
              const SizedBox(height: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.labelLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConfirmRow extends StatelessWidget {
  const _ConfirmRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 160,
          child: Text(label, style: Theme.of(context).textTheme.bodySmall),
        ),
        Expanded(
          child: SelectableText(
            value,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}

class _ShortCodeInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final formatted = PairingShortCode.format(newValue.text);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
