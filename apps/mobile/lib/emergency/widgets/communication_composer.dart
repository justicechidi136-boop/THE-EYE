import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "active_emergency_tokens.dart";

class CommunicationComposer extends StatelessWidget {
  const CommunicationComposer({
    super.key,
    required this.controller,
    required this.enabled,
    required this.sending,
    required this.canSendText,
    required this.canSendPhoto,
    required this.canSendVoice,
    required this.onSend,
    this.onAttach,
    this.onPhoto,
    this.onVoice,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool sending;
  final bool canSendText;
  final bool canSendPhoto;
  final bool canSendVoice;
  final VoidCallback onSend;
  final VoidCallback? onAttach;
  final VoidCallback? onPhoto;
  final VoidCallback? onVoice;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Material(
      color: colors.background,
      child: SafeArea(
        top: false,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: colors.border)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Row(
              children: [
                ActiveEmergencyIconButton(
                  icon: Icons.add,
                  tooltip: "Add attachment",
                  onPressed: enabled && !sending ? onAttach : null,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: colors.elevatedSurface,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Semantics(
                            textField: true,
                            label: "Type a message",
                            child: TextField(
                              controller: controller,
                              enabled: enabled && canSendText && !sending,
                              minLines: 1,
                              maxLines: 4,
                              style: TextStyle(
                                color: colors.inputText,
                                fontSize: 13,
                              ),
                              decoration: InputDecoration(
                                hintText: "Type a message...",
                                hintStyle: TextStyle(
                                  color: colors.mutedText,
                                  fontSize: 13,
                                ),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding:
                                    const EdgeInsets.symmetric(vertical: 10),
                              ),
                              textInputAction: TextInputAction.send,
                              onSubmitted: (_) {
                                if (enabled && canSendText && !sending) {
                                  onSend();
                                }
                              },
                            ),
                          ),
                        ),
                        if (canSendPhoto)
                          IconButton(
                            tooltip: "Send photo",
                            onPressed: enabled && !sending ? onPhoto : null,
                            icon: Icon(
                              Icons.photo_camera_outlined,
                              size: 18,
                              color: colors.mutedText,
                            ),
                            visualDensity: VisualDensity.compact,
                            constraints: const BoxConstraints(
                              minWidth: 40,
                              minHeight: 40,
                            ),
                          ),
                        if (canSendVoice)
                          IconButton(
                            tooltip: "Send voice message",
                            onPressed: enabled && !sending ? onVoice : null,
                            icon: Icon(
                              Icons.mic_none,
                              size: 18,
                              color: colors.mutedText,
                            ),
                            visualDensity: VisualDensity.compact,
                            constraints: const BoxConstraints(
                              minWidth: 40,
                              minHeight: 40,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Semantics(
                  button: true,
                  label: "Send message",
                  enabled: enabled && canSendText && !sending,
                  child: Material(
                    color: colors.accentText,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: enabled && canSendText && !sending ? onSend : null,
                      child: SizedBox(
                        width: 44,
                        height: 44,
                        child: Center(
                          child: sending
                              ? SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: colors.textOnPrimary,
                                  ),
                                )
                              : Icon(
                                  Icons.send_rounded,
                                  size: 18,
                                  color: colors.textOnPrimary,
                                ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
