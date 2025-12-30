#!/bin/bash
# Emit final fingerprint JSON

SHAPE=$(./scripts/detect/00_repo_shape.sh | grep "shape=" | cut -d= -f2)
HAS_NODE=$(./scripts/detect/10_node.sh | grep "has_node=" | cut -d= -f2)
PKG_MANAGER=$(./scripts/detect/10_node.sh | grep "pkg_manager=" | cut -d= -f2)
HAS_SOLIDITY=$(./scripts/detect/20_solidity.sh | grep "has_solidity=" | cut -d= -f2)
SOL_FRAMEWORK=$(./scripts/detect/20_solidity.sh | grep "solidity_framework=" | cut -d= -f2)
HAS_RUST=$(./scripts/detect/30_rust.sh | grep "has_rust=" | cut -d= -f2)
RUST_FRAMEWORK=$(./scripts/detect/30_rust.sh | grep "rust_framework=" | cut -d= -f2)

cat <<EOF
{
  "shape": "${SHAPE:-unknown}",
  "has_node": ${HAS_NODE:-false},
  "pkg_manager": "${PKG_MANAGER:-none}",
  "has_solidity": ${HAS_SOLIDITY:-false},
  "solidity_framework": "${SOL_FRAMEWORK:-none}",
  "has_rust": ${HAS_RUST:-false},
  "rust_framework": "${RUST_FRAMEWORK:-none}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

