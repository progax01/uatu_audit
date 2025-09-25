import { TestStyle } from "../types.js";

export const STYLES: Record<TestStyle, { id: TestStyle; label: string; description: string }> = {
  behavioral: { 
    id: "behavioral", 
    label: "Behavioral (Happy/Negative/Sad/Neutral)",
    description: "Tests covering success paths, malicious inputs, unfavorable conditions, and no-op scenarios"
  },
  stride: { 
    id: "stride", 
    label: "STRIDE Threat Modeling",
    description: "Security tests covering Spoofing, Tampering, Repudiation, Info Disclosure, DoS, and Elevation of Privilege"
  }
};

export const DEFAULT_TEST_STYLES: TestStyle[] = ["behavioral", "stride"];

export function validateTestStyles(styles: string[]): TestStyle[] {
  return styles.filter((style): style is TestStyle => 
    style in STYLES
  );
}

// Behavioral test case definitions
export const BEHAVIORAL_CASES = {
  happy: {
    id: "happy",
    label: "Happy Path",
    description: "Valid preconditions & authorization; success path; state transitions correct"
  },
  negative: {
    id: "negative", 
    label: "Negative",
    description: "Malicious/invalid inputs; unauthorized actors; underflow/overflow; revert assertions"
  },
  sad: {
    id: "sad",
    label: "Sad Path", 
    description: "Legit inputs but unfavorable environment: paused, max caps, insufficient balances; graceful failure"
  },
  neutral: {
    id: "neutral",
    label: "Neutral",
    description: "No-op / idempotency / invariants; inputs that must not change state; double-spend prevention"
  }
} as const;

// STRIDE threat categories
export const STRIDE_CATEGORIES = {
  spoofing: {
    id: "spoofing",
    label: "Spoofing", 
    description: "Identity/auth misbinding, tx.origin, signature misuse, proxy msg.sender confusion"
  },
  tampering: {
    id: "tampering",
    label: "Tampering",
    description: "Unauthorized storage mutation, missing onlyOwner/roles, unsafe upgradeability"
  },
  repudiation: {
    id: "repudiation", 
    label: "Repudiation",
    description: "Missing events/logging on critical state changes; unverifiable admin actions"
  },
  info_disclosure: {
    id: "info_disclosure",
    label: "Information Disclosure",
    description: "Leaking secrets/salts/private keys in events/storage/logs"
  },
  dos: {
    id: "dos",
    label: "Denial of Service", 
    description: "Unbounded loops, gas griefing, reentrancy, external call lockups"
  },
  eop: {
    id: "eop",
    label: "Elevation of Privilege",
    description: "Delegatecall abuse, upgrade bypass, access control flaws"
  }
} as const;

export type StrideCategory = keyof typeof STRIDE_CATEGORIES;
export type BehavioralCase = keyof typeof BEHAVIORAL_CASES;
