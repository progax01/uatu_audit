import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";
import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import { 
  isDockerAvailable, 
  executeFoundryInDocker, 
  executeNodeInDocker,
  executeRustInDocker 
} from "../services/dockerSandbox.js";
import { loadConfig } from "../services/configService.js";
import { logger } from "../utils/logger.js";
import { recordExecuteTimeout } from "../services/metrics.js";

const execp = promisify(_exec);

async function runCmd(cmd: string, args: string[], cwd: string, timeoutMs: number = 15 * 60 * 1000): Promise<string> {
  const full = `${cmd} ${args.join(" ")}`;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      recordExecuteTimeout();
      reject(new Error(`Command timeout after ${timeoutMs}ms: ${full}`));
    }, timeoutMs);
  });
  
  const execPromise = execp(full, { cwd, env: process.env });
  
  try {
    const { stdout, stderr } = await Promise.race([execPromise, timeoutPromise]);
    return `${stdout || ""}${stderr || ""}`;
  } catch (error: any) {
    // If it's a timeout, log for debugging
    if (error.message?.includes('timeout')) {
      logger.warn('Command timed out', { cmd: full, cwd, timeoutMs });
    }
    throw error;
  }
}

async function safeJson(p: string) { try { return await fs.readJson(p); } catch { return null; } }

