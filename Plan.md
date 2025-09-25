Fantastic—let’s stand up **UatuAudit (Node.js edition)** as a clean, headless, SOP‑first CLI that:

* **Clones** a repo into `~/.uatu/workspace`
* **Bootstraps** a branch with a normalized `.uatu/` context (no AI)
* **Detects** ecosystem(s) from the copied context
* **Runs SOPs**: inventory → static analysis → (optional) AI‑assisted test generation → sandboxed execution
* **Emits** a portable, **downloadable PDF** audit report in the run folder

Below is a complete, well‑commented TypeScript starter you can drop into a repo and run. It’s intentionally modular, <500 LOC per file, and enforces SOP determinism/idempotence. You can expand each SOP independently.

---

## Quickstart

```bash
# 1) Create the project
mkdir uatu-audit-node && cd $_

# 2) Save the files below with the given paths

# 3) Install deps
pnpm init -y || npm init -y
pnpm add commander simple-git fs-extra fast-glob execa pdfkit zod
pnpm add -D typescript @types/node ts-node tsx eslint vitest @types/pdfkit
# (Anthropic SDK is optional; the provider loads dynamically)
pnpm add @anthropic-ai/sdk || true

# 4) Build
pnpm tsc

# 5) Use the CLI (examples)
node dist/bin/uatu.js clone --repo https://github.com/owner/repo.git --project myproj --branch main
node dist/bin/uatu.js bootstrap --project myproj --branch main
node dist/bin/uatu.js inventory --project myproj --branch main
node dist/bin/uatu.js analysis --project myproj --branch main
node dist/bin/uatu.js testgen --project myproj --branch main --ai
node dist/bin/uatu.js execute --project myproj --branch main
node dist/bin/uatu.js report --project myproj --branch main
```

**Environment variables**

* `UATU_HOME` (optional): override root (defaults to `~/.uatu/workspace`)
* `UATU_USER` (optional): namespace under `users/` (defaults to `default`)
* `ANTHROPIC_API_KEY` (optional): enable `--ai` flows for test generation

---

## Project layout

```
uatu-audit-node/
├── package.json
├── tsconfig.json
├── src/
│   ├── bin/uatu.ts                 # CLI entry
│   ├── constants/paths.ts          # Path helpers (UATU_HOME, workspace)
│   ├── types.ts                    # Core types (SOP models & results)
│   ├── utils/logger.ts             # Minimal logger
│   ├── services/
│   │   ├── gitService.ts           # Git clone/checkout
│   │   ├── workspaceService.ts     # Resolve/ensure workspace paths
│   │   ├── contextBuilder.ts       # Build .uatu/context (no AI)
│   │   ├── detectors/
│   │   │   ├── languageDetector.ts # Detect ecosystems from context
│   │   │   └── solidityDetector.ts # Solidity-specific fingerprints
│   │   ├── ai/anthropicProvider.ts # Optional AI wrapper (lazy-load)
│   │   └── report/pdfReport.ts     # PDF report generation
│   ├── core/
│   │   ├── sopEngine.ts            # Deterministic SOP engine
│   │   └── orchestrator.ts         # Pipeline orchestration
│   └── sops/
│       ├── bootstrap.ts            # Phase 0 SOP
│       ├── inventory.ts            # Phase 1 SOP
│       ├── analysis.ts             # Phase 2 SOP (static checks)
│       ├── testgen.ts              # Phase 3 SOP (AI-assisted optional)
│       └── execute.ts              # Phase 4 SOP (sandbox run)
└── README.md
```

---

# Files (copy/paste exactly)

### `package.json`

```json
{
  "name": "uatu-audit",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "uatu": "dist/bin/uatu.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/bin/uatu.ts",
    "test": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.21.0",
    "commander": "^12.0.0",
    "execa": "^9.3.0",
    "fast-glob": "^3.3.2",
    "fs-extra": "^11.2.0",
    "pdfkit": "^0.14.0",
    "simple-git": "^3.24.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "@types/pdfkit": "^0.13.5",
    "eslint": "^9.10.0",
    "ts-node": "^10.9.2",
    "tsx": "^4.19.0",
    "typescript": "^5.6.2",
    "vitest": "^2.0.5"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "preserveSymlinks": false,
    "skipLibCheck": true,
    "preserveConstEnums": true,
    "preserveValueImports": true,
    "preserveSymlinksMain": false,
    "preserveWatchOutput": true,
    "preserveShebangs": true
  },
  "include": ["src/**/*"]
}
```

### `src/types.ts`

```ts
/**
 * Core types for SOPs and status tracking.
 * Keep small and stable; version with Zod if you need schema guarantees.
 */
import { z } from "zod";

export type Ecosystem =
  | "solidity-foundry"
  | "solidity-hardhat"
  | "solana-anchor"
  | "stellar-soroban"
  | "node";

export type Fingerprint = {
  ecosystems: Ecosystem[];
  indicators: Record<string, string | boolean>;
};

export type SOPName = "bootstrap" | "inventory" | "analysis" | "testgen" | "execute";

export interface SOPInputs {
  projectPath: string;       // Absolute path to branch root
  contextPath: string;       // .uatu/context
  runsPath: string;          // runs/
  timestamp?: string;        // optional for run stamping
  fingerprint?: Fingerprint; // computed in bootstrap
  ai?: boolean;              // opt-in AI for testgen phase
}

export interface SOPResult {
  ok: boolean;
  outputs: Record<string, unknown>;
  errors: string[];
  started_at: string;
  completed_at: string;
  version: string;
}

export interface SOP {
  name: SOPName;
  version: string;
  prerequisites: SOPName[];
  validateInputs(inputs: SOPInputs): Promise<boolean>;
  execute(inputs: SOPInputs): Promise<SOPResult>;
  verifyOutputs(result: SOPResult): Promise<boolean>;
}

// Status file structure for deterministic audit logs.
export const SopStatusSchema = z.object({
  sop_name: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  started_at: z.string(),
  completed_at: z.string().optional(),
  inputs: z.record(z.any()),
  outputs: z.record(z.any()).optional(),
  errors: z.array(z.string()).default([]),
  version: z.string()
});
export type SopStatus = z.infer<typeof SopStatusSchema>;
```

### `src/utils/logger.ts`

```ts
/**
 * Minimal console logger with scoped prefixes.
 * Keep silent by default in library mode if needed.
 */
export const logger = (scope = "uatu") => ({
  info: (m: string, ...a: unknown[]) => console.log(`[${scope}] ${m}`, ...a),
  warn: (m: string, ...a: unknown[]) => console.warn(`[${scope}] ${m}`, ...a),
  error: (m: string, ...a: unknown[]) => console.error(`[${scope}] ${m}`, ...a),
});
```

### `src/constants/paths.ts`

```ts
/**
 * Normalized workspace paths under ~/.uatu/workspace unless overridden by UATU_HOME.
 */
import path from "node:path";
import os from "node:os";
import fs from "fs-extra";

const DEFAULT_HOME = path.join(os.homedir(), ".uatu", "workspace");

export function getUatuHome() {
  return process.env.UATU_HOME ? path.resolve(process.env.UATU_HOME) : DEFAULT_HOME;
}

export function getUserId(): string {
  return process.env.UATU_USER || "default";
}

export async function ensureDirs(...p: string[]) {
  await fs.ensureDir(path.join(...p));
}

export function userRoot(userId = getUserId()) {
  return path.join(getUatuHome(), "users", userId);
}

export function projectRoot(userId: string, project: string) {
  return path.join(userRoot(userId), "projects", project);
}

export function branchRoot(userId: string, project: string, branch: string) {
  return path.join(projectRoot(userId, project), "branches", branch);
}

export function uatuInternal(branchPath: string) {
  // `.uatu` metadata lives in branch root (not the user's global workspace root)
  return path.join(branchPath, ".uatu");
}

export function runsRoot(branchPath: string) {
  return path.join(branchPath, "runs");
}
```

