import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";
import { suggestTestsWithAnthropic } from "../services/ai/anthropicProvider.js";

export const testgenSOP: SOP = {
  name: "testgen",
  version: "1.1.0",
  prerequisites: ["bootstrap", "inventory", "analysis"],
  async validateInputs(i) { return !!i.projectPath; },
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString(); const errors: string[] = [];
    const ai_tests_path = path.join(i.projectPath as string, ".uatu", "ai_tests");
    await fs.ensureDir(ai_tests_path);

    await step(onProgress, { phase: "testgen", step: "coverage-gaps", pct: 25 });
    await step(onProgress, { phase: "testgen", step: "edge-cases", pct: 45 });
    await step(onProgress, { phase: "testgen", step: "access-boundaries", pct: 65 });

    const inv = await fs.readJson(path.join(i.projectPath as string, "runs", (i.timestamp as string) ?? "", "inventory.json")).catch(() => null as any);
    const plans: Array<{ file: string; content: string }> = [];

    if (inv?.solidity && Object.keys(inv.solidity).length) {
      const body = [
        "# Foundry/Hardhat Test Plan (checklist)",
        "- [ ] Reentrancy on external calls",
        "- [ ] Access control (onlyOwner / roles) on state-changing fns",
        "- [ ] Pausable/Upgradable guards",
        "- [ ] Boundary conditions for each public function signature:",
        ...Object.entries(inv.solidity).flatMap(([k, v]: any) => (v.functions || []).map((sig: string) => `  - [ ] ${k} :: ${sig}`))
      ].join("\n");
      plans.push({ file: "solidity.plan.md", content: body });
    }

    if (inv?.anchor?.files?.length) {
      const body = [
        "# Anchor Test Plan",
        "- [ ] Constraint validation for all accounts (seeds, has_one, owner)",
        "- [ ] Unauthorized signer cannot invoke state-changing ix",
        "- [ ] PDA seeds and bump checks; replay protection",
        "- [ ] Each public fn happy-path & failure-path:",
        ...Object.entries(inv.anchor.fns || {}).flatMap(([k, v]: any) => (v as string[]).map(sig => `  - [ ] ${k} :: ${sig}`))
      ].join("\n");
      plans.push({ file: "anchor.plan.md", content: body });
    }

    if (inv?.soroban?.files?.length) {
      const body = [
        "# Soroban Test Plan",
        "- [ ] require_auth on all state-modifying methods",
        "- [ ] Value bounds & overflow/underflow guards",
        "- [ ] Events emitted for critical state changes",
        "- [ ] Each public fn checklist:",
        ...Object.entries(inv.soroban.fns || {}).flatMap(([k, v]: any) => (v as string[]).map(sig => `  - [ ] ${k} :: ${sig}`))
      ].join("\n");
      plans.push({ file: "soroban.plan.md", content: body });
    }

    if (inv?.node?.present) {
      const body = [
        "# Node Test Plan",
        "- [ ] No eval/new Function/child_process unless isolated",
        "- [ ] Secrets never hardcoded; .env used with validation",
        "- [ ] Input schema validation & auth/ZK proofs where applicable",
        "- [ ] Exported functions/classes under test:",
        ...Object.entries(inv.node.exports || {}).flatMap(([k, v]: any) => (v as string[]).map(sig => `  - [ ] ${k} :: ${sig}`))
      ].join("\n");
      plans.push({ file: "node.plan.md", content: body });
    }

    for (const p of plans) await fs.writeFile(path.join(ai_tests_path, p.file), p.content, "utf8");

    await step(onProgress, { phase: "testgen", step: "integration-scenarios", pct: 80 });

    if ((i as any).ai) {
      const ctx = await fs.readFile(path.join(i.contextPath as string, "tree.txt")).catch(() => Buffer.from(""))
        .then(b => b.toString());
      const prompt = `Given this repository tree and inventory JSON, propose JSON {files:[{path,tests[]}]} with concise, high-signal tests.\n` +
        ctx.slice(0, 16000) + "\nINVENTORY:\n" + JSON.stringify(inv ?? {}, null, 2).slice(0, 16000);
      const ideas = await suggestTestsWithAnthropic(prompt).catch(e => { errors.push(String(e)); return { files: [] as any[] }; });
      for (const f of ideas.files) {
        const fn = (f.path || "generated").replace(/[^\w.-]/g, "_") + ".ai.plan.txt";
        const body = `# AI Suggestions for ${f.path}\n${(f.tests||[]).map((t: string) => `- [ ] ${t}`).join("\n")}\n`;
        await fs.writeFile(path.join(ai_tests_path, fn), body, "utf8");
      }
    }

    await step(onProgress, { phase: "testgen", step: "testgen-complete", pct: 100 });
    const outputs = { plans: plans.map(p => p.file) };
    return { ok: true, outputs, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
  },
  async verifyOutputs(r) { return !!(r.outputs && (r.outputs as any).coverageGaps); }
};
