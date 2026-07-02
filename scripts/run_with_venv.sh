#!/bin/bash
# Wrapper to run Python scripts with virtual environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv"

# Setup venv if needed
if [ ! -d "$VENV_DIR" ]; then
  echo "⚙️  Virtual environment not found. Setting up..."
  "$SCRIPT_DIR/setup_venv.sh"
fi

# Activate venv and run the Python script
source "$VENV_DIR/bin/activate"
python3 "$@"