### `src/services/gitService.ts`

```ts
/**
 * Git operations: shallow clone + branch checkout into the workspace.
 */
import path from "node:path";
import simpleGit from "simple-git";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";

const log = logger("git");

export async function cloneOrRefresh(repoUrl: string, dest: string, branch?: string) {
  await fs.ensureDir(path.dirname(dest));
  if (await fs.pathExists(path.join(dest, ".git"))) {
    log.info(`Repo exists: pulling latest in ${dest}`);
    const git = simpleGit({ baseDir: dest });
    await git.fetch();
    if (branch) await git.checkout(branch);
    await git.pull("origin", branch ?? (await git.revparse(["--abbrev-ref", "HEAD"])));
  } else {
    log.info(`Cloning ${repoUrl} -> ${dest}`);
    const git = simpleGit();
    await git.clone(repoUrl, dest, ["--depth", "1"]);
    if (branch) {
      const g2 = simpleGit({ baseDir: dest });
      await g2.checkout(branch);
    }
  }
}
```

### `src/services/workspaceService.ts`

```ts
/**
 * Resolve and ensure workspace directories; provide computed paths
 * that match the SOP-ready layout under the branch.
 */
import path from "node:path";
import fs from "fs-extra";
import { branchRoot, runsRoot, uatuInternal, ensureDirs, getUserId } from "../constants/paths.js";

export interface ResolvedPaths {
  branchPath: string;
  contextPath: string;  // .uatu/context
  sopPath: string;      // .uatu/sop
  runsPath: string;     // runs/
}

export async function resolveWorkspace(project: string, branch: string, userId = getUserId()): Promise<ResolvedPaths> {
  const branchPath = branchRoot(userId, project, branch);
  const internal = uatuInternal(branchPath);
  const contextPath = path.join(internal, "context");
  const sopPath = path.join(internal, "sop");
  const runsPath = runsRoot(branchPath);

  await ensureDirs(branchPath);
  await fs.ensureDir(internal);
  await fs.ensureDir(contextPath);
  await fs.ensureDir(sopPath);
  await fs.ensureDir(runsPath);

  return { branchPath, contextPath, sopPath, runsPath };
}
```

### `src/services/contextBuilder.ts`

```ts
/**
 * Build .uatu/context WITHOUT AI.
 * - Directory tree snapshot (tree.txt)
 * - File listing with sizes/mtime (files.json)
 * - Copy root README*, package.json, foundry.toml, hardhat.config.*, Anchor/Cargo files, soroban config
 */
import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import { logger } from "../utils/logger.js";

const log = logger("context");

function formatTree(entries: string[]): string {
  // Simple text tree; avoids external deps.
  const lines: string[] = [];
  for (const e of entries.sort()) lines.push(e);
  return lines.join("\n");
}

export async function buildContext(branchPath: string, contextPath: string) {
  const cwd = branchPath;
  const rel = (p: string) => path.relative(cwd, p) || ".";

  const patterns = ["**/*", "!**/.git/**", "!.git", "!node_modules/**", "!**/target/**", "!**/runs/**", "!**/.uatu/**"];
  const files = await fg(patterns, { dot: true, cwd });

  // 1) tree.txt
  const treeTxt = formatTree(files);
  await fs.writeFile(path.join(contextPath, "tree.txt"), treeTxt, "utf8");

  // 2) files.json (paths, size, mtime)
  const records: Array<{ file: string; size: number; mtime: string }> = [];
  for (const f of files) {
    const stat = await fs.stat(path.join(cwd, f));
    if (!stat.isFile()) continue;
    records.push({ file: f, size: stat.size, mtime: stat.mtime.toISOString() });
  }
  await fs.writeJson(path.join(contextPath, "files.json"), records, { spaces: 2 });

  // 3) copy common context artifacts
  const candidates = [
    "README.md", "README.MD", "readme.md",
    "package.json",
    "foundry.toml",
    "hardhat.config.ts", "hardhat.config.js",
    "anchor.toml", "Cargo.toml",
    "soroban.toml", "soroban.config.toml"
  ];
  for (const name of candidates) {
    const src = path.join(cwd, name);
    if (await fs.pathExists(src)) {
      await fs.copy(src, path.join(contextPath, name));
      log.info(`Context copied: ${name}`);
    }
  }
}
```

### `src/services/detectors/languageDetector.ts`

```ts
/**
 * Ecosystem detector based on .uatu/context contents and repo surface.
 * Conservative (no AI): look for signature files/patterns.
 */
import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import { Fingerprint, Ecosystem } from "../../types.js";

async function exists(p: string) { return fs.pathExists(p); }

export async function detectEcosystems(branchPath: string, contextPath: string): Promise<Fingerprint> {
  const ecosystems: Ecosystem[] = [];
  const indicators: Record<string, string | boolean> = {};

  // Solidity/Foundry
  if (await exists(path.join(branchPath, "foundry.toml"))) {
    ecosystems.push("solidity-foundry");
    indicators["foundry"] = true;
  }

  // Solidity/Hardhat
  if (await exists(path.join(branchPath, "hardhat.config.ts")) || await exists(path.join(branchPath, "hardhat.config.js"))) {
    ecosystems.push("solidity-hardhat");
    indicators["hardhat"] = true;
  }

  // Solana/Anchor
  if (await exists(path.join(branchPath, "Anchor.toml")) || await exists(path.join(branchPath, "anchor.toml"))) {
    ecosystems.push("solana-anchor");
    indicators["anchor"] = true;
  }

  // Stellar/Soroban
  if (await exists(path.join(branchPath, "soroban.toml")) || await exists(path.join(branchPath, "soroban.config.toml"))) {
    ecosystems.push("stellar-soroban");
    indicators["soroban"] = true;
  }

  // Node project
  if (await exists(path.join(branchPath, "package.json"))) {
    ecosystems.push("node");
    indicators["node"] = true;
  }

  // Heuristics: presence of Solidity / Rust / TS sources
  const solFiles = await fg(["**/*.sol", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd: branchPath });
  if (solFiles.length) indicators["has_solidity"] = true;

  const rsFiles = await fg(["**/*.rs", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd: branchPath });
  if (rsFiles.length) indicators["has_rust"] = true;

  const tsFiles = await fg(["**/*.ts", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd: branchPath });
  if (tsFiles.length) indicators["has_typescript"] = true;

  // Deduplicate ecosystems
  const uniq = [...new Set(ecosystems)];
  return { ecosystems: uniq, indicators };
}
```

### `src/services/detectors/solidityDetector.ts`

```ts
/**
 * Solidity-specific quick fingerprint helpers (no parsing libs required).
 * You can extend with solidity-parser-antlr later if you want AST-level checks.
 */
import fg from "fast-glob";

export async function listSolidityContracts(cwd: string) {
  return fg(["**/*.sol", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd });
}
```

### `src/services/ai/anthropicProvider.ts`

```ts
/**
 * Optional Anthropic provider (lazy import), used only when --ai flag is true.
 * Keeps the platform "SOPs over AI" by scoping usage to complex test ideas.
 */
type ClaudeMessage = { role: "user" | "assistant" | "system"; content: string };

export interface TestIdeas {
  files: Array<{ path: string; tests: string[] }>;
}

export async function suggestTestsWithAnthropic(prompt: string): Promise<TestIdeas> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  // Try official SDK first, fallback to dynamic import path variants if needed.
  let AnthropicCtor: any;
  try {
    const mod = await import("@anthropic-ai/sdk");
    AnthropicCtor = mod.Anthropic || mod.default || mod;
  } catch {
    const mod = await import("anthropic"); // legacy
    AnthropicCtor = (mod as any).Anthropic || mod.default || mod;
  }
  const anthropic = new AnthropicCtor({ apiKey: key });

  // Keep the prompt deterministic and short; we’re asking for structured suggestions.
  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 800,
    temperature: 0.2,
    system: "You create minimal, executable test ideas for smart contract repos, grouped by file. Output JSON only.",
    messages: [
      { role: "user", content: prompt }
    ]
  });

  // Handle both SDK text and content blocks cases defensively.
  const text =
    (msg?.content?.[0]?.type === "text" && msg.content[0].text) ||
    (typeof (msg as any).content === "string" && (msg as any).content) ||
    JSON.stringify(msg);

  try {
    return JSON.parse(text) as TestIdeas;
  } catch {
    // Fallback to empty if parsing fails
    return { files: [] };
  }
}
```

