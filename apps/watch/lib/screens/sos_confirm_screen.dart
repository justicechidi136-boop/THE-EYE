import 'package:flutter/material.dart';

import '../models/sos_event.dart';
import '../services/watch_app_services.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class SosConfirmScreen extends StatefulWidget {
  const SosConfirmScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  State<SosConfirmScreen> createState() => _SosConfirmScreenState();
}

class _SosConfirmScreenState extends State<SosConfirmScreen> {
  late final Stream<SosEventState> _stream;

  @override
  void initState() {
    super.initState();
    _stream = widget.services.sos.states;
    if (widget.services.sos.state.lifecycle == SosLifecycle.idle) {
      widget.services.sos.beginHold();
    }
  }

  void _cancel() {
    widget.services.sos.cancelHold();
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SosEventState>(
      stream: _stream,
      initialData: widget.services.sos.state,
      builder: (context, snapshot) {
        final state = snapshot.data!;
        final progress =
            state.holdProgressMs / widget.services.sos.holdDurationMs;

        if (state.lifecycle == SosLifecycle.countdown) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              Navigator.pushReplacementNamed(
                  context, WatchRoutes.emergencyType);
            }
          });
        }

        final showingCountdown = state.lifecycle == SosLifecycle.countdown;

        return WatchScreenShell(
          onBack: _cancel,
          child: Column(
            children: [
              const SizedBox(height: 8),
              Center(
                child: showingCountdown
                    ? WatchSosHoldButton(
                        progress: 1,
                        onHoldStart: () {},
                        onHoldEnd: () {},
                        label: 'SOS',
                      )
                    : WatchSosHoldButton(
                        progress: progress.clamp(0.0, 1.0),
                        onHoldStart: widget.services.sos.beginHold,
                        onHoldEnd: widget.services.sos.cancelHold,
                      ),
              ),
              const SizedBox(height: 12),
              if (showingCountdown)
                WatchCountdownDisplay(seconds: state.countdownSeconds)
              else
                WatchCountdownDisplay(
                  seconds: (3 - (progress * 3)).ceil().clamp(1, 3),
                  subtitle: state.lifecycle == SosLifecycle.holding
                      ? 'Keep holding for SOS'
                      : 'Hold 3 seconds to activate',
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
