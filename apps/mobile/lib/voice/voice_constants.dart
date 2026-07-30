enum VoiceRecorderState {
  idle,
  recording,
  paused,
  recorded,
  playing,
  uploading,
  uploaded,
  failed,
  offlinePending,
}

const voiceMaxDurationSeconds = 300;
const voiceMaxFileBytes = 25 * 1024 * 1024;

const supportedVoiceLanguages = <String, String>{
  "auto": "Automatic detection",
  "en": "English",
  "pcm": "Nigerian Pidgin",
  "ha": "Hausa",
  "yo": "Yoruba",
  "ig": "Igbo",
  "fr": "French",
  "sw": "Swahili",
};
