/**
 * Sanitize file paths to remove server filesystem paths and show only relative paths
 *
 * Examples:
 * - /home/azureuser/.uatu/workspace/repos/Owner/Repo/branches/main/source/contracts/Token.sol -> contracts/Token.sol
 * - /Users/user/.uatu/workspace/repos/Owner/Repo/branches/main/source/src/lib.rs -> src/lib.rs
 * - contracts/Token.sol -> contracts/Token.sol (already relative)
 */
export function sanitizeFilePath(filePath: string | undefined | null): string {
  if (!filePath) return '';

  // If already a relative path (no leading slash or drive letter), return as-is
  if (!filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:\\/)) {
    return filePath;
  }

  // Pattern 1: Remove workspace path pattern
  // Matches: /home/azureuser/.uatu/workspace/repos/*/branches/*/source/
  // Matches: /Users/*/.uatu/workspace/repos/*/branches/*/source/
  const workspacePattern = /^.*?\.uatu\/workspace\/repos\/[^/]+\/[^/]+\/branches\/[^/]+\/source\//;
  if (workspacePattern.test(filePath)) {
    return filePath.replace(workspacePattern, '');
  }

  // Pattern 2: Remove any path up to /contracts/, /src/, /lib/, /test/, /tests/
  const commonDirs = ['contracts', 'src', 'lib', 'test', 'tests', 'scripts', 'migrations'];
  for (const dir of commonDirs) {
    const idx = filePath.lastIndexOf(`/${dir}/`);
    if (idx !== -1) {
      return filePath.substring(idx + 1); // Keep the directory itself
    }
  }

  // Pattern 3: If path contains /source/, take everything after it
  const sourceIdx = filePath.lastIndexOf('/source/');
  if (sourceIdx !== -1) {
    return filePath.substring(sourceIdx + '/source/'.length);
  }

  // Pattern 4: If path contains /audits/, take everything after it
  const auditsIdx = filePath.lastIndexOf('/audits/');
  if (auditsIdx !== -1) {
    return filePath.substring(auditsIdx + '/audits/'.length);
  }

  // Fallback: Return just the filename if we can't determine a good relative path
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * Format a location object or string to a human-readable format
 * Sanitizes file paths and adds line/column numbers
 */
export function formatLocation(
  location: string | { file?: string; line?: number; column?: number } | undefined | null
): string {
  if (!location) return '';

  if (typeof location === 'string') {
    return sanitizeFilePath(location);
  }

  if (typeof location === 'object') {
    const file = sanitizeFilePath(location.file);
    const line = location.line ? `:L${location.line}` : '';
    const column = location.column ? `:C${location.column}` : '';
    return `${file}${line}${column}`;
  }

  return '';
}
