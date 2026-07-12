import "package:flutter/material.dart";
import "package:livekit_client/livekit_client.dart";

import "live_video_connection_state.dart";
import "live_video_evidence_overlay.dart";
import "live_video_session_controller.dart";

class LiveVideoPreviewPane extends StatelessWidget {
  const LiveVideoPreviewPane({
    required this.controller,
    required this.overlay,
    required this.onOpenMaps,
    super.key,
  });

  final LiveVideoSessionController controller;
  final LiveVideoEvidenceOverlay overlay;
  final void Function(double latitude, double longitude) onOpenMaps;

  @override
  Widget build(BuildContext context) {
    final track = controller.localVideoTrack;
    final streaming = controller.isStreaming ||
        controller.connectionState == LiveVideoConnectionState.previewing;
    final failed =
        controller.connectionState == LiveVideoConnectionState.failed;
    final dark = streaming || failed;

    return Stack(
      children: [
        Container(
          height: 360,
          decoration: BoxDecoration(
            color: dark ? const Color(0xFF111820) : const Color(0xFFE7EDF0),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFD8DEE4)),
          ),
          clipBehavior: Clip.antiAlias,
          child: track != null && controller.isCameraEnabled
              ? VideoTrackRenderer(
                  track,
                  fit: VideoViewFit.cover,
                )
              : Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        controller.isStreaming
                            ? Icons.videocam
                            : Icons.videocam_off,
                        size: 72,
                        color: dark ? Colors.white : const Color(0xFF009933),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        liveVideoConnectionLabel(controller.connectionState),
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: dark ? Colors.white : Colors.black,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        controller.roomName.isEmpty
                            ? "Camera preview"
                            : controller.roomName,
                        style: TextStyle(
                            color: dark
                                ? Colors.white70
                                : const Color(0xFF5C6670)),
                      ),
                    ],
                  ),
                ),
        ),
        Positioned(
          left: 12,
          top: 12,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.78),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(overlay.title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 12)),
                const SizedBox(height: 4),
                Text("Incident: ${overlay.incidentId}",
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
                Text("Date: ${overlay.date}",
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
                Text("Time: ${overlay.time}",
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
                _gpsLink(overlay.gps, onOpenMaps),
                Text("Accuracy: ${overlay.accuracy}",
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
                Text("Status: ${overlay.connectionStatus}",
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _gpsLink(String gps, void Function(double, double) onOpenMaps) {
    final parts = gps.split(",");
    if (parts.length != 2) {
      return Text("GPS: $gps",
          style: const TextStyle(color: Colors.white, fontSize: 12));
    }
    final lat = double.tryParse(parts[0].trim());
    final lng = double.tryParse(parts[1].trim());
    if (lat == null || lng == null) {
      return Text("GPS: $gps",
          style: const TextStyle(color: Colors.white, fontSize: 12));
    }
    return InkWell(
      onTap: () => onOpenMaps(lat, lng),
      child: Text(
        "GPS: $gps",
        style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            decoration: TextDecoration.underline),
      ),
    );
  }
}
