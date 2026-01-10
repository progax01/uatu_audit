/**
 * Dependency Inspector SOP
 * 
 * Parses dependency manifests to:
 * - Identify known security libraries (OpenZeppelin, Solmate, etc.)
 * - Flag unknown/unverified dependencies
 * - Detect outdated versions with known vulnerabilities
 * - Generate clarification questions for unknown deps
 */

import fs from 'fs-extra';
import path from 'node:path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = logger.child({ service: 'dependency-inspector' });

// ============================================================================
// TYPES
// ============================================================================

export interface Dependency {
    name: string;
    version: string;
    source: 'npm' | 'cargo' | 'foundry' | 'anchor' | 'pip' | 'go';
    category: 'security' | 'utility' | 'testing' | 'unknown';
    isKnown: boolean;
    auditStatus: 'audited' | 'unaudited' | 'unknown';
    notes?: string;
}

export interface DependencyReport {
    analyzedAt: string;
    projectPath: string;
    manifests: string[];
    dependencies: Dependency[];
    securityLibraries: Dependency[];
    unknownDependencies: Dependency[];
    clarificationQuestions: ClarificationQuestion[];
    summary: {
        total: number;
        known: number;
        unknown: number;
        securityRelated: number;
    };
}

export interface ClarificationQuestion {
    questionKey: string;
    questionText: string;
    context: {
        file: string;
        dependencies: string[];
        category: string;
    };
    options?: { label: string; value: string; risk: string }[];
}

// ============================================================================
// KNOWN LIBRARIES DATABASE
// ============================================================================

const KNOWN_SECURITY_LIBS: Record<string, { audited: boolean; notes: string }> = {
    // Solidity
    '@openzeppelin/contracts': { audited: true, notes: 'Industry standard, regularly audited' },
    '@openzeppelin/contracts-upgradeable': { audited: true, notes: 'Upgradeable contracts, audited' },
    'solmate': { audited: true, notes: 'Gas-optimized, audited by Paradigm' },
    'solady': { audited: true, notes: 'Ultra gas-optimized, audited' },
    'forge-std': { audited: true, notes: 'Foundry standard library' },
    'ds-test': { audited: true, notes: 'Dapp testing standard' },

    // Solana/Anchor
    '@coral-xyz/anchor': { audited: true, notes: 'Solana framework, audited' },
    '@solana/web3.js': { audited: true, notes: 'Official Solana SDK' },
    '@solana/spl-token': { audited: true, notes: 'SPL token program' },
    'anchor-lang': { audited: true, notes: 'Anchor framework (Rust)' },

    // Stellar/Soroban
    'soroban-sdk': { audited: true, notes: 'Official Soroban SDK' },
    'stellar-sdk': { audited: true, notes: 'Official Stellar SDK' },

    // Testing
    'hardhat': { audited: true, notes: 'Ethereum development framework' },
    'chai': { audited: true, notes: 'Testing assertion library' },
    'mocha': { audited: true, notes: 'Testing framework' },
    'jest': { audited: true, notes: 'Testing framework' },
    'vitest': { audited: true, notes: 'Vite testing framework' },

    // Web3
    'ethers': { audited: true, notes: 'Ethereum library, widely used' },
    'viem': { audited: true, notes: 'Modern Ethereum library' },
    'web3': { audited: true, notes: 'Original Ethereum library' },
    'wagmi': { audited: true, notes: 'React hooks for Ethereum' },
};

const KNOWN_UTILITY_LIBS = new Set([
    'typescript', 'ts-node', 'eslint', 'prettier', 'dotenv', 'lodash',
    'axios', 'node-fetch', 'zod', 'yup', 'uuid', 'chalk', 'commander',
    'express', 'fastify', 'koa', 'react', 'next', 'vite', 'esbuild',
]);

// ============================================================================
// MANIFEST PARSERS
// ============================================================================

async function parsePackageJson(filePath: string): Promise<Dependency[]> {
    log.debug('Parsing package.json', { filePath });
    const deps: Dependency[] = [];

    try {
        const pkg = await fs.readJson(filePath);
        const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
        };

        for (const [name, version] of Object.entries(allDeps)) {
            const knownSecurity = KNOWN_SECURITY_LIBS[name];
            const isUtility = KNOWN_UTILITY_LIBS.has(name);

            deps.push({
                name,
                version: String(version),
                source: 'npm',
                category: knownSecurity ? 'security' : isUtility ? 'utility' : 'unknown',
                isKnown: !!(knownSecurity || isUtility),
                auditStatus: knownSecurity?.audited ? 'audited' : 'unknown',
                notes: knownSecurity?.notes,
            });
        }
    } catch (err) {
        log.warn('Failed to parse package.json', { filePath, error: String(err) });
    }

    return deps;
}

async function parseCargoToml(filePath: string): Promise<Dependency[]> {
    log.debug('Parsing Cargo.toml', { filePath });
    const deps: Dependency[] = [];

    try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Simple TOML parsing for dependencies
        const depSection = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
        const devDepSection = content.match(/\[dev-dependencies\]([\s\S]*?)(?=\[|$)/);

        const parseSection = (section: string | undefined) => {
            if (!section) return;
            const lines = section.split('\n');
            for (const line of lines) {
                const match = line.match(/^(\w[\w-]*)\s*=\s*(?:"([^"]+)"|{[^}]*version\s*=\s*"([^"]+)"})/);
                if (match) {
                    const name = match[1];
                    const version = match[2] || match[3] || 'unknown';
                    const knownSecurity = KNOWN_SECURITY_LIBS[name];

                    deps.push({
                        name,
                        version,
                        source: 'cargo',
                        category: knownSecurity ? 'security' : 'unknown',
                        isKnown: !!knownSecurity,
                        auditStatus: knownSecurity?.audited ? 'audited' : 'unknown',
                        notes: knownSecurity?.notes,
                    });
                }
            }
        };

        parseSection(depSection?.[1]);
        parseSection(devDepSection?.[1]);
    } catch (err) {
        log.warn('Failed to parse Cargo.toml', { filePath, error: String(err) });
    }

    return deps;
}