### `src/services/report/pdfReport.ts`

```ts
/**
 * Generate a small, deterministic PDF from SOP outputs using pdfkit.
 * The PDF is written into runs/{timestamp}/report.pdf and returns its absolute path.
 */
import path from "node:path";
import fs from "fs-extra";
import PDFDocument from "pdfkit";

export interface ReportSection { title: string; items: string[]; }
export interface ReportData {
  project: string;
  branch: string;
  timestamp: string;
  ecosystemSummary: string[];
  findings: Array<{ id: string; severity: "low" | "medium" | "high"; title: string; file?: string }>;
  coverage?: number; // optional if collected
}

export async function writePdfReport(runsStampPath: string, data: ReportData): Promise<string> {
  const out = path.join(runsStampPath, "report.pdf");
  await fs.ensureDir(runsStampPath);

  const doc = new PDFDocument({ info: { Title: "UatuAudit Report", Author: "UatuAudit" } });
  const stream = fs.createWriteStream(out);
  doc.pipe(stream);

  doc.fontSize(20).text("UatuAudit – Systematic Smart Contract Audit", { underline: true });
  doc.moveDown().fontSize(12);

  doc.text(`Project: ${data.project}`);
  doc.text(`Branch : ${data.branch}`);
  doc.text(`Run    : ${data.timestamp}`);
  doc.moveDown();

  doc.text("Ecosystems detected:");
  for (const e of data.ecosystemSummary) doc.text(` • ${e}`);
  doc.moveDown();

  if (typeof data.coverage === "number") {
    doc.text(`Estimated Coverage (generated tests): ${Math.round(data.coverage * 100)}%`);
    doc.moveDown();
  }

  doc.fontSize(14).text("Findings", { underline: true });
  doc.fontSize(12);
  if (!data.findings.length) doc.text("No findings recorded by static analysis.");
  for (const f of data.findings) {
    doc.text(`[${f.severity.toUpperCase()}] ${f.id}: ${f.title}${f.file ? ` (${f.file})` : ""}`);
  }

  doc.end();
  await new Promise((res) => stream.on("finish", res));
  return out;
}
```

### `src/core/sopEngine.ts`

```ts
/**
 * Deterministic SOP engine: run a single SOP, capture start/stop times,
 * write status to .uatu/sop/{sop}.status.json, and ensure idempotence.
 */
import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SopStatusSchema } from "../types.js";
import { logger } from "../utils/logger.js";

const log = logger("sop");

export async function runSOP(sop: SOP, inputs: SOPInputs, sopPath: string) {
  const statusFile = path.join(sopPath, `${sop.name}.status.json`);
  const now = new Date().toISOString();

  const status = {
    sop_name: sop.name,
    status: "running",
    started_at: now,
    inputs,
    version: sop.version,
    errors: []
  };

  await fs.writeJson(statusFile, status, { spaces: 2 });

  try {
    const valid = await sop.validateInputs(inputs);
    if (!valid) throw new Error("validateInputs() returned false");

    const result = await sop.execute(inputs);
    const verified = await sop.verifyOutputs(result);

    const final = {
      ...status,
      status: result.ok && verified ? "completed" : "failed",
      completed_at: new Date().toISOString(),
      outputs: result.outputs,
      errors: result.errors
    };

    await fs.writeJson(statusFile, final, { spaces: 2 });
    SopStatusSchema.parse(final); // validate file shape
    return final;
  } catch (e: any) {
    const failed = {
      ...status,
      status: "failed",
      completed_at: new Date().toISOString(),
      errors: [String(e?.message || e)]
    };
    await fs.writeJson(statusFile, failed, { spaces: 2 });
    log.error(`SOP ${sop.name} failed: ${failed.errors[0]}`);
    return failed;
  }
}
```

### `src/core/orchestrator.ts`

```ts
/**
 * Orchestrator to run SOPs in order, enforcing prerequisites.
 */
import { SOP, SOPInputs } from "../types.js";
import { runSOP } from "./sopEngine.js";

export async function runPipeline(sops: SOP[], inputs: SOPInputs, sopPath: string, until?: SOP["name"]) {
  const order = ["bootstrap", "inventory", "analysis", "testgen", "execute"] as const;
  for (const name of order) {
    const sop = sops.find(s => s.name === name);
    if (!sop) continue;
    await runSOP(sop, inputs, sopPath);
    if (until && name === until) break;
  }
}
```

### `src/sops/bootstrap.ts`

```ts
/**
 * Phase 0: Bootstrap SOP
 * - Build .uatu/context
 * - Detect ecosystem(s)
 * - Verify basic tool presence by ecosystem (soft checks to remain portable)
 */
import path from "node:path";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { buildContext } from "../services/contextBuilder.js";
import { detectEcosystems } from "../services/detectors/languageDetector.js";
import fs from "fs-extra";

export const bootstrapSOP: SOP = {
  name: "bootstrap",
  version: "1.0.0",
  prerequisites: [],
  async validateInputs(inputs: SOPInputs) {
    return !!(inputs.projectPath && inputs.contextPath);
  },
  async execute(inputs: SOPInputs): Promise<SOPResult> {
    const started_at = new Date().toISOString();
    const errors: string[] = [];

    await buildContext(inputs.projectPath, inputs.contextPath);
    const fingerprint = await detectEcosystems(inputs.projectPath, inputs.contextPath);

    // Mark audit-ready if at least one ecosystem detected or package.json exists
    const ready = fingerprint.ecosystems.length > 0;

    // Write bootstrap marker
    await fs.ensureDir(path.join(inputs.projectPath, ".uatu", "sop"));
    await fs.writeFile(path.join(inputs.projectPath, ".uatu", "sop", "done.marker"), "bootstrap\n");

    const outputs = {
      ready,
      fingerprint
    };

    const completed_at = new Date().toISOString();
    return { ok: true, outputs, errors, started_at, completed_at, version: this.version };
  },
  async verifyOutputs(result: SOPResult) {
    return !!result.outputs && "fingerprint" in result.outputs;
  }
};
```

### `src/sops/inventory.ts`

```ts
/**
 * Phase 1: Inventory SOP
 * - Catalog contracts/files
 * - Enumerate public/external function signatures (lightweight, pattern-based)
 * - Gather existing tests presence
 */
import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { listSolidityContracts } from "../services/detectors/solidityDetector.js";

export const inventorySOP: SOP = {
  name: "inventory",
  version: "1.0.0",
  prerequisites: ["bootstrap"],
  async validateInputs(inputs) {
    return !!(inputs.projectPath && inputs.contextPath);
  },
  async execute(inputs: SOPInputs): Promise<SOPResult> {
    const started_at = new Date().toISOString();
    const errors: string[] = [];

    const contracts: Record<string, { functions: string[] }> = {};
    // Solidity quick function signature extraction (regex, safe fallback)
    for (const file of await listSolidityContracts(inputs.projectPath)) {
      const abs = path.join(inputs.projectPath, file);
      const txt = await fs.readFile(abs, "utf8");
      const sigs = Array.from(txt.matchAll(/\b(public|external)\s+(?:payable\s+)?(?:view\s+|pure\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g))
        .map(m => `${m[2]}(${m[3] || ""}) ${m[1]}`);
      contracts[file] = { functions: sigs };
    }

    // Existing tests
    const testFiles = await fg(
      ["**/*.{t,s}est.{js,ts}", "**/*.t.sol", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"],
      { cwd: inputs.projectPath }
    );

    const outputs = {
      contracts,
      tests: testFiles,
    };

    // Persist as inventory.json
    const outFile = path.join(inputs.projectPath, "runs", inputs.timestamp ?? Date.now().toString(), "inventory.json");
    await fs.ensureDir(path.dirname(outFile));
    await fs.writeJson(outFile, outputs, { spaces: 2 });

    const completed_at = new Date().toISOString();
    return { ok: true, outputs, errors, started_at, completed_at, version: this.version };
  },
  async verifyOutputs(result) {
    return !!result.outputs && "contracts" in result.outputs;
  }
};
```

