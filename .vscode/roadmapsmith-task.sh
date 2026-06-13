#!/bin/sh
set -eu
SCRIPT_PATH="$0"
case "${SCRIPT_PATH}" in
  */*) ;;
  *) SCRIPT_PATH="./${SCRIPT_PATH}" ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "${SCRIPT_PATH%/*}" && pwd)
ACTION="${1:-explain}"
ROADMAPSMITH_NODE_RESOLVED=""
if [ -n "${ROADMAPSMITH_NODE:-}" ]; then
  if [ -x "${ROADMAPSMITH_NODE}" ]; then
    ROADMAPSMITH_NODE_RESOLVED="${ROADMAPSMITH_NODE}"
  elif command -v -- "${ROADMAPSMITH_NODE}" >/dev/null 2>&1; then
    ROADMAPSMITH_NODE_RESOLVED=$(command -v -- "${ROADMAPSMITH_NODE}")
  fi
fi
if [ -z "${ROADMAPSMITH_NODE_RESOLVED}" ] && command -v node >/dev/null 2>&1; then
  ROADMAPSMITH_NODE_RESOLVED=$(command -v node)
fi
if [ -z "${ROADMAPSMITH_NODE_RESOLVED}" ]; then
  echo "RoadmapSmith VS Code task runtime error"
  echo
  echo "VS Code tasks are installed, but the Node runtime needed to start RoadmapSmith could not be resolved."
  echo "RoadmapSmith itself may still be installed and the CLI may still be available."
  echo "Missing piece: the Node runtime used to start .vscode/roadmapsmith-launcher.js"
  echo "Recovery: install Node.js or set ROADMAPSMITH_NODE to a working node executable path, then rerun RoadmapSmith: Status."
  case "${ACTION}" in
    status|explain) exit 0 ;;
    *) exit 1 ;;
  esac
fi
exec "${ROADMAPSMITH_NODE_RESOLVED}" "${SCRIPT_DIR}/roadmapsmith-launcher.js" "$@"
