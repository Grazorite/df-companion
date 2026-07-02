#!/bin/bash
# Setup Python virtual environment for scraper scripts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv"

echo "🐍 Setting up Python virtual environment..."

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
  echo "✅ Virtual environment created at $VENV_DIR"
else
  echo "✅ Virtual environment already exists"
fi

# Activate venv
echo "🔌 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Install dependencies
echo "📥 Installing Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install requests > /dev/null 2>&1

echo "✅ Python environment ready!"
echo ""
echo "To manually activate the virtual environment, run:"
echo "  source .venv/bin/activate"
