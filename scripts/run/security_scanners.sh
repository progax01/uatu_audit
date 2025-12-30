#!/bin/bash
# Run security scanners and output evidence summary

echo "--- SECURITY SCANNERS ---"

# Mocking slither output if present
if command -v slither &> /dev/null; then
  echo "Running Slither..."
  slither . --json - 2>/dev/null | jq '.results.detectors' || echo "Slither failed"
else
  echo "Slither not found, skipping."
fi

# Mocking semgrep output if present
if command -v semgrep &> /dev/null; then
  echo "Running Semgrep..."
  semgrep --config=auto --json . || echo "Semgrep failed"
else
  echo "Semgrep not found, skipping."
fi

