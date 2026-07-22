import 'package:flutter/material.dart';

import '../models/sos_event.dart';
import '../models/emergency_mode.dart';
import '../design_system/design_system.dart';
import '../services/watch_app_services.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class SosConfirmScreen extends StatefulWidget {
  const SosConfirmScreen({
    super.key,
    required this.services,
    this.mode = WatchEmergencyMode.normalSos,
  });

  final WatchAppServices services;
  final WatchEmergencyMode mode;

  @override
  State<SosConfirmScreen> createState() => _SosConfirmScreenState();
}

class _SosConfirmScreenState extends State<SosConfirmScreen> {
  late final Stream<SosEventState> _stream;
  late final WatchEmergencyMode _mode;

  @override
  void initState() {
    super.initState();
    _mode = widget.mode;
    _stream = widget.services.sos.states;
    if (widget.services.sos.state.lifecycle == SosLifecycle.idle) {
      widget.services.sos.beginHold(emergencyMode: _mode);
    }
  }

  void _cancel() {
    widget.services.sos.cancelHold();
    Navigator.pop(context);
  }

  static void _noop() {}

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SosEventState>(
      stream: _stream,
      initialData: widget.services.sos.state,
      builder: (context, snapshot) {
        final state = snapshot.data!;
        final progress =
            state.holdProgressMs / widget.services.sos.holdDurationMs;

        if (state.lifecycle == SosLifecycle.submitting ||
            state.lifecycle == SosLifecycle.active ||
            state.lifecycle == SosLifecycle.failed) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            Navigator.pushReplacementNamed(
              context,
              WatchRoutes.activeEmergency,
            );
          });
        }

        final showingCountdown = state.lifecycle == SosLifecycle.countdown;
        final discreet = _mode == WatchEmergencyMode.silentSos;

        return WatchScaffold(
          onBack: _cancel,
          child: Column(
            children: [
              const SizedBox(height: EyeTokens.spaceSm),
              Center(
                child: showingCountdown
                    ? const LargeSosButton(
                        progress: 1,
                        onHoldStart: _noop,
                        onHoldEnd: _noop,
                      )
                    : LargeSosButton(
                        progress: progress.clamp(0.0, 1.0),
                        onHoldStart: () => widget.services.sos
                            .beginHold(emergencyMode: _mode),
                        onHoldEnd: widget.services.sos.cancelHold,
                      ),
              ),
              const SizedBox(height: 12),
              if (showingCountdown)
                WatchCountdownDisplay(
                  seconds: state.countdownSeconds,
                  subtitle: discreet
                      ? 'Sending discreet update'
                      : 'Sending location + alert to your emergency contacts',
                )
              else
                WatchCountdownDisplay(
                  seconds: (3 - (progress * 3)).ceil().clamp(1, 3),
                  subtitle: state.lifecycle == SosLifecycle.holding
                      ? (discreet ? 'Keep holding' : 'Keep holding for SOS')
                      : (discreet ? 'Hold 3 seconds' : 'Hold 3 seconds to activate'),
                ),
              const Spacer(),
              WatchOutlineButton(label: 'Cancel', onPressed: _cancel),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
