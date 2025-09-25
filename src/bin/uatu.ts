#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { runAll } from '../services/runAll.js';
import { enqueue } from '../services/jobQueue.js';
import { startDaemon } from '../daemon/daemon.js';

type PkgJson = { version?: string };
function getPackageJson(): PkgJson {
  const pkgPath = path.resolve(__dirname, '../../package.json');
  try {
    const content = readFileSync(pkgPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

const program = new Command();
const pkg = getPackageJson();

program
  .name('uatu')
  .description('Uatu audit automation tooling')
  .version(pkg.version ?? '0.0.0');

program
  .command("run")
  .requiredOption("--repo <url>")
  .requiredOption("--project <name>")
  .requiredOption("--branch <name>")
  .option("--ai", "enable AI-assisted ideas", false)
  .action(async (o) => {
    try {
      const { pdfPath } = await runAll({ 
        repo: o.repo, 
        project: o.project, 
        branch: o.branch, 
        ai: !!o.ai 
      });
      console.log(`Report: file://${pdfPath}`);
    } catch (error) {
      console.error('Run failed:', error);
      process.exit(1);
    }
  });

program
  .command("batch")
  .option("--repos <list>", "comma-separated urls like https://.../repo.git#branch")
  .option("--ai", "enable AI", false)
  .action(async (o) => {
    try {
      const list = String(o.repos || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      for (const spec of list) {
        const [url, br = "main"] = spec.split("#");
        const project = url.split("/").pop()?.replace(/\.git$/, "") || "proj";
        await enqueue({ repo: url, project, branch: br, ai: !!o.ai });
        console.log(`Enqueued ${project}#${br}`);
      }
      console.log("Start workers: uatu daemon");
    } catch (error) {
      console.error('Batch failed:', error);
      process.exit(1);
    }
  });

program
  .command("daemon")
  .action(async () => { 
    try {
      await startDaemon(); 
    } catch (error) {
      console.error('Daemon failed:', error);
      process.exit(1);
    }
  });

// Handle version flag for backward compatibility
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log(pkg.version ?? '0.0.0');
  process.exit(0);
}

program.parse();


