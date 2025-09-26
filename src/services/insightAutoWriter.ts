/**
 * Insight Auto-Writer
 * Turns stderr/stdout + exit codes into structured insights.md entries.
 * Non-destructive: never edits source, only writes suggestions.
 */
import fs from "fs-extra";
import path from "node:path";

export type Severity = "critical" | "high" | "medium" | "low";
export type Area = "Build" | "Tests" | "Security" | "Coverage" | "Toolchain" | "Shell" | "Git" | "Config";

export interface Insight {
  area: Area;
  severity: Severity;
  summary: string;         // one-liner
  command?: string;
  exitCode?: number;
  evidence?: string;       // a short excerpt (<= 50 lines)
  hypothesis?: string;     // root-cause hypothesis
  remediation?: string[];  // suggested fixes (text diffs / steps)
  impact?: "Critical" | "High" | "Medium" | "Low";
}

export interface AnalysisInput {
  cmd: string;
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
  toolchain?: {
    hasHardhat?: boolean;
    hasFoundry?: boolean;
    hasAnchor?: boolean;
    hasSoroban?: boolean;
    hasNode?: boolean;
  };
  repo?: { projectPath: string; sandboxPath: string };
}

// ---- helpers
function tail(text = "", maxLines = 50): string {
  const lines = text.split(/\r?\n/);
  const sliced = lines.slice(Math.max(0, lines.length - maxLines));
  return sliced.join("\n");
}
function fence(s: string) { return s ? "```\n" + s + "\n```" : ""; }

// ---- pattern registry (ordered)
type Detector = (i: AnalysisInput) => Insight | null;

