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
    const { stdout, stderr } = await execAsync(`${cmd} ${args.join(" ")}`, { ...opts });
    const output = `${stdout || ""}${stderr || ""}`;
    await fs.appendFile(log, output, "utf8");
    await fs.appendFile(log, "\n", "utf8");
    return output;
  } catch (error: any) {
    const output = `Error: ${error.message}\n`;
    await fs.appendFile(log, output, "utf8");
    await fs.appendFile(log, "\n", "utf8");
    throw error;
  }
}
