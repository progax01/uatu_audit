#!/bin/bash
# Detect Node.js environment

if [ -f "package.json" ]; then
  echo "--- NODE DETECTION ---"
  echo "has_node=true"
  
  if [ -f "pnpm-lock.yaml" ]; then
    echo "pkg_manager=pnpm"
  elif [ -f "yarn.lock" ]; then
    echo "pkg_manager=yarn"
  else
    echo "pkg_manager=npm"
  fi
  
  # Check for test frameworks
  if grep -q "jest" package.json; then
    echo "test_framework=jest"
  elif grep -q "vitest" package.json; then
    echo "test_framework=vitest"
  elif grep -q "mocha" package.json; then
    echo "test_framework=mocha"
  fi
fi