### `src/sops/analysis.ts`

```ts
/**
 * Phase 2: Static Analysis SOP (pattern-based, fast)
 * - Reentrancy markers, tx.origin usage, unbounded loops (heuristic), low-level calls
 * - Node: eval/Function/child_process usage
 * Extend with AST analyzers later.
 */
import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import { SOP, SOPInputs, SOPResult } from "../types.js";

type Finding = { id: string; severity: "low" | "medium" | "high"; title: string; file: string };

export const analysisSOP: SOP = {
  name: "analysis",
  version: "1.0.0",
  prerequisites: ["bootstrap", "inventory"],
  async validateInputs(inputs) {
    return !!inputs.projectPath;
  },
  async execute(inputs: SOPInputs): Promise<SOPResult> {
    const started_at = new Date().toISOString();
    const errors: string[] = [];
    const findings: Finding[] = [];

    // Solidity patterns
    const solFiles = await fg(["**/*.sol", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd: inputs.projectPath });
    for (const file of solFiles) {
      const abs = path.join(inputs.projectPath, file);
      const s = await fs.readFile(abs, "utf8");
      if (/\btx\.origin\b/.test(s)) findings.push({ id: "SOL-TX-ORIGIN", severity: "high", title: "tx.origin used for auth", file });
      if (/\.(call|callcode|delegatecall)\s*\(/.test(s)) findings.push({ id: "SOL-LOWLEVEL-CALL", severity: "medium", title: "Low-level call detected", file });
      if (/\bcall{value:/.test(s) || /\.call\.value\(/.test(s)) findings.push({ id: "SOL-CALL-VALUE", severity: "medium", title: "value transfer via call()", file });
      if (/\bfor\s*\(\s*;\s*;\s*\)/.test(s)) findings.push({ id: "SOL-UNBOUNDED-LOOP", severity: "low", title: "Potential unbounded loop", file });
      if (/\bnonReentrant\b/.test(s) === false && /\.(call|transfer)\(/.test(s) && /function\s+[A-Za-z0-9_]+\s*\(.*\)\s*(public|external)/.test(s)) {
        findings.push({ id: "SOL-REENTRANCY-SUSPECT", severity: "medium", title: "Potential reentrancy (no guard around external call)", file });
      }
    }

    // Node patterns
    const nodeFiles = await fg(["**/*.{js,ts}", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd: inputs.projectPath });
    for (const file of nodeFiles) {
      const abs = path.join(inputs.projectPath, file);
      const s = await fs.readFile(abs, "utf8");
      if (/\beval\s*\(/.test(s)) findings.push({ id: "NODE-EVAL", severity: "high", title: "eval() usage", file });
      if (/\bnew Function\s*\(/.test(s)) findings.push({ id: "NODE-NEW-FUNCTION", severity: "medium", title: "new Function() usage", file });
      if (/\b(child_process|spawn|exec|execSync)\b/.test(s)) findings.push({ id: "NODE-CHILD-PROC", severity: "medium", title: "child_process usage", file });
    }

    const outputs = { findings };
    const outFile = path.join(inputs.projectPath, "runs", inputs.timestamp ?? Date.now().toString(), "analysis.json");
    await fs.ensureDir(path.dirname(outFile));
    await fs.writeJson(outFile, outputs, { spaces: 2 });

    const completed_at = new Date().toISOString();
    return { ok: true, outputs, errors, started_at, completed_at, version: this.version };
  },
  async verifyOutputs(result) {
    return !!result.outputs && Array.isArray((result.outputs as any).findings);
  }
};
```

### `src/sops/testgen.ts`

```ts
/**
 * Phase 3: Test Generation SOP
 * - If --ai, use Anthropic to propose minimal test cases (no code execution).
 * - Save under .uatu/ai_tests/ (non-destructive; source repo remains intact).
 */
import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { suggestTestsWithAnthropic } from "../services/ai/anthropicProvider.js";

export const testgenSOP: SOP = {
  name: "testgen",
  version: "1.0.0",
  prerequisites: ["bootstrap", "inventory", "analysis"],
  async validateInputs(inputs) {
    return !!inputs.projectPath;
  },
  async execute(inputs: SOPInputs): Promise<SOPResult> {
    const started_at = new Date().toISOString();
    const errors: string[] = [];
    const ai_tests_path = path.join(inputs.projectPath, ".uatu", "ai_tests");

    await fs.ensureDir(ai_tests_path);

    let outputs: Record<string, unknown> = { files: [] };

    if (inputs.ai) {
      const contextTree = await fs.readFile(path.join(inputs.contextPath, "tree.txt"), "utf8").catch(() => "");
      const inventory = await fs.readJson(path.join(inputs.projectPath, "runs", inputs.timestamp ?? "", "inventory.json")).catch(() => null);
      const prompt = [
        "Repo structure (trimmed):",
        contextTree.slice(0, 20_000),
        "",
        "Inventory (contracts + functions):",
        JSON.stringify(inventory?.contracts || {}, null, 2).slice(0, 20_000),
        "",
        "Task: Propose minimal test names (no code) for high-risk areas:",
        "- Reentrancy, access control, boundary conditions, pausing, upgrade guards.",
        "Format: { files: [ { path: string, tests: string[] } ] }"
      ].join("\n");

      const ideas = await suggestTestsWithAnthropic(prompt).catch((e) => {
        errors.push(String(e.message || e));
        return { files: [] };
      });

      // Persist as plain text placeholders; user can implement content.
      for (const f of ideas.files) {
        const fn = path.basename(f.path) || "generated";
        const out = path.join(ai_tests_path, `${fn}.plan.txt`);
        const body = `# Test Plan for ${f.path}\n\n${f.tests.map((t, i) => `- [ ] ${t}`).join("\n")}\n`;
        await fs.writeFile(out, body, "utf8");
      }
      outputs = ideas as any;
    }

    const completed_at = new Date().toISOString();
    return { ok: true, outputs, errors, started_at, completed_at, version: this.version };
  },
  async verifyOutputs(_result) {
    return true; // Non-critical phase; files are optional without --ai
  }
};
```

### `src/sops/execute.ts`

```ts
/**
 * Phase 4: Sandboxed Execution SOP
 * - Create runs/{timestamp}/sandbox
 * - Materialize minimal deps; run toolchain per detected ecosystem.
 * - Aggregate results (stdout) and store coverage if tool supports it.
 * NOTE: Running untrusted code is risky—run inside container/vm in production.
 */
import path from "node:path";
import fs from "fs-extra";
import { execa } from "execa";
import { SOP, SOPInputs, SOPResult } from "../types.js";

async function runCmd(cmd: string, args: string[], cwd: string) {
  const p = execa(cmd, args, { cwd, all: true });
  const { all } = await p;
  return all ?? "";
}

