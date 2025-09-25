import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";

type Finding = { id: string; severity: "low" | "medium" | "high"; title: string; file: string };

export const analysisSOP: SOP = {
  name: "analysis",
  version: "1.1.0",
  prerequisites: ["bootstrap", "inventory"],
  async validateInputs(i) { return !!i.projectPath; },
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString(); const errors: string[] = []; const findings: Finding[] = [];
    const cwd = i.projectPath as string;

    // Solidity patterns
    const sol = await fg(["**/*.sol", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd });
    let done = 0, total = Math.max(sol.length, 1);
    for (const f of sol) {
      const s = await fs.readFile(path.join(cwd, f), "utf8");
      if (/\btx\.origin\b/.test(s)) findings.push({ id: "SOL-TX-ORIGIN", severity: "high", title: "tx.origin used for auth", file: f });
      if (/\.(call|callcode|delegatecall)\s*\(/.test(s)) findings.push({ id: "SOL-LOWLEVEL-CALL", severity: "medium", title: "Low-level call detected", file: f });
      if (/\bfor\s*\(\s*;\s*;\s*\)/.test(s)) findings.push({ id: "SOL-UNBOUNDED-LOOP", severity: "low", title: "Potential unbounded loop", file: f });
      done++; if (done % 10 === 0) await step(onProgress, { phase: "analysis", step: `solidity: ${done}/${total}`, pct: 30 });
    }
    await step(onProgress, { phase: "analysis", step: "solidity: pass complete", pct: 35 });

    // Rust (Anchor/Soroban) heuristics
    const rust = await fg(["**/*.rs", "!**/target/**", "!**/.git/**", "!**/.uatu/**", "!**/node_modules/**"], { cwd });
    done = 0; total = Math.max(rust.length, 1);
    for (const f of rust) {
      const s = await fs.readFile(path.join(cwd, f), "utf8");
      if (/\bunsafe\s*\{/.test(s)) findings.push({ id: "RUST-UNSAFE", severity: "high", title: "unsafe{} block present", file: f });
      if (/\bunwrap\(\)/.test(s)) findings.push({ id: "RUST-UNWRAP", severity: "medium", title: "unwrap() may panic", file: f });
      if (/#\[\s*program\s*\]/.test(s) && !/\brequire!\s*\(/.test(s)) {
        findings.push({ id: "ANCHOR-MISSING-REQUIRE", severity: "low", title: "Anchor program file without require! checks (heuristic)", file: f });
      }
      if (/#\[\s*contractimpl\s*\]/.test(s) && /\btransfer|payment|approve|mint|burn\b/.test(s) && !/\brequire_auth\b/.test(s)) {
        findings.push({ id: "SOROBAN-NO-AUTH", severity: "medium", title: "Potential missing require_auth before state change (heuristic)", file: f });
      }
      done++; if (done % 10 === 0) await step(onProgress, { phase: "analysis", step: `rust: ${done}/${total}`, pct: 65 });
    }
    await step(onProgress, { phase: "analysis", step: "rust: pass complete", pct: 70 });

    // Node (backend/helpers)
    const node = await fg(["**/*.{js,ts}", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**", "!**/dist/**", "!**/build/**"], { cwd });
    done = 0; total = Math.max(node.length, 1);
    for (const f of node) {
      const s = await fs.readFile(path.join(cwd, f), "utf8");
      if (/\beval\s*\(/.test(s)) findings.push({ id: "NODE-EVAL", severity: "high", title: "eval() usage", file: f });
      if (/\bnew Function\s*\(/.test(s)) findings.push({ id: "NODE-NEW-FUNCTION", severity: "medium", title: "new Function()", file: f });
      if (/\b(child_process|spawn|exec|execSync)\b/.test(s)) findings.push({ id: "NODE-CHILD-PROC", severity: "medium", title: "child_process usage", file: f });
      if (/\b[A-Fa-f0-9]{64}\b/.test(s) && /private|pk|secret/i.test(s)) findings.push({ id: "NODE-HARDCODED-PK", severity: "high", title: "Possible hardcoded private key/secret", file: f });
      done++; if (done % 25 === 0) await step(onProgress, { phase: "analysis", step: `node: ${done}/${total}`, pct: 90 });
    }

    const outputs = { findings };
    const outFile = path.join(cwd, "runs", (i.timestamp as string) ?? Date.now().toString(), "analysis.json");
    await fs.ensureDir(path.dirname(outFile)); await fs.writeJson(outFile, outputs, { spaces: 2 });

    await step(onProgress, { phase: "analysis", step: "triage", pct: 100 });
    return { ok: true, outputs, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
  },
  async verifyOutputs(r) { return Array.isArray((r.outputs as any).findings); }
};