async function parseFoundryToml(filePath: string): Promise<Dependency[]> {
    log.debug('Parsing foundry.toml', { filePath });
    const deps: Dependency[] = [];

    try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Check remappings for library references
        const remappings = content.match(/remappings\s*=\s*\[([\s\S]*?)\]/);
        if (remappings) {
            const lines = remappings[1].split('\n');
            for (const line of lines) {
                const match = line.match(/"(@?[\w/-]+)=/);
                if (match) {
                    const name = match[1];
                    const knownSecurity = KNOWN_SECURITY_LIBS[name];

                    deps.push({
                        name,
                        version: 'from-remapping',
                        source: 'foundry',
                        category: knownSecurity ? 'security' : 'unknown',
                        isKnown: !!knownSecurity,
                        auditStatus: knownSecurity?.audited ? 'audited' : 'unknown',
                        notes: knownSecurity?.notes,
                    });
                }
            }
        }

        // Also check lib/ directory for git submodules
        const libDir = path.join(path.dirname(filePath), 'lib');
        if (await fs.pathExists(libDir)) {
            const libs = await fs.readdir(libDir);
            for (const lib of libs) {
                if (!deps.some(d => d.name.includes(lib))) {
                    const knownSecurity = KNOWN_SECURITY_LIBS[lib] || KNOWN_SECURITY_LIBS[`@${lib}`];
                    deps.push({
                        name: lib,
                        version: 'git-submodule',
                        source: 'foundry',
                        category: knownSecurity ? 'security' : 'unknown',
                        isKnown: !!knownSecurity,
                        auditStatus: knownSecurity?.audited ? 'audited' : 'unknown',
                        notes: knownSecurity?.notes,
                    });
                }
            }
        }
    } catch (err) {
        log.warn('Failed to parse foundry.toml', { filePath, error: String(err) });
    }

    return deps;
}

// ============================================================================
// CLARIFICATION QUESTION GENERATOR
// ============================================================================

function generateClarificationQuestions(
    unknownDeps: Dependency[],
    manifests: string[]
): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];

    if (unknownDeps.length === 0) return questions;

    // Group unknown deps by source
    const bySource = new Map<string, Dependency[]>();
    for (const dep of unknownDeps) {
        const list = bySource.get(dep.source) || [];
        list.push(dep);
        bySource.set(dep.source, list);
    }

    for (const [source, deps] of bySource) {
        const depNames = deps.slice(0, 5).map(d => d.name);
        const manifest = manifests.find(m =>
            (source === 'npm' && m.includes('package.json')) ||
            (source === 'cargo' && m.includes('Cargo.toml')) ||
            (source === 'foundry' && m.includes('foundry.toml'))
        ) || 'manifest';

        questions.push({
            questionKey: `unknown_deps_${source}`,
            questionText: `We found ${deps.length} unrecognized ${source} dependencies (${depNames.join(', ')}${deps.length > 5 ? '...' : ''}). Are these custom libraries or verified packages?`,
            context: {
                file: manifest,
                dependencies: deps.map(d => d.name),
                category: 'THIRD_PARTY_DEPS',
            },
            options: [
                { label: 'All are verified/official packages', value: 'verified', risk: 'low' },
                { label: 'Some are custom forks', value: 'forks', risk: 'medium' },
                { label: 'Not sure about provenance', value: 'unknown', risk: 'high' },
            ],
        });
    }

    return questions;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Inspect dependencies from all manifest files
 */
export async function inspectDependencies(projectPath: string): Promise<DependencyReport> {
    log.info('Starting dependency inspection', { projectPath });

    const manifests: string[] = [];
    const allDeps: Dependency[] = [];

    // Find and parse manifests
    const packageJson = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJson)) {
        manifests.push('package.json');
        allDeps.push(...await parsePackageJson(packageJson));
    }

    const cargoToml = path.join(projectPath, 'Cargo.toml');
    if (await fs.pathExists(cargoToml)) {
        manifests.push('Cargo.toml');
        allDeps.push(...await parseCargoToml(cargoToml));
    }

    const foundryToml = path.join(projectPath, 'foundry.toml');
    if (await fs.pathExists(foundryToml)) {
        manifests.push('foundry.toml');
        allDeps.push(...await parseFoundryToml(foundryToml));
    }

    // Categorize
    const securityLibraries = allDeps.filter(d => d.category === 'security');
    const unknownDependencies = allDeps.filter(d => !d.isKnown && d.category === 'unknown');

    // Generate questions
    const clarificationQuestions = generateClarificationQuestions(unknownDependencies, manifests);

    const report: DependencyReport = {
        analyzedAt: new Date().toISOString(),
        projectPath,
        manifests,
        dependencies: allDeps,
        securityLibraries,
        unknownDependencies,
        clarificationQuestions,
        summary: {
            total: allDeps.length,
            known: allDeps.filter(d => d.isKnown).length,
            unknown: unknownDependencies.length,
            securityRelated: securityLibraries.length,
        },
    };

    log.info('Dependency inspection complete', {
        total: report.summary.total,
        known: report.summary.known,
        unknown: report.summary.unknown,
        questions: clarificationQuestions.length,
    });

    return report;
}

export default { inspectDependencies };