export const executeSOP: SOP = {
  name: "execute",
  version: "1.0.0",
  prerequisites: ["bootstrap", "inventory", "analysis"],
  async validateInputs(inputs) {
    return !!(inputs.projectPath && inputs.runsPath);
  },
  async execute(inputs: SOPInputs): Promise<SOPResult> {
    const started_at = new Date().toISOString();
    const errors: string[] = [];

    const stamp = inputs.timestamp ?? new Date().toISOString().replace(/[:.]/g, "-");
    const runPath = path.join(inputs.runsPath, stamp);
    const sandbox = path.join(runPath, "sandbox");
    await fs.ensureDir(sandbox);

    // Shallow copy project (no .git, no node_modules)
    await fs.copy(inputs.projectPath, sandbox, {
      filter: (src) => !/\.git(\/|$)/.test(src) && !/node_modules(\/|$)/.test(src) && !/\/runs(\/|$)/.test(src)
    });

    // Pick a command per ecosystem (soft heuristics)
    let stdout = "";
    const hasFoundry = await fs.pathExists(path.join(sandbox, "foundry.toml"));
    const hasHardhat = await fs.pathExists(path.join(sandbox, "hardhat.config.ts")) || await fs.pathExists(path.join(sandbox, "hardhat.config.js"));
    const hasAnchor = await fs.pathExists(path.join(sandbox, "Anchor.toml")) || await fs.pathExists(path.join(sandbox, "anchor.toml"));
    const hasSoroban = await fs.pathExists(path.join(sandbox, "soroban.toml")) || await fs.pathExists(path.join(sandbox, "soroban.config.toml"));
    const hasNode = await fs.pathExists(path.join(sandbox, "package.json"));

    try {
      if (hasFoundry) {
        stdout += await runCmd("forge", ["test", "-vvv"], sandbox);
      } else if (hasHardhat && hasNode) {
        await runCmd("npm", ["i", "--silent", "--no-progress"], sandbox);
        stdout += await runCmd("npx", ["hardhat", "test"], sandbox);
      } else if (hasAnchor) {
        stdout += await runCmd("anchor", ["test"], sandbox);
      } else if (hasSoroban) {
        stdout += await runCmd("soroban", ["test"], sandbox);
      } else if (hasNode) {
        await runCmd("npm", ["i", "--silent", "--no-progress"], sandbox);
        stdout += await runCmd("npm", ["test", "--silent"], sandbox);
      } else {
        stdout += "No known toolchain found; execution skipped.\n";
      }
    } catch (e: any) {
      errors.push(`Execution error: ${e?.shortMessage || e?.message || String(e)}`);
    }

    const outputs = { runPath, sandbox, stdout };
    await fs.writeFile(path.join(runPath, "execute.log"), stdout, "utf8");

    const completed_at = new Date().toISOString();
    return { ok: errors.length === 0, outputs, errors, started_at, completed_at, version: this.version };
  },
  async verifyOutputs(_result) { return true; }
};
```

### `src/bin/uatu.ts`

```ts
#!/usr/bin/env node
/**
 * UatuAudit CLI (headless) — Node.js edition
 * Commands:
 *  - clone       : git clone repo into workspace
 *  - bootstrap   : Phase 0 SOP (context + detection)
 *  - inventory   : Phase 1 SOP (catalog)
 *  - analysis    : Phase 2 SOP (static patterns)
 *  - testgen     : Phase 3 SOP (optional AI)
 *  - execute     : Phase 4 SOP (sandbox run)
 *  - report      : Generate PDF from recent run
 */
import { Command } from "commander";
import path from "node:path";
import { cloneOrRefresh } from "../services/gitService.js";
import { resolveWorkspace } from "../services/workspaceService.js";
import { bootstrapSOP } from "../sops/bootstrap.js";
import { inventorySOP } from "../sops/inventory.js";
import { analysisSOP } from "../sops/analysis.js";
import { testgenSOP } from "../sops/testgen.js";
import { executeSOP } from "../sops/execute.js";
import { runPipeline } from "../core/orchestrator.js";
import { writePdfReport } from "../services/report/pdfReport.js";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";

const log = logger("cli");
const program = new Command();

program
  .name("uatu")
  .description("UatuAudit – Systematic Smart Contract Audit (Node.js)")
  .version("0.1.0");

program
  .command("clone")
  .requiredOption("--repo <url>", "git repo URL")
  .requiredOption("--project <name>", "project name")
  .requiredOption("--branch <name>", "branch name")
  .action(async (opts) => {
    const { project, branch } = opts;
    const { branchPath } = await resolveWorkspace(project, branch);
    await cloneOrRefresh(opts.repo, branchPath, branch);
    log.info(`Cloned into ${branchPath}`);
  });

program
  .command("bootstrap")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .action(async (opts) => {
    const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(opts.project, opts.branch);
    const inputs = { projectPath: branchPath, contextPath, runsPath };
    await runPipeline([bootstrapSOP], inputs, sopPath, "bootstrap");
    log.info("Bootstrap complete");
  });

program
  .command("inventory")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .action(async (opts) => {
    const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(opts.project, opts.branch);
    const timestamp = Date.now().toString();
    const inputs = { projectPath: branchPath, contextPath, runsPath, timestamp };
    await runPipeline([bootstrapSOP, inventorySOP], inputs, sopPath, "inventory");
    log.info("Inventory complete");
  });

program
  .command("analysis")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .action(async (opts) => {
    const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(opts.project, opts.branch);
    const timestamp = Date.now().toString();
    const inputs = { projectPath: branchPath, contextPath, runsPath, timestamp };
    await runPipeline([bootstrapSOP, inventorySOP, analysisSOP], inputs, sopPath, "analysis");
    log.info("Analysis complete");
  });

program
  .command("testgen")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .option("--ai", "enable AI-assisted ideas via Anthropic", false)
  .action(async (opts) => {
    const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(opts.project, opts.branch);
    const timestamp = Date.now().toString();
    const inputs = { projectPath: branchPath, contextPath, runsPath, timestamp, ai: !!opts.ai };
    await runPipeline([bootstrapSOP, inventorySOP, analysisSOP, testgenSOP], inputs, sopPath, "testgen");
    log.info("Test generation complete");
  });

program
  .command("execute")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .action(async (opts) => {
    const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(opts.project, opts.branch);
    const timestamp = Date.now().toString();
    const inputs = { projectPath: branchPath, contextPath, runsPath, timestamp };
    await runPipeline([bootstrapSOP, inventorySOP, analysisSOP, executeSOP], inputs, sopPath, "execute");
    log.info("Execution complete");
  });

program
  .command("report")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .action(async (opts) => {
    const { branchPath, runsPath } = await resolveWorkspace(opts.project, opts.branch);
    // Take latest run folder
    const runs = (await fs.readdir(runsPath)).sort();
    const last = runs.at(-1);
    if (!last) throw new Error("No runs found; execute the pipeline first.");

    const analysis = await fs.readJson(path.join(runsPath, last, "analysis.json")).catch(() => ({ findings: [] }));
    const fingerprint = await fs.readJson(path.join(branchPath, ".uatu", "sop", "bootstrap.status.json")).catch(() => null);

    const pdfPath = await writePdfReport(path.join(runsPath, last), {
      project: opts.project,
      branch: opts.branch,
      timestamp: last,
      ecosystemSummary: (fingerprint?.outputs?.fingerprint?.ecosystems ?? []) as string[],
      findings: analysis.findings ?? [],
      coverage: undefined
    });

    log.info(`Report ready: ${pdfPath}`);
    console.log(`Download: file://${pdfPath}`);
  });

program.parseAsync().catch((e) => {
  log.error(String(e?.message || e));
  process.exit(1);
});
```

---

## Why this hits your goals

* **SOPs over AI**: All heavy lifting (clone, context, detection, inventory, static analysis, sandbox) is systematic and reproducible; AI is opt‑in and scoped to proposing test ideas only (`--ai`).
* **No Python**: 100% Node/TS. The only “run code” action is in `execute` via toolchain CLIs (forge/hardhat/anchor/soroban/npm).
* **Workspace-first**: Everything lives under `~/.uatu/workspace/users/{UATU_USER}/projects/{project}/branches/{branch}` with `.uatu/context`, `.uatu/sop`, and `runs/{timestamp}` per your spec.
* **Non-destructive**: AI output is stored in `.uatu/ai_tests/`. Source repo remains untouched.
* **Downloadable PDF**: `report` command writes `runs/{timestamp}/report.pdf` and prints a `file://` link.
* **Deterministic & Idempotent**: SOP statuses persist as JSON; re‑running phases won’t mangle the repo.

