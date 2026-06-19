#!/usr/bin/env bash
# Re-create the ~/.claude -> Developer-repo symlinks (run after cloning on a new machine).
set -euo pipefail
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE="$HOME/.claude"
ln -sfn "$DEST/CLAUDE.md"     "$CLAUDE/CLAUDE.md"
ln -sfn "$DEST/settings.json" "$CLAUDE/settings.json"
ln -sfn "$DEST/statusline-command.sh" "$CLAUDE/statusline-command.sh"
ln -sfn "$DEST/rules"         "$CLAUDE/rules"
ln -sfn "$DEST/skills"        "$CLAUDE/skills"
ln -sfn "$DEST/output-styles" "$CLAUDE/output-styles"
ln -sfn "$DEST/memory"        "$CLAUDE/projects/-Users-willschaefer-Developer/memory"
echo "Linked ~/.claude -> $DEST"
