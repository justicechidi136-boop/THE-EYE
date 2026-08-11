import "dart:async";

import "package:flutter/material.dart";

import "../incidents/incident_submission_result.dart";
import "active_emergency_contract.dart";
import "active_emergency_service.dart";

void _showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

abstract class ActiveEmergencyNavigationController {
  String? get accessToken;
  ActiveEmergencyService get activeEmergencyService;
  Future<void> activateActiveEmergency(String incidentId,
      {bool silent = false});
  Future<void> startIncidentLocationTracking(String incidentId);
}

class ActiveEmergencyNavigation {
  static const receivedCopy = "Your emergency report has been received.";

  static Future<void> openAfterSubmission(
    BuildContext context,
    ActiveEmergencyNavigationController controller,
    IncidentSubmissionResult result, {
    bool silent = false,
  }) async {
    if (!result.isSuccess && !result.isQueued && !result.canRetry) return;
    final incidentId = result.incidentId;
    if (incidentId == null || incidentId.isEmpty) {
      if (context.mounted) {
        _showMessage(
          context,
          result.userMessage ??
              "Report saved. Open Active Emergency when an ID is available.",
        );
      }
      return;
    }

    await controller.activateActiveEmergency(
      incidentId,
      silent: silent || result.silent,
    );
    if (result.isSuccess) {
      unawaited(controller.startIncidentLocationTracking(incidentId));
    }

    final token = controller.accessToken;
    if (token != null && token.isNotEmpty) {
      try {
        await controller.activeEmergencyService.fetchActiveEmergencyContract(
          incidentId,
          token,
          silent: silent || result.silent,
        );
      } catch (_) {
        // Navigation still proceeds with stored reference.
      }
    }

    if (!context.mounted) return;
    _showMessage(context, receivedCopy);
    await open(
      context,
      controller,
      incidentId: incidentId,
      silent: silent || result.silent,
      replace: true,
    );
  }

  static Future<void> open(
    BuildContext context,
    ActiveEmergencyNavigationController controller, {
    String? incidentId,
    bool silent = false,
    bool replace = false,
  }) async {
    final service = controller.activeEmergencyService;
    final refs = await service.listActiveReferences();
    final resolvedId = incidentId?.trim().isNotEmpty == true
        ? incidentId!.trim()
        : refs.length == 1
            ? refs.first.incidentId
            : null;

    if (resolvedId == null || resolvedId.isEmpty) {
      if (refs.isEmpty) {
        if (!context.mounted) return;
        Navigator.of(context).pushNamed("/active-emergency/none");
        return;
      }
      if (!context.mounted) return;
      Navigator.of(context).pushNamed("/active-emergencies");
      return;
    }

    if (refs.length > 1 && incidentId == null) {
      if (!context.mounted) return;
      Navigator.of(context).pushNamed("/active-emergencies");
      return;
    }

    final route = "/active-emergency/$resolvedId";
    if (!context.mounted) return;
    final args = {"incidentId": resolvedId, "silent": silent};
    if (replace) {
      Navigator.of(context).pushReplacementNamed(route, arguments: args);
      return;
    }
    Navigator.of(context).pushNamed(route, arguments: args);
  }

  static Future<void> handleTerminalContract(
    BuildContext context,
    ActiveEmergencyTerminalContract contract, {
    Duration delay = const Duration(seconds: 2),
  }) async {
    if (!context.mounted) return;
    _showMessage(context, contract.displayLabel);
    await Future<void>.delayed(delay);
    if (!context.mounted) return;
    Navigator.of(context).pushReplacementNamed(
      "/incident-detail",
      arguments: contract.incidentId,
    );
  }
}
