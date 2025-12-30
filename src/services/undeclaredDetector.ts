/**
 * Undeclared Component Detector
 *
 * Detects components referenced in code but not provided for audit.
 * These are tracked as UNDECLARED findings with zero score weight.
 *
 * Undeclared components include:
 * - Backend code referenced by frontend
 * - External APIs called by the code
 * - Contract addresses that aren't in scope
 * - Libraries that couldn't be resolved
 * - Frontend code when only contracts provided
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import type { UndeclaredComponent } from '../types/project.js';
import type { FindingLike } from './scoringService.js';

const log = logger.child({ service: 'undeclared-detector' });

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

const PATTERNS = {
  // API URLs (exclude localhost, common CDNs)
  apiUrls: /https?:\/\/(?!localhost|cdn\.|fonts\.|unpkg\.|cdnjs\.)[a-zA-Z0-9.-]+(?:\/api\/[a-zA-Z0-9/_-]*)?/g,

  // Backend API endpoints
  backendEndpoints: /['"`]\/api\/[a-zA-Z0-9/_-]+['"`]/g,

  // External contract addresses
  contractAddresses: /0x[a-fA-F0-9]{40}/g,

  // Import statements (unresolved)
  unresolvedImports: /import\s+.*from\s+['"]([^'"./][^'"]*)['"]/g,

  // Fetch/axios calls
  httpCalls: /(fetch|axios)\s*\(\s*['"`]([^'"`]+)['"`]/g,

  // Environment variable API URLs
  envApiUrls: /process\.env\.[A-Z_]*API[A-Z_]*|import\.meta\.env\.[A-Z_]*API[A-Z_]*/g,

  // WebSocket connections
  websockets: /new\s+WebSocket\s*\(\s*['"`]([^'"`]+)['"`]/g,

  // GraphQL endpoints
  graphqlEndpoints: /graphql|subgraph/gi,
};

// Known contract addresses to exclude (well-known protocols)
const KNOWN_ADDRESSES = new Set([
  // Common test addresses
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0xffffffffffffffffffffffffffffffffffffffff',
  // Add more known addresses as needed
]);

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

interface DetectionContext {
  sourcePath: string;
  files: string[];
  providedContracts: string[];
  providedApis: string[];
}

/**
 * Detect API/backend references in code
 */
async function detectApiReferences(
  ctx: DetectionContext
): Promise<UndeclaredComponent[]> {
  const components: UndeclaredComponent[] = [];
  const seenApis = new Set<string>();

  for (const file of ctx.files) {
    const filePath = path.join(ctx.sourcePath, file);
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    // Check for API URLs
    const urlMatches = content.match(PATTERNS.apiUrls) || [];
    for (const url of urlMatches) {
      // Extract host
      const host = new URL(url).hostname;

      if (!seenApis.has(host) && !ctx.providedApis.includes(host)) {
        seenApis.add(host);
        const lineNum = lines.findIndex(l => l.includes(url)) + 1;

        components.push({
          id: uuidv4(),
          name: host,
          componentType: 'external-api',
          referencedBy: [{
            file,
            line: lineNum > 0 ? lineNum : undefined,
            context: `API call to ${url}`,
          }],
          reason: 'External API endpoint referenced but backend code not provided',
        });
      }
    }

    // Check for /api/ endpoints
    const endpointMatches = content.match(PATTERNS.backendEndpoints) || [];
    for (const endpoint of endpointMatches) {
      const cleanEndpoint = endpoint.replace(/['"`]/g, '');

      if (!seenApis.has(cleanEndpoint)) {
        seenApis.add(cleanEndpoint);
        const lineNum = lines.findIndex(l => l.includes(cleanEndpoint)) + 1;

        components.push({
          id: uuidv4(),
          name: cleanEndpoint,
          componentType: 'backend',
          referencedBy: [{
            file,
            line: lineNum > 0 ? lineNum : undefined,
            context: `API endpoint ${cleanEndpoint}`,
          }],
          reason: 'Backend API endpoint referenced but backend code not provided',
        });
      }
    }

    // Check for env variable API URLs
    const envMatches = content.match(PATTERNS.envApiUrls) || [];
    for (const envVar of envMatches) {
      if (!seenApis.has(envVar)) {
        seenApis.add(envVar);
        const lineNum = lines.findIndex(l => l.includes(envVar)) + 1;

        components.push({
          id: uuidv4(),
          name: envVar,
          componentType: 'external-api',
          referencedBy: [{
            file,
            line: lineNum > 0 ? lineNum : undefined,
            context: `Environment variable referencing API`,
          }],
          reason: 'API URL from environment variable - actual endpoint unknown',
        });
      }
    }
  }

  return components;
}

