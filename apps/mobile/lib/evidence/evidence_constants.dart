abstract final class EvidenceLimits {
  static const maxAttachments = 10;
  static const maxFileBytes = 100 * 1024 * 1024;
  static const maxVideoDurationSeconds = 120;
  static const imageQualityNormal = 85;
  static const imageQualityLowData = 60;
  static const maxImageEdgePx = 4096;
}

abstract final class EvidenceMimeTypes {
  static const allowed = <String>{
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/mp4",
    "audio/webm",
  };

  static const image = <String>{"image/jpeg", "image/png", "image/webp"};
  static const video = <String>{"video/mp4", "video/webm"};
  static const audio = <String>{"audio/mpeg", "audio/mp4", "audio/webm"};
}

abstract final class EvidenceExtensions {
  static const allowed = <String>{
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".mp4",
    ".webm",
    ".mpeg",
    ".mp3",
    ".m4a"
  };
}
