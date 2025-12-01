import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runCmdLogged(runPath: string, cmd: string, args: string[], opts: any = {}) {
  const log = path.join(runPath, "cli.log");
  await fs.ensureFile(log);
  const line = `$ ${[cmd, ...args].join(" ")}\n`;
  await fs.appendFile(log, line, "utf8");

  try {
    // Set working directory to runPath if not specified
    const execOptions = { cwd: runPath, ...opts };

    // Build command string with proper quoting for shell arguments
    let fullCommand: string;
    if (cmd === 'bash' && args[0] === '-c' && args.length === 2) {
      // Special handling for bash -c to properly quote the command
      fullCommand = `bash -c '${args[1].replace(/'/g, "'\\''")}'`;
    } else {
      // For other commands, join args with spaces
      fullCommand = `${cmd} ${args.join(" ")}`;
    }

    const { stdout, stderr } = await execAsync(fullCommand, execOptions);
    
    // Log both stdout and stderr separately for debugging
    if (stdout) {
      await fs.appendFile(log, `STDOUT:\n${stdout}\n`, "utf8");
    }
    if (stderr) {
      await fs.appendFile(log, `STDERR:\n${stderr}\n`, "utf8");
    }
    
    // Return combined output
    const output = `${stdout || ""}${stderr || ""}`;
    await fs.appendFile(log, "---\n", "utf8");
    return output;
  } catch (error: any) {
    // Capture stderr from failed commands
    const stderr = error.stderr || "";
    const stdout = error.stdout || "";
    
    const errorOutput = `Command failed with exit code ${error.code || 'unknown'}:\n`;
    const stderrOutput = stderr ? `STDERR: ${stderr}\n` : "";
    const stdoutOutput = stdout ? `STDOUT: ${stdout}\n` : "";
    const errorMsg = `Error: ${error.message}\n`;
    
    const fullOutput = errorOutput + stdoutOutput + stderrOutput + errorMsg;
    await fs.appendFile(log, fullOutput, "utf8");
    await fs.appendFile(log, "---\n", "utf8");
    
    // Create enhanced error with more context
    const enhancedError = new Error(`${error.message}${stderr ? ` | STDERR: ${stderr}` : ""}`);
    (enhancedError as any).stdout = stdout;
    (enhancedError as any).stderr = stderr;
    (enhancedError as any).code = error.code;
    
    throw enhancedError;
  }
}
