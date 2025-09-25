import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { listAnchorPrograms, listSorobanContracts, extractRustPublicFns, extractAnchorAccounts } from "../services/detectors/rustDetector.js";
import { hasNodeProject, listNodeSources, extractNodeExports } from "../services/detectors/nodeDetector.js";
import { step, ProgressHook } from "../utils/stepHelper.js";

export const inventorySOP: SOP = {
  name: "inventory",
  version: "1.1.0",
  prerequisites: ["bootstrap"],
  async validateInputs(i) { return !!(i.projectPath && i.contextPath); },
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString(); const errors: string[] = [];

    const project = i.projectPath as string;

    // Solidity
    const solFiles = await fg(["**/*.sol", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**"], { cwd: project });
    await step(onProgress, { phase: "inventory", step: `solidity: contracts: ${solFiles.length}`, pct: 15 });
    const solidity: Record<string, { functions: string[] }> = {};
    for (const f of solFiles) {
      const abs = path.join(project, f);
      const txt = await fs.readFile(abs, "utf8");
      const sigs = Array.from(txt.matchAll(/\b(public|external)\s+(?:payable\s+)?(?:view\s+|pure\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g))
        .map(m => `${m[2]}(${m[3]||""}) ${m[1]}`);
      solidity[f] = { functions: sigs };
    }

    // Anchor (Rust)
    const anchor = await listAnchorPrograms(project);
    await step(onProgress, { phase: "inventory", step: `anchor: rust files: ${anchor.files.length}`, pct: 35 });
    const anchorFns: Record<string, string[]> = {};
    const anchorAccounts: Record<string, string[]> = {};
    for (const f of anchor.files) {
      const abs = path.join(project, f);
      anchorFns[f] = await extractRustPublicFns(abs);
      anchorAccounts[f] = await extractAnchorAccounts(abs);
    }

    // Soroban (Rust)
    const soroban = await listSorobanContracts(project);
    await step(onProgress, { phase: "inventory", step: `soroban: rust files: ${soroban.files.length}`, pct: 55 });
    const sorobanFns: Record<string, string[]> = {};
    for (const f of soroban.files) {
      const abs = path.join(project, f);
      sorobanFns[f] = await extractRustPublicFns(abs);
    }

    // Node
    const nodePresent = await hasNodeProject(project);
    const nodeSrc = nodePresent ? await listNodeSources(project) : [];
    await step(onProgress, { phase: "inventory", step: `node: sources: ${nodeSrc.length}`, pct: 75 });
    const nodeExports: Record<string, string[]> = {};
    for (const f of nodeSrc.slice(0, 1000)) {
      const abs = path.join(project, f);
      nodeExports[f] = await extractNodeExports(abs);
    }

    // Tests across ecosystems
    const testFiles = await fg([
      "**/*.{t,s}est.{js,ts,jsx,tsx}",
      "**/*.t.sol",
      "**/programs/**/tests/**/*.rs",
      "tests/**/*.rs",
      "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**", "!**/target/**"
    ], { cwd: project });
    await step(onProgress, { phase: "inventory", step: `tests: ${testFiles.length}`, pct: 95 });

    const outputs = {
      solidity,
      anchor: { files: anchor.files, fns: anchorFns, accounts: anchorAccounts },
      soroban: { files: soroban.files, fns: sorobanFns },
      node: { present: nodePresent, files: nodeSrc, exports: nodeExports },
      tests: testFiles
    };

    const outFile = path.join(project, "runs", (i.timestamp as string) ?? Date.now().toString(), "inventory.json");
    await fs.ensureDir(path.dirname(outFile)); await fs.writeJson(outFile, outputs, { spaces: 2 });

    await step(onProgress, { phase: "inventory", step: "inventory-complete", pct: 100 });
    return { ok: true, outputs, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
  },
  async verifyOutputs(r) { return !!(r.outputs); }
};
