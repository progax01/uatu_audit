#!/bin/bash
# Detect Solidity environment

echo "--- SOLIDITY DETECTION ---"
if [ -f "foundry.toml" ]; then
  echo "solidity_framework=foundry"
elif [ -f "hardhat.config.js" ] || [ -f "hardhat.config.ts" ]; then
  echo "solidity_framework=hardhat"
elif [ -f "truffle-config.js" ]; then
  echo "solidity_framework=truffle"
fi

if ls *.sol >/dev/null 2>&1 || [ -d "contracts" ]; then
  echo "has_solidity=true"
fi

