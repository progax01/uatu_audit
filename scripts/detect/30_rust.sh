#!/bin/bash
# Detect Rust environment

if [ -f "Cargo.toml" ]; then
  echo "--- RUST DETECTION ---"
  echo "has_rust=true"
  
  if grep -q "anchor-lang" Cargo.toml; then
    echo "rust_framework=anchor"
  elif grep -q "soroban-sdk" Cargo.toml; then
    echo "rust_framework=soroban"
  else
    echo "rust_framework=standard"
  fi
fi