---

## Next Steps (when you’re ready)

1. **Harden Sandbox**: Run `execute` inside a container (e.g., `docker run --rm …`) to safely test untrusted code.
2. **AST-Level Analyzers**: Add `solidity-parser-antlr` and Rust/Anchor/Soroban analyzers for richer, low‑noise findings.
3. **Coverage Collection**:

   * Foundry: `forge coverage`
   * Hardhat: `npx hardhat coverage`
   * Add parsers to inject `coverage` into the PDF.
4. **AI Code Emit (Optional)**: Extend `testgen` to scaffold minimal `.t.sol` or Jest tests guarded by `--ai-write`.
5. **Server Mode (Later)**: Add a small HTTP layer (`/api/run`, `/api/report`) reusing these modules—frontend can come last.

---

# README.md (developer knowledge base)

````md
# UatuAudit (Node.js Edition)

UatuAudit turns ad-hoc smart contract audits into **standardized, repeatable SOPs**.  
This headless CLI clones a repo, builds a no‑AI `.uatu/context`, detects the ecosystem, runs inventory & static analysis, optionally asks an LLM for **test ideas**, executes tests in a sandbox, and ships a **PDF report** per run.

## Core Philosophy

- **SOPs over AI** — 80% system, 20% AI (optional).
- **Deterministic, atomic, idempotent** SOPs with on-disk status files.
- **Non-destructive** — source repo stays untouched; outputs live under `.uatu/` and `runs/`.

## Requirements

- Node.js 18+ (recommended 20 LTS)
- Toolchains you intend to use (optional but recommended):
  - Foundry (`forge`)
  - Hardhat (`node`, `npm`, `npx hardhat`)
  - Anchor (`anchor`)
  - Soroban (`soroban`)
- (Optional) `ANTHROPIC_API_KEY` for `--ai` test ideas.

## Install & Run

```bash
pnpm install
pnpm build

# Clone a repo into ~/.uatu/workspace
uatu clone --repo https://github.com/owner/repo.git --project myproj --branch main

# SOPs
uatu bootstrap --project myproj --branch main
uatu inventory --project myproj --branch main
uatu analysis  --project myproj --branch main

# Optional AI ideas
export ANTHROPIC_API_KEY=sk-...
uatu testgen --project myproj --branch main --ai

# Execute tests in sandbox & report
uatu execute --project myproj --branch main
uatu report  --project myproj --branch main
````

## Workspace Layout

```
~/.uatu/workspace/
└── users/{UATU_USER}/projects/{project}/branches/{branch}/
    ├── .uatu/
    │   ├── context/         # tree, files.json, copied config/readme
    │   ├── sop/             # *.status.json + done.marker
    │   └── ai_tests/        # AI-suggested plans (no source modifications)
    ├── runs/
    │   └── {timestamp}/
    │       ├── inventory.json
    │       ├── analysis.json
    │       ├── execute.log
    │       └── report.pdf
    └── <cloned repo>
```

## SOPs

* **bootstrap**: build `.uatu/context`, detect ecosystems, write readiness marker.
* **inventory**: list contracts, extract public/external function signatures, find tests.
* **analysis**: pattern-based static checks (tx.origin, low-level calls, eval, child\_process, etc.).
* **testgen**: optional **AI** suggests minimal test names; stored as checklists in `.uatu/ai_tests/`.
* **execute**: sandboxed run per known ecosystem; logs stored in the run folder.
* **report**: PDF summarizing detections and findings with a local `file://` link.

## Configuration

* `UATU_HOME` — set the workspace root (default: `~/.uatu/workspace`).
* `UATU_USER` — logical namespace (default: `default`).
* `ANTHROPIC_API_KEY` — enable `--ai` in `testgen`.

## Security Notes

* **Sandbox**: The `execute` phase runs arbitrary project code. In production, wrap with a locked‑down container or ephemeral VM.
* **No Secrets**: Ensure the cloned repo does not leak credentials when tests run.

## Roadmap

* AST analyzers for Solidity/Anchor/Soroban/TS
* Coverage integration and PDF charts
* SARIF/JSON export for CI gates
* REST mode (same modules, HTTP endpoints)

```

---

## What you can expect after running it once

- A **fully populated** `.uatu/context` with repo tree and key configs copied (no AI).
- A **fingerprint** of detected ecosystems in `bootstrap.status.json`.
- An **inventory** of Solidity public/external function signatures.
- A **static analysis** summary (common high-signal patterns).
- **Optional** AI test checklists under `.uatu/ai_tests/`.
- A **sandboxed test run** with logs in `runs/{timestamp}/execute.log`.
- A **PDF audit report** at `runs/{timestamp}/report.pdf` + printed `file://` path you can share or upload.

If you want me to add containerized execution (Docker/Podman) or wire in Foundry/Hardhat coverage into the report, I’ll extend `execute` and `report` immediately with those steps.
```
You’re right, Sire—**manual cloning one-by-one is not it**. Let’s flip this into an **AI‑assisted, fully automated audit runner** that can:

* **Self‑queue audits** from a list, from a GitHub org, or via webhooks
* **Auto‑clone** each repo into the workspace
* **Run the full SOP pipeline end‑to‑end** (bootstrap → inventory → analysis → optional AI test ideas → sandbox execution → PDF)
* **Serve the latest report** as a downloadable file over HTTP
* **Run continuously** with a configurable concurrency pool

Below I’m adding **three new capabilities** on top of the Node/TS skeleton I gave you:

1. `uatu run` → one command to **clone + full pipeline + report**, no manual steps
2. `uatu batch` → **autopilot** multiple repos concurrently (file, CLI list, or GitHub org)
3. `uatu daemon` → a **long‑running service** with a tiny HTTP server and **GitHub webhooks**, a persistent **job queue**, and **downloadable report endpoints**

Everything stays SOP‑first; AI is optional and scoped to test ideas.

---

## What’s new (high level)

* **Job Queue (persistent)**: `~/.uatu/workspace/queue/jobs.json` with `pending → running → done/failed`
* **Autopilot Runner**: Accepts repo specs and drives the whole pipeline automatically
* **Daemon + HTTP**:

  * `POST /enqueue` — enqueue a repo for audit
  * `POST /github-webhook` — auto-enqueue on `push`/`pull_request`
  * `GET /report?project=…&branch=…` — streams latest `report.pdf`
  * `GET /jobs` — queue snapshot (debug)
* **End‑to‑end “one shot”**: `uatu run --repo … --project … --branch … --ai`

> **Security note**: The `execute` step runs repo tests. In production, wrap it in a container/VM with tight syscalls and network policies.

---

# Copy these **new files** and **edits** into the project

> (All code is well‑commented and keeps functions <50 lines where possible.)

### `src/services/runAll.ts`

```ts
/**
 * One-shot, end-to-end pipeline for a single repo:
 * - clone/refresh into workspace
 * - run SOPs (bootstrap → inventory → analysis → optional testgen → execute)
 * - generate PDF
 * Returns the report path and run timestamp.
 */
import path from "node:path";
import fs from "fs-extra";
import { cloneOrRefresh } from "./gitService.js";
import { resolveWorkspace } from "./workspaceService.js";
import { bootstrapSOP } from "../sops/bootstrap.js";
import { inventorySOP } from "../sops/inventory.js";
import { analysisSOP } from "../sops/analysis.js";
import { testgenSOP } from "../sops/testgen.js";
import { executeSOP } from "../sops/execute.js";
import { runPipeline } from "../core/orchestrator.js";
import { writePdfReport } from "./report/pdfReport.js";

