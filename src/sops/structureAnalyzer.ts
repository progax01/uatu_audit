/**
 * Structure Analyzer SOP
 * 
 * Uses shell commands (find, grep) instead of FS traversal for efficiency.
 * Builds:
 * - File list
 * - Import graph (who imports whom)
 * - Entry point detection
 * - Export analysis
 * 
 * This data is stored in audit_jobs.metadata.structureSummary
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { shouldScanFile } from '../services/frameworkFileFilter.js';

const execAsync = promisify(exec);
const log = logger.child({ service: 'structure-analyzer' });

// ============================================================================
// TYPES
// ============================================================================

export interface FileEntry {
    path: string;
    relativePath: string;
    extension: string;
    size?: number;
    type: 'source' | 'test' | 'config' | 'docs' | 'other';
}

export interface ImportEdge {
    from: string;        // File that imports
    to: string;          // What is being imported
    importType: 'local' | 'external' | 'package';
    line: number;
}

export interface EntryPoint {
    file: string;
    type: 'main' | 'lib' | 'contract' | 'index' | 'config';
    ecosystem: string;
}

export interface StructureSummary {
    analyzedAt: string;
    projectPath: string;
    fileCount: number;
    files: FileEntry[];
    importGraph: ImportEdge[];
    entryPoints: EntryPoint[];
    exports: { file: string; exports: string[] }[];
    directories: string[];
    ecosystem: {
        primary: string | null;
        detected: string[];
        confidence: number;
    };
}

// ============================================================================
// SHELL COMMAND HELPERS
// ============================================================================

const EXCLUDED_DIRS = [
    'node_modules', '.git', 'target', 'dist', 'build', 'out',
    'artifacts', 'cache', '.next', '.nuxt', 'coverage', '__pycache__'
];

function buildExcludeArgs(): string {
    return EXCLUDED_DIRS.map(d => `-not -path "*/${d}/*"`).join(' ');
}

/**
 * Run shell command safely with timeout
 */
async function runShell(cmd: string, cwd: string, timeoutMs = 30000): Promise<string> {
    try {
        const { stdout } = await execAsync(cmd, {
            cwd,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            timeout: timeoutMs,
        });
        return stdout.trim();
    } catch (err: any) {
        if (err.killed) {
            log.warn('Shell command timed out', { cmd: cmd.substring(0, 100) });
        }
        return '';
    }
}

// ============================================================================
// FILE LIST (using find)
// ============================================================================

