#!/usr/bin/env bash
# Safe .env reader — never source the full file (values like SMTP_FROM_NAME=THE EYE break bash).

read_env_var() {
  local key="$1"
  local default="${2:-}"
  if [[ ! -f .env ]]; then
    printf '%s' "$default"
    return 0
  fi
  local line
  line="$(grep -E "^${key}=" .env 2>/dev/null | tail -n1 || true)"
  if [[ -z "$line" ]]; then
    printf '%s' "$default"
    return 0
  fi
  local value="${line#*=}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}
