#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { runAll } from '../services/runAll.js';
import { validateTestStyles } from '../services/testStyles.js';
import { enqueue } from '../services/jobQueue.js';
import { startDaemon } from '../server/app.js';
import { checkAllToolsAvailability, generateToolStatusReport, generateClaudeToolContext } from '../tools/toolAvailability.js';

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
  .option("--test-styles <styles>", "test styles to generate (behavioral,stride)", "behavioral,stride")
  .action(async (o) => {
    try {
      const testStyles = validateTestStyles(o.testStyles.split(',').map((s: string) => s.trim()));
      const { htmlPath, score, grade } = await runAll({ 
        repo: o.repo, 
        project: o.project, 
        branch: o.branch, 
        ai: !!o.ai,
        testStyles 
      });
      console.log(`✅ Audit complete! HTML Report: file://${htmlPath}`);
      console.log(`📊 Score: ${score}/100 (${grade})`);
      console.log(`🧪 Test Styles: ${testStyles.join(', ')}`);
    } catch (error) {
      console.error('Run failed:', error);
      process.exit(1);
    }
  });

program
  .command("batch")
  .option("--repos <list>", "comma-separated urls like https://.../repo.git#branch")
  .option("--ai", "enable AI", false)
  .option("--test-styles <styles>", "test styles to generate (behavioral,stride)", "behavioral,stride")
  .action(async (o) => {
    try {
      const list = String(o.repos || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      for (const spec of list) {
        const [url, br = "main"] = spec.split("#");
        const project = url.split("/").pop()?.replace(/\.git$/, "") || "proj";
        const testStyles = validateTestStyles(o.testStyles.split(',').map((s: string) => s.trim()));
        await enqueue({ repo: url, project, branch: br, ai: !!o.ai, testStyles });
        console.log(`Enqueued ${project}#${br}`);
      }
      console.log("Start workers: uatu daemon");
    } catch (error) {
      console.error('Batch failed:', error);
      process.exit(1);
    }
  });

program
  .command("tools")
  .description("Check availability of security tools (native and Docker)")
  .option("--json", "output as JSON", false)
  .option("--claude", "output as Claude-friendly markdown context", false)
  .action(async (options) => {
    try {
      const availability = await checkAllToolsAvailability();

      if (options.json) {
        console.log(JSON.stringify(availability, null, 2));
      } else if (options.claude) {
        const context = generateClaudeToolContext(availability);
        console.log(context);
      } else {
        const report = await generateToolStatusReport();
        console.log(report);
      }
    } catch (error) {
      console.error('Tool check failed:', error);
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