async function getFileList(projectPath: string): Promise<FileEntry[]> {
    log.info('Getting file list via shell');

    const excludes = buildExcludeArgs();
    const extensions = 'sol|rs|ts|tsx|js|jsx|json|toml|yaml|yml|md|py|go|move';

    // Use find to get all files with relevant extensions
    const cmd = `find . -type f \\( -regex ".*\\.\\(${extensions}\\)$" \\) ${excludes} 2>/dev/null`;
    const output = await runShell(cmd, projectPath);

    if (!output) {
        log.warn('No files found via shell, falling back to empty list');
        return [];
    }

    const files: FileEntry[] = output.split('\n').filter(Boolean).map(relativePath => {
        const ext = path.extname(relativePath);
        const lowerPath = relativePath.toLowerCase();

        let type: FileEntry['type'] = 'other';
        if (/\.(test|spec)\.|__tests__|\/test\/|\/tests\//.test(lowerPath)) {
            type = 'test';
        } else if (/config|\.toml|\.yaml|\.yml|package\.json/.test(lowerPath)) {
            type = 'config';
        } else if (/\.md$|readme|docs\//.test(lowerPath)) {
            type = 'docs';
        } else if (/\.(sol|rs|ts|js|py|go|move)$/.test(ext)) {
            type = 'source';
        }

        return {
            path: path.join(projectPath, relativePath),
            relativePath: relativePath.replace(/^\.\//, ''),
            extension: ext,
            type,
        };
    });

    log.info('File list complete', { count: files.length });
    return files;
}

// ============================================================================
// IMPORT GRAPH (using grep)
// ============================================================================

async function buildImportGraph(projectPath: string): Promise<ImportEdge[]> {
    log.info('Building import graph via grep');

    const excludes = buildExcludeArgs();
    const edges: ImportEdge[] = [];

    // Solidity imports: import "..." or import {...} from "..."
    const solCmd = `grep -rn "import\\s" --include="*.sol" ${excludes} . 2>/dev/null || true`;
    const solOutput = await runShell(solCmd, projectPath);

    for (const line of solOutput.split('\n').filter(Boolean)) {
        const match = line.match(/^\.?\/?(.*?):(\d+):.*import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/);
        if (match) {
            const [, file, lineNum, imported] = match;
            edges.push({
                from: file,
                to: imported,
                line: parseInt(lineNum, 10),
                importType: imported.startsWith('.') ? 'local'
                    : imported.startsWith('@') ? 'package'
                        : 'external',
            });
        }
    }

    // TypeScript/JavaScript imports
    const tsCmd = `grep -rn "^import\\|from\\s*['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${excludes} . 2>/dev/null || true`;
    const tsOutput = await runShell(tsCmd, projectPath);

    for (const line of tsOutput.split('\n').filter(Boolean)) {
        const match = line.match(/^\.?\/?(.*?):(\d+):.*(?:import\s+.*from\s+|require\s*\(\s*)["']([^"']+)["']/);
        if (match) {
            const [, file, lineNum, imported] = match;
            edges.push({
                from: file,
                to: imported,
                line: parseInt(lineNum, 10),
                importType: imported.startsWith('.') ? 'local'
                    : imported.startsWith('@') ? 'package'
                        : 'external',
            });
        }
    }

    // Rust use statements
    const rustCmd = `grep -rn "^use\\s\\|^mod\\s" --include="*.rs" ${excludes} . 2>/dev/null || true`;
    const rustOutput = await runShell(rustCmd, projectPath);

    for (const line of rustOutput.split('\n').filter(Boolean)) {
        const match = line.match(/^\.?\/?(.*?):(\d+):\s*(use|mod)\s+([a-zA-Z0-9_:]+)/);
        if (match) {
            const [, file, lineNum, keyword, imported] = match;
            edges.push({
                from: file,
                to: imported,
                line: parseInt(lineNum, 10),
                importType: imported.startsWith('crate::') || keyword === 'mod' ? 'local' : 'external',
            });
        }
    }

    log.info('Import graph complete', { edgeCount: edges.length });
    return edges;
}

// ============================================================================
// ENTRY POINT DETECTION
// ============================================================================

async function detectEntryPoints(projectPath: string, files: FileEntry[]): Promise<EntryPoint[]> {
    log.info('Detecting entry points');
    const entryPoints: EntryPoint[] = [];

    // Check for common entry point files
    const entryPatterns: { pattern: RegExp; type: EntryPoint['type']; ecosystem: string }[] = [
        // Solidity
        { pattern: /^src\/.*\.sol$/, type: 'contract', ecosystem: 'solidity' },
        { pattern: /^contracts\/.*\.sol$/, type: 'contract', ecosystem: 'solidity' },

        // Rust
        { pattern: /^src\/lib\.rs$/, type: 'lib', ecosystem: 'rust' },
        { pattern: /^src\/main\.rs$/, type: 'main', ecosystem: 'rust' },
        { pattern: /^programs\/.*\/src\/lib\.rs$/, type: 'lib', ecosystem: 'anchor' },

        // Node/TypeScript
        { pattern: /^src\/index\.(ts|js)$/, type: 'index', ecosystem: 'node' },
        { pattern: /^index\.(ts|js)$/, type: 'index', ecosystem: 'node' },

        // Config files as entry points for tooling
        { pattern: /^foundry\.toml$/, type: 'config', ecosystem: 'foundry' },
        { pattern: /^hardhat\.config\.(ts|js)$/, type: 'config', ecosystem: 'hardhat' },
        { pattern: /^Anchor\.toml$/, type: 'config', ecosystem: 'anchor' },
        { pattern: /^Cargo\.toml$/, type: 'config', ecosystem: 'rust' },
        { pattern: /^Move\.toml$/, type: 'config', ecosystem: 'move' },
    ];

    for (const file of files) {
        for (const ep of entryPatterns) {
            if (ep.pattern.test(file.relativePath)) {
                entryPoints.push({
                    file: file.relativePath,
                    type: ep.type,
                    ecosystem: ep.ecosystem,
                });
                break; // Only match first pattern per file
            }
        }
    }

    log.info('Entry points detected', { count: entryPoints.length });
    return entryPoints;
}

// ============================================================================
// EXPORT ANALYSIS (using grep)
// ============================================================================

async function analyzeExports(projectPath: string): Promise<{ file: string; exports: string[] }[]> {
    log.info('Analyzing exports via grep');
    const exports: { file: string; exports: string[] }[] = [];
    const excludes = buildExcludeArgs();

    // Solidity contract/interface/library declarations
    const solCmd = `grep -rn "^contract\\s\\|^interface\\s\\|^library\\s" --include="*.sol" ${excludes} . 2>/dev/null || true`;
    const solOutput = await runShell(solCmd, projectPath);

    const solExports = new Map<string, string[]>();
    for (const line of solOutput.split('\n').filter(Boolean)) {
        const match = line.match(/^\.?\/?(.*?):.*?(contract|interface|library)\s+(\w+)/);
        if (match) {
            const [, file, , name] = match;
            if (!solExports.has(file)) solExports.set(file, []);
            solExports.get(file)!.push(name);
        }
    }
    for (const [file, names] of solExports) {
        exports.push({ file, exports: names });
    }

    // TypeScript/JS exports
    const tsCmd = `grep -rn "^export\\s" --include="*.ts" --include="*.tsx" --include="*.js" ${excludes} . 2>/dev/null || true`;
    const tsOutput = await runShell(tsCmd, projectPath);

    const tsExports = new Map<string, string[]>();
    for (const line of tsOutput.split('\n').filter(Boolean)) {
        const match = line.match(/^\.?\/?(.*?):.*?export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/);
        if (match) {
            const [, file, name] = match;
            if (!tsExports.has(file)) tsExports.set(file, []);
            tsExports.get(file)!.push(name);
        }
    }
    for (const [file, names] of tsExports) {
        exports.push({ file, exports: names });
    }

    log.info('Export analysis complete', { fileCount: exports.length });
    return exports;
}

// ============================================================================
// ECOSYSTEM DETECTION (quick shell-based)
// ============================================================================

async function detectEcosystemQuick(projectPath: string): Promise<{
    primary: string | null;
    detected: string[];
    confidence: number;
}> {
    log.info('Quick ecosystem detection via shell');
    const detected: string[] = [];
    let confidence = 0;

    // Check for config files
    const configCheck = await runShell('ls -la 2>/dev/null | head -30', projectPath);

    if (/foundry\.toml/.test(configCheck)) {
        detected.push('foundry');
        confidence += 0.4;
    }
    if (/hardhat\.config/.test(configCheck)) {
        detected.push('hardhat');
        confidence += 0.4;
    }
    if (/Anchor\.toml/.test(configCheck)) {
        detected.push('anchor');
        confidence += 0.4;
    }
    if (/Cargo\.toml/.test(configCheck)) {
        detected.push('rust');
        confidence += 0.3;

        // Check for Soroban
        const cargoContent = await runShell('cat Cargo.toml 2>/dev/null | head -50', projectPath);
        if (/soroban-sdk/.test(cargoContent)) {
            detected.push('soroban');
            confidence += 0.2;
        }
        if (/anchor-lang/.test(cargoContent)) {
            detected.push('anchor');
            confidence += 0.2;
        }
    }
    if (/Move\.toml/.test(configCheck)) {
        detected.push('move');
        confidence += 0.4;
    }
    if (/package\.json/.test(configCheck)) {
        detected.push('node');
        confidence += 0.2;
    }

    // Primary is highest confidence
    const primary = detected.length > 0 ? detected[0] : null;

    log.info('Ecosystem detection complete', { primary, detected, confidence });
    return { primary, detected, confidence: Math.min(1, confidence) };
}

// ============================================================================
// DIRECTORY STRUCTURE
// ============================================================================

async function getDirectories(projectPath: string): Promise<string[]> {
    const excludes = buildExcludeArgs();
    const cmd = `find . -type d ${excludes} -maxdepth 3 2>/dev/null`;
    const output = await runShell(cmd, projectPath);

    return output.split('\n')
        .filter(Boolean)
        .map(d => d.replace(/^\.\//, ''))
        .filter(d => d !== '.');
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Analyze project structure using shell commands (faster, deterministic)
 * 
 * @param projectPath - Absolute path to the project root
 * @returns StructureSummary for storing in database
 */
export async function analyzeStructure(projectPath: string): Promise<StructureSummary> {
    log.info('Starting shell-based structure analysis', { projectPath });

    const [allFiles, importGraph, exports, directories, ecosystem] = await Promise.all([
        getFileList(projectPath),
        buildImportGraph(projectPath),
        analyzeExports(projectPath),
        getDirectories(projectPath),
        detectEcosystemQuick(projectPath),
    ]);

    // Apply framework-based file filtering
    const framework = ecosystem.primary || 'unknown';
    const filesBefore = allFiles.length;
    const files = allFiles.filter(file => shouldScanFile(file.relativePath, framework));
    const filesExcluded = filesBefore - files.length;

    log.info('Framework-based file filtering applied', {
        framework,
        before: filesBefore,
        after: files.length,
        excluded: filesExcluded
    });

    const entryPoints = await detectEntryPoints(projectPath, files);

    const summary: StructureSummary = {
        analyzedAt: new Date().toISOString(),
        projectPath,
        fileCount: files.length,
        files,
        importGraph,
        entryPoints,
        exports,
        directories,
        ecosystem,
    };

    log.info('Structure analysis complete', {
        fileCount: files.length,
        importEdges: importGraph.length,
        entryPoints: entryPoints.length,
        ecosystem: ecosystem.primary,
    });

    return summary;
}

export default { analyzeStructure };
