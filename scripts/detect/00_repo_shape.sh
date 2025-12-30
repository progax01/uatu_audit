#!/bin/bash
# Detect monorepo patterns

echo "--- REPO SHAPE DETECTION ---"
if [ -f "pnpm-workspace.yaml" ]; then
  echo "shape=pnpm-workspace"
elif [ -f "nx.json" ]; then
  echo "shape=nx"
elif [ -f "turbo.json" ]; then
  echo "shape=turbo"
elif [ -d "packages" ]; then
  echo "shape=multisrc"
else
  echo "shape=standard"
fi