/**
 * Detect contract address references
 */
async function detectContractReferences(
  ctx: DetectionContext
): Promise<UndeclaredComponent[]> {
  const components: UndeclaredComponent[] = [];
  const seenAddresses = new Set<string>();

  for (const file of ctx.files) {
    const filePath = path.join(ctx.sourcePath, file);
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    const addressMatches = content.match(PATTERNS.contractAddresses) || [];

    for (const address of addressMatches) {
      const lowerAddr = address.toLowerCase();

      // Skip known/test addresses and already-seen addresses
      if (KNOWN_ADDRESSES.has(lowerAddr) || seenAddresses.has(lowerAddr)) {
        continue;
      }

      // Skip if address is in provided contracts
      if (ctx.providedContracts.some(c => c.toLowerCase() === lowerAddr)) {
        continue;
      }

      seenAddresses.add(lowerAddr);
      const lineNum = lines.findIndex(l => l.includes(address)) + 1;

      components.push({
        id: uuidv4(),
        name: `Contract ${address.substring(0, 10)}...`,
        componentType: 'contract',
        referencedBy: [{
          file,
          line: lineNum > 0 ? lineNum : undefined,
          context: `External contract address: ${address}`,
        }],
        reason: 'External contract address referenced but source code not provided',
      });
    }
  }

  return components;
}

/**
 * Detect unresolved library references
 */
async function detectUnresolvedLibraries(
  ctx: DetectionContext
): Promise<UndeclaredComponent[]> {
  const components: UndeclaredComponent[] = [];
  const seenLibs = new Set<string>();

  // Check for node_modules and lib directories
  const hasNodeModules = await fs.access(path.join(ctx.sourcePath, 'node_modules'))
    .then(() => true).catch(() => false);
  const hasLib = await fs.access(path.join(ctx.sourcePath, 'lib'))
    .then(() => true).catch(() => false);

  for (const file of ctx.files) {
    const filePath = path.join(ctx.sourcePath, file);
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    // Find all imports
    const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Skip relative imports
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        continue;
      }

      // Extract library name
      const libName = importPath.startsWith('@')
        ? importPath.split('/').slice(0, 2).join('/')
        : importPath.split('/')[0];

      if (seenLibs.has(libName)) continue;

      // Check if library exists
      const libInNodeModules = hasNodeModules &&
        await fs.access(path.join(ctx.sourcePath, 'node_modules', libName))
          .then(() => true).catch(() => false);

      const libInLib = hasLib &&
        await fs.access(path.join(ctx.sourcePath, 'lib', libName.replace('@', '')))
          .then(() => true).catch(() => false);

      if (!libInNodeModules && !libInLib) {
        seenLibs.add(libName);
        const lineNum = lines.findIndex(l => l.includes(importPath)) + 1;

        components.push({
          id: uuidv4(),
          name: libName,
          componentType: 'library',
          referencedBy: [{
            file,
            line: lineNum > 0 ? lineNum : undefined,
            context: `Import: ${importPath}`,
          }],
          reason: 'Library imported but not found in node_modules or lib directory',
        });
      }
    }
  }

  return components;
}

/**
 * Detect frontend components when only backend/contracts provided
 */
