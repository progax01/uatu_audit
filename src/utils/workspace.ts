import path from 'node:path';
import os from 'node:os';

export function getWorkspaceRoot(): string {
  const override = process.env.UATU_HOME;
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }
  return path.resolve(path.join(os.homedir(), '.uatu', 'workspace'));
}

export function resolveRunPath(runTimestamp: string): string {
  return path.join(getWorkspaceRoot(), 'runs', runTimestamp);
}

export function resolveQueuePath(): string {
  return path.join(getWorkspaceRoot(), 'queue');
}