export async function runAll(params: {
  repo: string;
  project: string;
  branch: string;
  ai?: boolean;
}) {
  const { project, branch, repo, ai } = params;
  const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(project, branch);

  // 1) Clone/refresh
  await cloneOrRefresh(repo, branchPath, branch);

  // 2) Pipeline
  const timestamp = Date.now().toString();
  const inputs = { projectPath: branchPath, contextPath, runsPath, timestamp, ai: !!ai };
  await runPipeline([bootstrapSOP, inventorySOP, analysisSOP, testgenSOP, executeSOP], inputs, sopPath);

  // 3) Report
  const analysis = await fs.readJson(path.join(runsPath, timestamp, "analysis.json")).catch(() => ({ findings: [] }));
  const bootstrap = await fs.readJson(path.join(branchPath, ".uatu", "sop", "bootstrap.status.json")).catch(() => null);
  const pdfPath = await writePdfReport(path.join(runsPath, timestamp), {
    project,
    branch,
    timestamp,
    ecosystemSummary: (bootstrap?.outputs?.fingerprint?.ecosystems ?? []) as string[],
    findings: analysis.findings ?? [],
  });

  return { pdfPath, timestamp };
}
```

### `src/services/jobQueue.ts`

```ts
/**
 * Minimal persistent job queue stored at ~/.uatu/workspace/queue/jobs.json.
 * Jobs are idempotent: if the target run already exists you can skip or re-run.
 */
import path from "node:path";
import fs from "fs-extra";
import { getUatuHome } from "../constants/paths.js";

export type JobStatus = "pending" | "running" | "done" | "failed";
export interface AuditJob {
  id: number;
  repo: string;
  project: string;
  branch: string;
  ai?: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: JobStatus;
  reportPath?: string;
  errorMessage?: string;
}

interface QueueFile { nextId: number; jobs: AuditJob[]; }

const QDIR = path.join(getUatuHome(), "queue");
const QPATH = path.join(QDIR, "jobs.json");

async function load(): Promise<QueueFile> {
  await fs.ensureDir(QDIR);
  if (!(await fs.pathExists(QPATH))) return { nextId: 1, jobs: [] };
  return fs.readJson(QPATH);
}
async function save(q: QueueFile) { await fs.writeJson(QPATH, q, { spaces: 2 }); }

export async function enqueue(job: Omit<AuditJob, "id" | "status" | "createdAt">) {
  const q = await load();
  const newJob: AuditJob = {
    id: q.nextId++,
    repo: job.repo,
    project: job.project,
    branch: job.branch,
    ai: job.ai,
    createdAt: new Date().toISOString(),
    status: "pending"
  };
  q.jobs.push(newJob);
  await save(q);
  return newJob;
}

export async function claimNext(): Promise<AuditJob | null> {
  const q = await load();
  const j = q.jobs.find(x => x.status === "pending");
  if (!j) return null;
  j.status = "running";
  j.startedAt = new Date().toISOString();
  await save(q);
  return j;
}

export async function complete(jobId: number, ok: boolean, reportPath?: string, errorMessage?: string) {
  const q = await load();
  const j = q.jobs.find(x => x.id === jobId);
  if (!j) return;
  j.status = ok ? "done" : "failed";
  j.finishedAt = new Date().toISOString();
  if (ok && reportPath) j.reportPath = reportPath;
  if (!ok && errorMessage) j.errorMessage = errorMessage;
  await save(q);
}

export async function snapshot() {
  return load();
}
```

### `src/daemon/daemon.ts`

```ts
/**
 * Long-running daemon:
 * - N workers pulling from persistent queue
 * - Tiny HTTP server for enqueue + GitHub webhook + report streaming
 *
 * Env:
 *  - UATU_CONCURRENCY (default 2)
 *  - UATU_PORT (default 7070)
 *  - GITHUB_WEBHOOK_SECRET (optional HMAC SHA-256 verification)
 */
import http from "node:http";
import crypto from "node:crypto";
import url from "node:url";
import path from "node:path";
import fs from "fs-extra";
import { enqueue, claimNext, complete, snapshot } from "../services/jobQueue.js";
import { runAll } from "../services/runAll.js";
import { resolveWorkspace } from "../services/workspaceService.js";
import { logger } from "../utils/logger.js";

const log = logger("daemon");

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function workerLoop(id: number) {
  while (true) {
    const job = await claimNext();
    if (!job) { await delay(1000); continue; }
    log.info(`Worker ${id} running job #${job.id} ${job.repo} [${job.branch}]`);
    try {
      const { pdfPath } = await runAll({ repo: job.repo, project: job.project, branch: job.branch, ai: job.ai });
      await complete(job.id, true, pdfPath);
      log.info(`Worker ${id} job #${job.id} done -> ${pdfPath}`);
    } catch (e: any) {
      await complete(job.id, false, undefined, e?.message || String(e));
      log.error(`Worker ${id} job #${job.id} failed: ${e?.message || e}`);
    }
  }
}

function verifyGitHubSignature(secret: string, payload: Buffer, sigHeader?: string) {
  if (!secret) return true; // no secret set; accept all (not for prod)
  if (!sigHeader) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const digest = "sha256=" + hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sigHeader));
}

async function handleWebhook(body: any) {
  // Minimal support for push + pull_request
  if (body?.repository?.clone_url && body?.ref) {
    const branch = String(body.ref).replace("refs/heads/", "");
    const repo = body.repository.clone_url;
    const project = body.repository.name;
    return enqueue({ repo, project, branch, ai: true });
  }
  if (body?.pull_request?.head?.repo?.clone_url && body?.pull_request?.head?.ref) {
    const repo = body.pull_request.head.repo.clone_url;
    const branch = body.pull_request.head.ref;
    const project = body.pull_request.head.repo.name;
    return enqueue({ repo, project, branch, ai: true });
  }
  throw new Error("Unsupported webhook payload");
}

async function streamLatestReport(res: http.ServerResponse, project: string, branch: string) {
  const { runsPath } = await resolveWorkspace(project, branch);
  const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
  const last = runs.at(-1);
  if (!last) { res.statusCode = 404; res.end("No runs found"); return; }
  const pdfPath = path.join(runsPath, last, "report.pdf");
  if (!(await fs.pathExists(pdfPath))) { res.statusCode = 404; res.end("Report not ready"); return; }
  res.setHeader("Content-Type", "application/pdf");
  fs.createReadStream(pdfPath).pipe(res);
}

export async function startDaemon() {
  const concurrency = parseInt(process.env.UATU_CONCURRENCY || "2", 10);
  const port = parseInt(process.env.UATU_PORT || "7070", 10);
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "";

  // Spin workers
  for (let i = 0; i < concurrency; i++) workerLoop(i + 1);

  // HTTP server
  const server = http.createServer(async (req, res) => {
    try {
      const parsed = url.parse(req.url || "", true);
      if (req.method === "GET" && parsed.pathname === "/health") {
        res.end("ok"); return;
      }
      if (req.method === "GET" && parsed.pathname === "/jobs") {
        const q = await snapshot(); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(q)); return;
      }
      if (req.method === "GET" && parsed.pathname === "/report") {
        const project = String(parsed.query.project || "");
        const branch = String(parsed.query.branch || "");
        if (!project || !branch) { res.statusCode = 400; res.end("project & branch required"); return; }
        await streamLatestReport(res, project, branch); return;
      }
      if (req.method === "POST" && parsed.pathname === "/enqueue") {
        const buf = await readBody(req);
        const body = JSON.parse(buf.toString("utf8"));
        if (!body.repo || !body.project || !body.branch) { res.statusCode = 400; res.end("repo, project, branch required"); return; }
        const job = await enqueue({ repo: body.repo, project: body.project, branch: body.branch, ai: !!body.ai });
        res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(job)); return;
      }
      if (req.method === "POST" && parsed.pathname === "/github-webhook") {
        const buf = await readBody(req);
        const sig = req.headers["x-hub-signature-256"] as string | undefined;
        if (!verifyGitHubSignature(secret, buf, sig)) { res.statusCode = 401; res.end("signature invalid"); return; }
        const evt = req.headers["x-github-event"];
        const body = JSON.parse(buf.toString("utf8"));
        // Only act on events we can parse
        if (evt === "push" || evt === "pull_request") {
          const job = await handleWebhook(body);
          res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(job)); return;
        }
        res.end("ignored"); return;
      }

      res.statusCode = 404; res.end("not found");
    } catch (e: any) {
      res.statusCode = 500; res.end(`error: ${e?.message || e}`);
    }
  });

  server.listen(port, () => log.info(`Daemon listening on :${port} (concurrency=${concurrency})`));
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
```

### Edits to `src/bin/uatu.ts` (add **run**, **batch**, **daemon**)

```ts
// ...existing imports...
import { runAll } from "../services/runAll.js";
import { enqueue } from "../services/jobQueue.js";
import { startDaemon } from "../daemon/daemon.js";