const detectors: Detector[] = [

  // -------- Hardhat compile / plugin missing
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (i.toolchain?.hasHardhat && /hardhat.*(not found|command not found)/i.test(s)) {
      return {
        area: "Toolchain",
        severity: "high",
        summary: "Hardhat not available in sandbox",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Hardhat CLI or dev dependencies not installed in sandbox.",
        remediation: [
          "Ensure dev deps installed: `npm ci` (preferred) or `npm i` before running tests.",
          "Pin hardhat in devDependencies and re-run.",
        ],
        impact: "High",
      };
    }
    if (i.toolchain?.hasHardhat && /(Error: hardhat-(coverage|toolbox|deploy).*not found|require.+failed|Cannot find module 'hardhat-.+')/i.test(s)) {
      return {
        area: "Config",
        severity: "medium",
        summary: "Hardhat plugin missing or not installed",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Hardhat config references a plugin that isn't installed.",
        remediation: [
          "Add the missing plugin to devDependencies, e.g. `npm i -D hardhat-coverage`.",
          "Verify `hardhat.config.(ts|js)` plugin imports and spelling.",
        ],
        impact: "Medium",
      };
    }
    return null;
  },

  // -------- Hardhat coverage extglob / shell
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/syntax error near unexpected token `\('|extglob/i.test(s) && /hardhat.*coverage/i.test(i.cmd)) {
      return {
        area: "Coverage",
        severity: "low",
        summary: "Shell extglob not supported under /bin/sh",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Command used bash extglob but ran under /bin/sh.",
        remediation: [
          "Run under bash: `bash -lc 'shopt -s extglob; npx hardhat coverage --testfiles \"test/!(exclude)/**/*.ts\"'`.",
          "Alternatively, pre-compute a test list and avoid extglob.",
        ],
        impact: "Low",
      };
    }
    return null;
  },

  // -------- Foundry compile/test
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (i.toolchain?.hasFoundry && /No such file or directory.*forge|forge: command not found/i.test(s)) {
      return {
        area: "Toolchain",
        severity: "high",
        summary: "Foundry (forge) not available",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Foundry not installed on host/runner.",
        remediation: [
          "Install Foundry before execution: https://book.getfoundry.sh/getting-started/installation",
          "Ensure `forge --version` passes in the daemon environment.",
        ],
        impact: "High",
      };
    }
    if (i.toolchain?.hasFoundry && /Error: (Compiler run failed|solc)/i.test(s)) {
      return {
        area: "Build",
        severity: "medium",
        summary: "Solidity compiler run failed in Foundry",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Solidity version or optimizer settings mismatch.",
        remediation: [
          "Align `pragma solidity` with `foundry.toml` `solc_version`.",
          "If using multiple contracts, pin a compatible solc and re-run.",
        ],
        impact: "Medium",
      };
    }
    return null;
  },

  // -------- Solidity common: tx.origin, delegatecall, low-level calls
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/tx\.origin/i.test(s) || /delegatecall/i.test(s) || /\.call\s*\(/i.test(s)) {
      return {
        area: "Security",
        severity: "high",
        summary: "Dangerous Solidity pattern detected (tx.origin / delegatecall / low-level call)",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Code uses patterns frequently associated with auth bypass or reentrancy.",
        remediation: [
          "Avoid `tx.origin` for auth; use roles or `msg.sender`.",
          "Wrap external calls with interfaces and verify return values.",
          "Protect state-changing external calls with reentrancy guards.",
        ],
        impact: "High",
      };
    }
    return null;
  },

  // -------- NPM install failures
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/ERR! code (EAI_AGAIN|ETIMEDOUT|ENOTFOUND)|network timeout/i.test(s)) {
      return {
        area: "Toolchain",
        severity: "low",
        summary: "Network error during npm install",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Transient network/DNS issue.",
        remediation: [
          "Retry once with backoff (already handled by SOP).",
          "Use `npm ci` and lockfiles for reproducibility.",
        ],
        impact: "Low",
      };
    }
    if (/npm ERR! ERESOLVE|peer dep|dependency conflict/i.test(s)) {
      return {
        area: "Config",
        severity: "medium",
        summary: "NPM dependency resolution conflict",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Version constraints or peer dependencies conflict.",
        remediation: [
          "Pin conflicting deps; prefer `npm ci` with a locked tree.",
          "Review `overrides` to resolve peer dep conflicts.",
        ],
        impact: "Medium",
      };
    }
    return null;
  },

  // -------- TypeScript compilation
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/TS\d{3,5}:/i.test(s) && /hardhat|jest|ts-node|tsc/.test(i.cmd)) {
      return {
        area: "Build",
        severity: "medium",
        summary: "TypeScript compilation errors",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "TS config or type declarations missing for test framework or plugins.",
        remediation: [
          "Add `types` to `tsconfig.json` (e.g., `hardhat`, `chai`, `node`).",
          "Install missing @types/* packages.",
          "Ensure `esModuleInterop` and module settings align with imports.",
        ],
        impact: "Medium",
      };
    }
    return null;
  },

  // -------- Anchor
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (i.toolchain?.hasAnchor && /(anchor: command not found|program not found|idl)/i.test(s)) {
      return {
        area: "Toolchain",
        severity: "high",
        summary: "Anchor toolchain not available or misconfigured",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Anchor not installed or Solana toolchain missing.",
        remediation: [
          "Install Anchor + Solana; verify `anchor --version`.",
          "Ensure local validator or test config is present for `anchor test`.",
        ],
        impact: "High",
      };
    }
    return null;
  },

  // -------- Git / clone / branch
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/does not appear to be a git repository|could not read from remote repository|remote: Repository not found/i.test(s)) {
      return {
        area: "Git",
        severity: "high",
        summary: "Remote repository unreachable or invalid",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Bad URL, missing auth, or repo moved/private.",
        remediation: [
          "Verify repo URL and branch; ensure token/permissions present.",
          "If private, confirm OAuth token is stored and valid.",
        ],
        impact: "High",
      };
    }
    return null;
  },

  // -------- Shell / permission / ENOENT
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/ENOENT|permission denied|EACCES/i.test(s)) {
      return {
        area: "Shell",
        severity: "medium",
        summary: "File/permission issue in sandbox",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Path missing or sandbox lacks permissions.",
        remediation: [
          "Ensure the command runs within the sandbox cwd.",
          "Verify file exists before call; adjust copy/ignore patterns.",
        ],
        impact: "Medium",
      };
    }
    return null;
  },

  // -------- Claude CLI specific issues
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/claude.*timeout|Claude CLI timeout/i.test(s)) {
      return {
        area: "Toolchain",
        severity: "medium",
        summary: "Claude CLI timeout during AI test generation",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Claude CLI took too long or hung during interaction.",
        remediation: [
          "Increase CLAUDE_TIMEOUT_MS environment variable.",
          "Reduce prompt size or complexity.",
          "Check Claude CLI permissions and sandbox configuration.",
        ],
        impact: "Medium",
      };
    }
    if (/claude.*permission|trust.*folder/i.test(s)) {
      return {
        area: "Config",
        severity: "medium",
        summary: "Claude CLI permission or trust dialog issue",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Claude CLI waiting for interactive permission or trust confirmation.",
        remediation: [
          "Ensure --dangerously-skip-permissions flag is used.",
          "Add --permission-mode sandboxBashMode for sandbox operations.",
          "Verify Claude CLI supports --print mode for non-interactive use.",
        ],
        impact: "Medium",
      };
    }
    return null;
  },

  // -------- Coverage specific failures
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/coverage.*failed|FATAL ERROR.*heap.*memory/i.test(s) && /coverage/i.test(i.cmd)) {
      return {
        area: "Coverage",
        severity: "low",
        summary: "Coverage collection failed due to memory or configuration",
        command: i.cmd,
        exitCode: i.exitCode ?? undefined,
        evidence: tail(s),
        hypothesis: "Coverage tool exhausted memory or has configuration issues.",
        remediation: [
          "Increase Node.js memory: NODE_OPTIONS='--max-old-space-size=4096'.",
          "Exclude large test directories from coverage collection.",
          "Consider running coverage on a subset of tests.",
        ],
        impact: "Low",
      };
    }
    return null;
  },

  // --- Hardhat network misconfig (no network/default provider)
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/HH(\d+):|Error: invalid network|network .* not found/i.test(s) && /hardhat/.test(i.cmd)) {
      return {
        area: "Config", severity: "medium",
        summary: "Hardhat network misconfiguration",
        command: i.cmd, exitCode: i.exitCode ?? undefined, evidence: tail(s),
        hypothesis: "Missing or wrong `networks` entry in hardhat.config.*",
        remediation: [
          "Add a `hardhat` or proper test network in `hardhat.config.(ts|js)`.",
          "Verify `chainId` and RPC URLs; avoid live RPC during unit tests."
        ],
        impact: "Medium"
      };
    }
    return null;
  },

  // --- Solidity pragma vs tool solc mismatch (generic)
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/pragma solidity\s+([^;]+);/i.test(s) && /(Error: Compiler version|solc.*version)/i.test(s)) {
      return {
        area: "Build", severity: "medium",
        summary: "Solidity pragma / compiler version mismatch",
        command: i.cmd, exitCode: i.exitCode ?? undefined, evidence: tail(s),
        hypothesis: "Project pragma does not match toolchain solc version.",
        remediation: [
          "Set a compatible `solc` version in Hardhat/Foundry config.",
          "Unify pragmas across contracts to a single compatible range."
        ],
        impact: "Medium"
      };
    }
    return null;
  },

  // --- OpenZeppelin upgrades / delegatecall hazards
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/openzeppelin.*upgrade|upgrade.*unsafe|delegatecall.*proxy/i.test(s)) {
      return {
        area: "Security", severity: "high",
        summary: "Upgradeability / delegatecall risk indicators",
        command: i.cmd, exitCode: i.exitCode ?? undefined, evidence: tail(s),
        hypothesis: "Proxy/upgrade path may lack storage gap or UUPS auth.",
        remediation: [
          "Ensure `UUPSUpgradeable` authorizeUpgrade is restricted.",
          "Add storage gaps; verify initializer patterns and reinitializer guards.",
          "Run OZ `validate-implementation` before deployment."
        ],
        impact: "High"
      };
    }
    return null;
  },

  // --- Jest ESM/CJS mismatch (Node test repos)
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/SyntaxError: Cannot use import statement outside a module|ERR_REQUIRE_ESM|Unexpected token 'export'/.test(s) && /jest|npm test/.test(i.cmd)) {
      return {
        area: "Build", severity: "medium",
        summary: "ESM/CJS module mismatch in tests",
        command: i.cmd, exitCode: i.exitCode ?? undefined, evidence: tail(s),
        hypothesis: "Jest config and tsconfig/module type are misaligned.",
        remediation: [
          "Set `type` in package.json appropriately or use `ts-jest` with ESM support.",
          "Align `tsconfig.json` `module` & `moduleResolution`; add `transform` for TS."
        ],
        impact: "Medium"
      };
    }
    return null;
  },

  // --- Anchor local network not running
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/(failed to get blockhash|connection refused|solana-test-validator)/i.test(s) && /anchor test/.test(i.cmd)) {
      return {
        area: "Toolchain", severity: "high",
        summary: "Anchor test failed: validator/cluster not running",
        command: i.cmd, exitCode: i.exitCode ?? undefined, evidence: tail(s),
        hypothesis: "Local validator not started or RPC not reachable.",
        remediation: [
          "Start `solana-test-validator` in CI session or configure `anchor test --provider.cluster localnet`.",
          "Ensure adequate ulimit and disk for ledger."
        ],
        impact: "High"
      };
    }
    return null;
  },

  // --- Soroban config
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/soroban.*(not found|missing|no config)/i.test(s) && /soroban test|soroban build/.test(i.cmd)) {
      return {
        area: "Toolchain", severity: "high",
        summary: "Soroban toolchain/config missing",
        command: i.cmd, exitCode: i.exitCode ?? undefined, evidence: tail(s),
        hypothesis: "Soroban CLI not installed or `soroban.toml` absent.",
        remediation: [
          "Install Soroban CLI; check `soroban.toml` exists at repo root.",
          "Pin rust toolchain and verify `cargo` builds contracts."
        ],
        impact: "High"
      };
    }
    return null;
  },

  // --- Claude CLI/permission errors
  (i) => {
    const s = (i.stderr ?? "") + "\n" + (i.stdout ?? "");
    if (/unknown option .*--file|permission.*denied|trust.*dialog/i.test(s) && /claude/.test(i.cmd)) {
      return {
        area: "Toolchain", severity: "low",
        summary: "Claude CLI invocation/permission issue",
        command: i.cmd, exitCode: i.exitCode ?? undefined, evidence: tail(s),
        hypothesis: "Unsupported flags or sandbox permissions blocked file ops.",
        remediation: [
          "Use stdin piping or `--input-file` only if supported by `claude --help`.",
          "Run with: `--permission-mode sandboxBashMode --dangerously-skip-permissions --allowed-tools \"Bash Edit Read Write\"`."
        ],
        impact: "Low"
      };
    }
    return null;
  },
];

// ---- main
export async function writeAutoInsights(runPath: string, input: AnalysisInput): Promise<Insight[]> {
  const out: Insight[] = [];
  for (const det of detectors) {
    const insight = det(input);
    if (insight) out.push(insight);
  }
  if (!out.length) return out;

  const file = path.join(runPath, "insights.md");
  await fs.ensureFile(file);
  const buf = await fs.readFile(file, "utf8").catch(() => "");

  let next = buf;
  for (const ins of out) {
    next += `\n## [${ins.area}] ${ins.summary}\n`;
    if (ins.command) next += `**Command:** \`${ins.command}\`\n\n`;
    if (ins.exitCode != null) next += `**Exit:** ${ins.exitCode}\n\n`;
    if (ins.evidence) next += `**Evidence (tail):**\n${fence(ins.evidence)}\n`;
    if (ins.hypothesis) next += `**Root-cause hypothesis:** ${ins.hypothesis}\n\n`;
    if (ins.remediation?.length) next += `**Suggested remediation (do not apply):**\n- ${ins.remediation.join("\n- ")}\n\n`;
    if (ins.impact) next += `**Impact:** ${ins.impact}\n`;
  }

  await fs.writeFile(file, next.trim() + "\n", "utf8");
  return out;
}
