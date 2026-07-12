#!/bin/sh
set -e

if [ -n "${FIREBASE_PLIST_PATH}" ]; then
  SOURCE="${PROJECT_DIR}/${FIREBASE_PLIST_PATH}"
else
  case "${PRODUCT_BUNDLE_IDENTIFIER}" in
    com.theeye.app.dev)
      SOURCE="${PROJECT_DIR}/Runner/Firebase/Development/GoogleService-Info.plist"
      ;;
    com.theeye.app.staging)
      SOURCE="${PROJECT_DIR}/Runner/Firebase/Staging/GoogleService-Info.plist"
      ;;
    com.theeye.app)
      SOURCE="${PROJECT_DIR}/Runner/Firebase/Production/GoogleService-Info.plist"
      ;;
    *)
      echo "warning: No Firebase plist mapping for bundle id ${PRODUCT_BUNDLE_IDENTIFIER}"
      exit 0
      ;;
  esac
fi

DEST="${PROJECT_DIR}/Runner/GoogleService-Info.plist"

if [ ! -f "${SOURCE}" ]; then
  echo "error: Firebase plist missing at ${SOURCE}. Download via: firebase apps:sdkconfig IOS <appId> --project <projectId> -o \"${SOURCE}\""
  exit 1
fi

cp "${SOURCE}" "${DEST}"
echo "Copied ${SOURCE} -> ${DEST}"