export const executeSOP: SOP = {
  name: "execute",
  version: "1.0.1",
  prerequisites: ["bootstrap", "inventory", "analysis", "testgen"],
  async validateInputs(i) { return !!i.projectPath; },
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString(); const errors: string[] = [];
    const log = logger.child({ sop: 'execute' });

    const stamp = (i.timestamp as string) ?? new Date().toISOString().replace(/[:.]/g, "-");
    const runPath = path.join(i.runsPath as string, stamp);
    // Create sandbox outside of project directory to avoid circular copy
    const tempSandbox = path.join(require('os').tmpdir(), `uatu-sandbox-${Date.now()}`);
    const sandboxPath = tempSandbox;
    await fs.ensureDir(sandboxPath);
    
    log.info('Execute SOP starting', { 
      runPath, 
      sandboxPath, 
      projectPath: i.projectPath,
      tempdir: require('os').tmpdir()
    });

    // Check configuration for sandbox mode
    const cfg = await loadConfig(i.projectPath as string);
    const useSandbox = cfg.sandbox === 'docker' || process.env.UATU_SANDBOX === 'docker';
    const dockerAvailable = useSandbox ? await isDockerAvailable() : false;
    
    if (useSandbox && !dockerAvailable) {
      log.warn('Docker sandbox requested but Docker not available, falling back to local execution');
    }
    
    const useDocker = useSandbox && dockerAvailable;
    log.info(`Execution mode: ${useDocker ? 'Docker sandbox' : 'local'}`);
    
    await step(onProgress, { phase: "execute", step: `sandbox-mode: ${useDocker ? 'docker' : 'local'}`, pct: 10 });

    // 1) sandbox copy
    await step(onProgress, { phase: "execute", step: "sandbox-materialize", pct: 25 });
    
    try {
      log.info('Starting fs.copy operation', {
        from: i.projectPath,
        to: sandboxPath
      });
      
      // Add timeout to prevent hanging
      await Promise.race([
        fs.copy(i.projectPath as string, sandboxPath, {
          filter: (src) => {
            const shouldInclude = !/\.git(\/|$)/.test(src) && 
                                !/node_modules(\/|$)/.test(src) && 
                                !/\/runs(\/|$)/.test(src) && 
                                !/\.uatu\/ai_tests\/.*\.plan\.txt$/.test(src);
            if (!shouldInclude) {
              log.debug('Filtering out', { src });
            }
            return shouldInclude;
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('fs.copy timeout after 30s')), 30000)
        )
      ]);
      
      log.info('fs.copy completed successfully');
    } catch (copyError) {
      log.error('fs.copy failed', { error: String(copyError) });
      errors.push(`Sandbox copy failed: ${copyError}`);
      throw copyError;
    }

    let stdout = "";
    let coveragePct: number | undefined;

    const hasFoundry = await fs.pathExists(path.join(sandboxPath, "foundry.toml"));
    const hasHardhat = await fs.pathExists(path.join(sandboxPath, "hardhat.config.ts")) || await fs.pathExists(path.join(sandboxPath, "hardhat.config.js"));
    const hasAnchor  = await fs.pathExists(path.join(sandboxPath, "Anchor.toml")) || await fs.pathExists(path.join(sandboxPath, "anchor.toml"));
    const hasSoroban = await fs.pathExists(path.join(sandboxPath, "soroban.toml")) || await fs.pathExists(path.join(sandboxPath, "soroban.config.toml"));
    const hasNode    = await fs.pathExists(path.join(sandboxPath, "package.json"));
    
    // Log detected toolchains for debugging
    log.info('Detected toolchains', { 
      hasFoundry, hasHardhat, hasAnchor, hasSoroban, hasNode,
      executionStrategy: hasFoundry ? 'foundry' : hasHardhat ? 'hardhat' : hasAnchor ? 'anchor' : hasSoroban ? 'soroban' : hasNode ? 'node' : 'none'
    });

    // 2) deps install (prefer Solidity toolchains over Node to avoid native build issues)
    if (hasHardhat && !hasFoundry) {
      await step(onProgress, { phase: "execute", step: "deps-install", pct: 40 });
      try { 
        stdout += await runCmd("npm", ["i", "--silent", "--no-progress", "--ignore-scripts"], sandboxPath); 
      } catch (e: any) {
        stdout += `\n[npm install failed, continuing anyway] ${e?.message||e}\n`;
        log.warn('npm install failed but continuing', { error: String(e) });
      }
    } else if (hasNode && !hasFoundry && !hasHardhat && !hasAnchor && !hasSoroban) {
      // Only run npm install for pure Node projects
      await step(onProgress, { phase: "execute", step: "deps-install", pct: 40 });
      try { 
        stdout += await runCmd("npm", ["i", "--silent", "--no-progress", "--ignore-scripts"], sandboxPath); 
      } catch (e: any) {
        stdout += `\n[npm install failed] ${e?.message||e}\n`;
        log.warn('npm install failed', { error: String(e) });
      }
    }

    // 3) compile
    await step(onProgress, { phase: "execute", step: "compile", pct: 65 });

        try {
          if (useDocker) {
            // Docker-based execution
            if (hasFoundry) {
              log.info('Running Foundry in Docker sandbox');
              const buildResult = await executeFoundryInDocker("build", sandboxPath);
              stdout += buildResult.stdout + buildResult.stderr;
              
              await step(onProgress, { phase: "execute", step: "docker-foundry-tests", pct: 90 });
              const testResult = await executeFoundryInDocker("test", sandboxPath);
              stdout += testResult.stdout + testResult.stderr;
              
              try {
                const covResult = await executeFoundryInDocker("coverage", sandboxPath);
                const m = covResult.stdout.match(/Total.*?(\d{1,3})\.\d+\s*%/);
                if (m) coveragePct = Math.max(0, Math.min(100, parseInt(m[1], 10)));
                await fs.writeFile(path.join(runPath, "coverage.txt"), covResult.stdout, "utf8");
              } catch (e: any) {
                log.warn('Coverage extraction failed in Docker', { error: e.message });
              }
            } else if (hasHardhat || hasNode) {
              log.info('Running Node.js in Docker sandbox');
              
              if (hasHardhat || hasNode) {
                const installResult = await executeNodeInDocker("install", sandboxPath);
                stdout += installResult.stdout + installResult.stderr;
              }
              
              if (hasHardhat) {
                // For Hardhat, we'd need a custom Docker image with Hardhat pre-installed
                // For now, fall back to local execution
                log.warn('Hardhat in Docker not fully implemented, falling back to local');
                stdout += await runCmd("npx", ["hardhat", "compile"], sandboxPath);
                await step(onProgress, { phase: "execute", step: "run-tests", pct: 90 });
                stdout += await runCmd("npx", ["hardhat", "test"], sandboxPath);
              } else {
                await step(onProgress, { phase: "execute", step: "docker-node-tests", pct: 90 });
                const testResult = await executeNodeInDocker("test", sandboxPath);
                stdout += testResult.stdout + testResult.stderr;
              }
            } else if (hasAnchor || hasSoroban) {
              log.info('Running Rust in Docker sandbox');
              await step(onProgress, { phase: "execute", step: "docker-rust-tests", pct: 90 });
              const testResult = await executeRustInDocker("test", sandboxPath);
              stdout += testResult.stdout + testResult.stderr;
            } else {
              stdout += "No known toolchain found for Docker execution; execution skipped.\n";
            }
          } else {
            // Local execution (original implementation)
            if (hasFoundry) {
              stdout += await runCmd("forge", ["build"], sandboxPath);
              await step(onProgress, { phase: "execute", step: "run-tests", pct: 90 });
              stdout += await runCmd("forge", ["test", "-vvv"], sandboxPath);
              try {
                const cov = await runCmd("forge", ["coverage"], sandboxPath);
                const m = cov.match(/Total.*?(\d{1,3})\.\d+\s*%/);
                if (m) coveragePct = Math.max(0, Math.min(100, parseInt(m[1], 10)));
                await fs.writeFile(path.join(runPath, "coverage.txt"), cov, "utf8");
              } catch {}
            } else if (hasHardhat) {
              stdout += await runCmd("npx", ["hardhat", "compile"], sandboxPath);
              await step(onProgress, { phase: "execute", step: "run-tests", pct: 90 });
              stdout += await runCmd("npx", ["hardhat", "test"], sandboxPath);
              try {
                // Check for missing deployment files first
                const deploymentChecks = [
                  path.join(sandboxPath, "deployments", "lineaSepolia-latest.json"),
                  path.join(sandboxPath, "deployments"),
                ];
                
                let missingDeployments = [];
                for (const deployPath of deploymentChecks) {
                  if (!(await fs.pathExists(deployPath))) {
                    missingDeployments.push(deployPath);
                  }
                }
                
                if (missingDeployments.length > 0) {
                  stdout += "\n[Uatu] Creating missing deployment files for testing...\n";
                  // Create minimal deployment structure
                  await fs.ensureDir(path.join(sandboxPath, "deployments"));
                  const mockDeployment = {
                    contracts: {},
                    timestamp: Date.now(),
                    note: "Mock deployment for testing purposes"
                  };
                  await fs.writeJson(path.join(sandboxPath, "deployments", "lineaSepolia-latest.json"), mockDeployment);
                }
                
            stdout += "\n[Uatu] trying hardhat coverage ...\n";
                // Use bash with extglob enabled and memory limits to handle the !(lineaSepolia) pattern
                const coverageResult = await runCmd("bash", [
                  "-lc", 
                  "shopt -s extglob; export NODE_OPTIONS='--max-old-space-size=4096'; npx hardhat coverage --testfiles \"test/!(lineaSepolia)/**/*.ts\""
                ], sandboxPath);
            stdout += coverageResult;
                
                // Try multiple coverage file locations
                const coveragePaths = [
                  path.join(sandboxPath, "coverage", "coverage-summary.json"),
                  path.join(sandboxPath, "coverage.json"),
                  path.join(sandboxPath, "coverage", "lcov-report", "index.html")
                ];
                
                for (const coveragePath of coveragePaths) {
                  try {
                    if (coveragePath.endsWith('.json')) {
                      const sum = await safeJson(coveragePath);
                      if (sum?.total?.lines?.pct != null) {
                        coveragePct = Math.round(sum.total.lines.pct);
                        log.info('Coverage extracted', { pct: coveragePct, source: coveragePath });
                        break;
                      }
                    }
                  } catch {}
                }
                
                // Copy coverage files if they exist
                const coverageDir = path.join(sandboxPath, "coverage");
                if (await fs.pathExists(coverageDir)) {
                  await fs.copy(coverageDir, path.join(runPath, "coverage")).catch(()=>{});
                }
              } catch (e: any) {
                stdout += `\n[Coverage failed] ${e?.message||e}\n`;
                log.warn('Coverage extraction failed', { error: String(e) });
              }
            } else if (hasAnchor) {
              await step(onProgress, { phase: "execute", step: "run-tests", pct: 90 });
              stdout += await runCmd("anchor", ["test"], sandboxPath);
            } else if (hasSoroban) {
              await step(onProgress, { phase: "execute", step: "run-tests", pct: 90 });
              stdout += await runCmd("soroban", ["test"], sandboxPath);
            } else if (hasNode && !hasFoundry && !hasHardhat) {
              // Pure Node project - handle carefully due to potential native dep issues
              log.warn('Pure Node.js project detected - native dependencies may fail');
              await step(onProgress, { phase: "execute", step: "install-deps", pct: 75 });
              
              try {
                // Use --ignore-scripts to avoid native build failures
                stdout += await runCmd("npm", ["install", "--ignore-scripts"], sandboxPath);
              } catch (e:any) {
                stdout += `\n[npm install failed] ${e?.message||e}\n`;
                log.warn('npm install failed', { error: String(e) });
              }
              
              await step(onProgress, { phase: "execute", step: "run-tests", pct: 90 });
              
              // Check if rimraf is available (common failure point)
              try {
                await runCmd("which", ["rimraf"], sandboxPath);
              } catch {
                stdout += "\n[Uatu] Installing rimraf globally to fix missing command...\n";
                try {
                  await runCmd("npm", ["install", "-g", "rimraf"], sandboxPath);
                } catch (rimrafError: any) {
                  stdout += `\n[rimraf install failed] ${rimrafError?.message||rimrafError}\n`;
                }
              }
              
              try { 
                // Add timeout to npm test to prevent hanging
                const testPromise = runCmd("npm", ["test", "--silent"], sandboxPath);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('npm test timeout after 60s')), 60000)
                );
                stdout += await Promise.race([testPromise, timeoutPromise]);
              } catch (e:any) { 
                stdout += `\n[npm test failed] ${e?.message||e}\n`; 
                errors.push(`Test execution failed: ${e?.message||e}`);
                log.warn('npm test failed or timed out', { error: String(e) });
              }
            } else {
              stdout += "No known toolchain found; execution skipped.\n";
            }
          }
        } catch (e:any) {
          errors.push(`Execution error: ${e?.message || String(e)}`);
        }

    const outputs: any = { runPath, sandbox: sandboxPath, stdout };
    if (typeof coveragePct === "number") outputs.coverage = coveragePct;
    const outFile = path.join(i.projectPath as string, "runs", (i.timestamp as string) ?? Date.now().toString(), "execute.json");
    await fs.ensureDir(path.dirname(outFile)); await fs.writeJson(outFile, outputs, { spaces: 2 });

    // Write execution log
    const logFile = path.join(runPath, "execute.log");
    await fs.writeFile(logFile, stdout, "utf8");

    // Clean up temporary sandbox
    try {
      await fs.remove(sandboxPath);
    } catch (cleanupError) {
      log.warn('Failed to cleanup sandbox directory', { sandboxPath, error: String(cleanupError) });
    }

    await step(onProgress, { phase: "execute", step: "aggregate", pct: 100 });

    return { ok: errors.length === 0, outputs, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
  },
  async verifyOutputs(r) { return !!(r.outputs && (r.outputs as any).testResults); }
};