// (keep existing program/commands)

program
  .command("run")
  .description("Clone + full pipeline + report (one-shot)")
  .requiredOption("--repo <url>")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .option("--ai", "enable AI-assisted test ideas", false)
  .action(async (opts) => {
    const { pdfPath } = await runAll({ repo: opts.repo, project: opts.project, branch: opts.branch, ai: !!opts.ai });
    log.info(`Report ready: ${pdfPath}`);
    console.log(`Download: file://${pdfPath}`);
  });

program
  .command("batch")
  .description("Autopilot multiple repos concurrently (from --file or --repos list or --org)")
  .option("--file <path>", "Text file with repo specs, one per line (e.g., https://github.com/owner/repo.git#main)")
  .option("--repos <list>", "Comma-separated repo specs (same format as above)")
  .option("--org <githubOrg>", "Fetch all repos from a GitHub org (requires GH_TOKEN)")
  .option("--branch <defaultBranch>", "Default branch if not in spec", "main")
  .option("--ai", "enable AI-assisted test ideas", false)
  .action(async (opts) => {
    const specs: string[] = [];
    if (opts.file) {
      const s = await (await import("fs-extra")).readFile(opts.file, "utf8");
      s.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => specs.push(l));
    }
    if (opts.repos) specs.push(...String(opts.repos).split(",").map((s: string) => s.trim()).filter(Boolean));
    if (opts.org) {
      // Use GitHub API to list repos in org (public or with GH_TOKEN)
      const token = process.env.GH_TOKEN || "";
      const res = await fetch(`https://api.github.com/orgs/${opts.org}/repos?per_page=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const list: any[] = await res.json();
      list.forEach(r => specs.push(`${r.clone_url}#${r.default_branch || opts.branch}`));
    }

    if (!specs.length) throw new Error("No repo specs supplied");

    for (const spec of specs) {
      // Formats supported:
      //  - https://github.com/owner/repo.git#branch
      //  - owner/repo@branch  (converted to https)
      let repo = spec, branch = opts.branch, project = "";
      if (/^[\w-]+\/[\w.-]+@[\w.-]+$/.test(spec)) {
        const [sl, br] = spec.split("@");
        repo = `https://github.com/${sl}.git`;
        branch = br;
        project = sl.split("/")[1];
      } else if (spec.includes("#")) {
        const [u, br] = spec.split("#");
        repo = u; branch = br || branch;
        project = u.split("/").pop()?.replace(/\.git$/, "") || "proj";
      } else {
        // guess project
        project = spec.split("/").pop()?.replace(/\.git$/, "") || "proj";
      }
      await enqueue({ repo, project, branch, ai: !!opts.ai });
      log.info(`Enqueued: ${project} [${branch}]`);
    }
    log.info("All jobs enqueued. Start the daemon with: uatu daemon");
  });

program
  .command("daemon")
  .description("Start the long-running queue + webhook HTTP server")
  .action(async () => {
    await startDaemon();
  });

// ...existing program.parseAsync() stays...
```

### `package.json` additions (scripts unchanged if you prefer CLI)

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/bin/uatu.ts",
    "start": "node dist/bin/uatu.js daemon",
    "test": "vitest"
  }
}
```

---

## How you use it now (zero manual cloning)

**1) Run a single repo end‑to‑end, fully automated**

```bash
uatu run --repo https://github.com/owner/repo.git --project repo --branch main --ai
# => clones, builds context, inventories, analyzes, suggests AI test ideas, executes, emits PDF
```

**2) Batch mode (autopilot queue)**

```bash
# From a file (each line: https://github.com/owner/repo.git#branch)
uatu batch --file repos.txt --ai

# Or comma-separated
uatu batch --repos https://github.com/a/r1.git#main,https://github.com/b/r2.git#develop --ai

# Or a whole GitHub org (needs GH_TOKEN for private)
export GH_TOKEN=ghp_...
uatu batch --org your-org --ai
```

**3) Spin the daemon to process the queue + expose HTTP**

```bash
# Process queue with 4 parallel workers on port 9090
export UATU_CONCURRENCY=4
export UATU_PORT=9090
uatu daemon
```

**4) Enqueue via HTTP (CI/CD, scripts, bots)**

```bash
curl -X POST http://localhost:9090/enqueue \
  -H 'Content-Type: application/json' \
  -d '{"repo":"https://github.com/owner/repo.git","project":"repo","branch":"main","ai":true}'
```

**5) GitHub Webhook (push & PR)**

* Set your webhook to `http://<host>:9090/github-webhook`
* (Optional) set `GITHUB_WEBHOOK_SECRET`—the daemon validates `X-Hub-Signature-256`

**6) Download the latest report**

```bash
# Streams the newest PDF generated for that project/branch
curl -o report.pdf "http://localhost:9090/report?project=repo&branch=main"
```

---

## Why this satisfies “AI‑based automated audit”

* **Automation first**: One command (`run`) or continuous (`daemon`/`batch`) does everything—**no manual cloning**.
* **AI where it helps**: AI is employed in **test idea synthesis** (via Anthropic) after systematic inventory/analysis.
* **Multi‑repo at scale**: Queue + concurrency + webhook ingestion → “set it and forget it.”
* **Downloadable reports**: HTTP endpoint streams PDFs directly from your `runs/{timestamp}` folder.

---

# README (knowledge base) — **Autopilot & Daemon Addendum**

````md
## Autopilot & Daemon Mode

UatuAudit can run **automated, AI-assisted audits** across many repos without manual cloning.

### One-shot
```bash
uatu run --repo https://github.com/owner/repo.git --project repo --branch main --ai
````

### Batch

```bash
uatu batch --file repos.txt --ai
# repos.txt format:
# https://github.com/owner/repo.git#main
# https://github.com/another/repo.git#develop

# or:
uatu batch --repos https://github.com/a/r1.git#main,https://github.com/b/r2.git#dev --ai

# or an entire org:
export GH_TOKEN=ghp_...
uatu batch --org your-org --ai
```

### Daemon

```bash
export UATU_CONCURRENCY=4
export UATU_PORT=9090
export GITHUB_WEBHOOK_SECRET=...  # optional
uatu daemon
```

**HTTP endpoints**

* `POST /enqueue` `{ repo, project, branch, ai? }` → enqueues a job
* `POST /github-webhook` (push & pull\_request) → auto-enqueues
* `GET /jobs` → queue snapshot
* `GET /report?project=X&branch=Y` → streams latest `report.pdf`

### Queue Persistence

Queue state persists at `~/.uatu/workspace/queue/jobs.json`. Jobs transition:
`pending → running → done/failed` with timestamps and report path.

### Security

Wrap `execute` in containers/VMs for untrusted repos; restrict outbound net access; consider read-only FS mount.

```

---

## What you’ll get right away

- A **daemon** that accepts repos and continuously audits them (SOP‑first)  
- **No manual cloning**; everything starts with `uatu run`, `uatu batch`, or webhooks  
- **AI‑assisted test ideas** automatically generated when `--ai` is set (Anthropic)  
- **Downloadable PDFs** exposed via an HTTP endpoint

If you want, I can immediately add **Dockerized sandbox execution** (e.g., `--sandbox docker`) and **coverage ingestion** (`forge coverage`, `hardhat coverage`) into the report—both are natural extensions of the `execute` and `report` modules.
```