async function detectMissingFrontend(
  ctx: DetectionContext
): Promise<UndeclaredComponent[]> {
  const components: UndeclaredComponent[] = [];

  // Check if we have frontend files
  const hasFrontend = ctx.files.some(f =>
    f.endsWith('.tsx') || f.endsWith('.jsx') ||
    f.includes('components/') || f.includes('pages/')
  );

  // If no frontend but contracts reference UI patterns, flag it
  if (!hasFrontend) {
    for (const file of ctx.files) {
      if (!file.endsWith('.sol')) continue;

      const filePath = path.join(ctx.sourcePath, file);
      let content: string;

      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch {
        continue;
      }

      // Look for patterns that suggest frontend interaction
      if (content.includes('event') && content.includes('emit')) {
        // Contract emits events - likely has a frontend listener
        components.push({
          id: uuidv4(),
          name: 'Frontend Application',
          componentType: 'frontend',
          referencedBy: [{
            file,
            context: 'Contract emits events that likely have frontend listeners',
          }],
          reason: 'Contract emits events but no frontend code provided for audit',
        });
        break; // Only add once
      }
    }
  }

  return components;
}

// ============================================================================
// MAIN DETECTION
// ============================================================================

/**
 * Run undeclared component detection on a source directory
 */
export async function detectUndeclaredComponents(
  sourcePath: string,
  options: {
    providedContracts?: string[];
    providedApis?: string[];
  } = {}
): Promise<UndeclaredComponent[]> {
  log.info('Starting undeclared component detection', { sourcePath });

  // Find all source files
  const files: string[] = [];

  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(sourcePath, fullPath);

        // Skip common non-source directories
        if (['node_modules', 'lib', 'out', 'artifacts', 'cache', '.git', 'dist', 'build'].includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (/\.(sol|ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(relativePath);
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  await walkDir(sourcePath);

  const ctx: DetectionContext = {
    sourcePath,
    files,
    providedContracts: options.providedContracts || [],
    providedApis: options.providedApis || [],
  };

  // Run all detectors in parallel
  const [apiComponents, contractComponents, libraryComponents, frontendComponents] = await Promise.all([
    detectApiReferences(ctx),
    detectContractReferences(ctx),
    detectUnresolvedLibraries(ctx),
    detectMissingFrontend(ctx),
  ]);

  const allComponents = [
    ...apiComponents,
    ...contractComponents,
    ...libraryComponents,
    ...frontendComponents,
  ];

  log.info('Undeclared detection complete', {
    total: allComponents.length,
    apis: apiComponents.length,
    contracts: contractComponents.length,
    libraries: libraryComponents.length,
    frontend: frontendComponents.length,
  });

  return allComponents;
}

/**
 * Convert undeclared components to findings
 */
export function undeclaredComponentsToFindings(
  components: UndeclaredComponent[]
): FindingLike[] {
  return components.map(c => ({
    id: c.id,
    component_id: c.id,
    severity: 'undeclared',
    title: `Undeclared ${c.componentType}: ${c.name}`,
    description: c.reason,
    isUndeclared: true,
    referencedBy: c.referencedBy.map(r => r.file),
    componentType: c.componentType,
  }));
}

/**
 * Save undeclared components to context directory
 */
export async function saveUndeclaredComponents(
  contextPath: string,
  components: UndeclaredComponent[]
): Promise<string> {
  const filePath = path.join(contextPath, 'undeclared_components.json');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    count: components.length,
    components,
  }, null, 2), 'utf-8');

  log.info('Saved undeclared components', { path: filePath, count: components.length });
  return filePath;
}

/**
 * Load undeclared components from context directory
 */
export async function loadUndeclaredComponents(
  contextPath: string
): Promise<UndeclaredComponent[]> {
  const filePath = path.join(contextPath, 'undeclared_components.json');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.components || [];
  } catch {
    return [];
  }
}

export default {
  detectUndeclaredComponents,
  undeclaredComponentsToFindings,
  saveUndeclaredComponents,
  loadUndeclaredComponents,
};
