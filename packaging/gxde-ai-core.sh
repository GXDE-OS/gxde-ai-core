#!/bin/sh
# Keep the packaged application's configuration separate from Gemini CLI and
# Hachimi CLI installations that use ~/.gemini.
set -eu

: "${HOME:?HOME is not set}"
GXDE_AI_CORE_HOME="${GXDE_AI_CORE_HOME:-$HOME}"
export GXDE_AI_CORE_HOME

exec /usr/lib/gxde-ai-core/gxde-ai-core "$@"
