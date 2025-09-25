import os from 'node:os';
import path from 'node:path';

export function expandTilde(p: string): string {
  return p.startsWith("~")
    ? path.join(os.homedir(), p.slice(1))
    : p;
}

export function getUatuHome(): string {
  const override = process.env.UATU_HOME;
  if (override && override.trim().length > 0) {
    return path.resolve(expandTilde(override));
  }
  return path.resolve(path.join(os.homedir(), '.uatu'));
}

export function getUserId(): string {
  const envUser = process.env.USER || process.env.LOGNAME;
  if (envUser && envUser.trim()) return envUser.trim();
  try { return os.userInfo().username; } catch { return 'default'; }
}
