/**
 * Framework File Filter
 *
 * Framework-specific file filtering to avoid scanning irrelevant files.
 * For example, Solidity projects shouldn't scan TSX/frontend files.
 */

import path from 'path';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'framework-file-filter' });

export interface FrameworkFileConfig {
  includedExtensions: string[];      // Only scan these extensions (empty = all)
  excludedExtensions: string[];      // Never scan these extensions
  includedPaths: string[];           // Only scan these paths (empty = all)
  excludedPaths: string[];           // Never scan these paths
}

/**
 * Get file filter configuration for a specific framework
 */
export function getFileFilterConfig(framework: string): FrameworkFileConfig {
  const lowerFramework = framework.toLowerCase();

  const configs: Record<string, FrameworkFileConfig> = {
    'hardhat': {
      includedExtensions: ['.sol', '.js', '.ts'],
      excludedExtensions: ['.tsx', '.jsx', '.vue', '.svelte', '.html', '.css'],
      includedPaths: ['contracts/', 'test/', 'tests/', 'scripts/'],
      excludedPaths: ['frontend/', 'ui/', 'app/', 'pages/', 'components/', 'public/', 'dist/', 'build/']
    },

    'foundry': {
      includedExtensions: ['.sol'],
      excludedExtensions: ['.tsx', '.jsx', '.js', '.ts', '.vue', '.html', '.css'],
      includedPaths: ['src/', 'test/', 'script/'],
      excludedPaths: ['frontend/', 'ui/', 'lib/', 'out/', 'cache/', 'broadcast/']
    },

    'truffle': {
      includedExtensions: ['.sol', '.js'],
      excludedExtensions: ['.tsx', '.jsx', '.vue', '.html', '.css'],
      includedPaths: ['contracts/', 'test/', 'migrations/'],
      excludedPaths: ['frontend/', 'ui/', 'build/', 'node_modules/']
    },

    'anchor': {
      includedExtensions: ['.rs', '.toml'],
      excludedExtensions: ['.tsx', '.jsx', '.vue', '.html', '.css', '.sol'],
      includedPaths: ['programs/', 'tests/'],
      excludedPaths: ['app/', 'frontend/', 'target/', 'node_modules/']
    },

    'move': {
      includedExtensions: ['.move'],
      excludedExtensions: ['.tsx', '.jsx', '.vue', '.html', '.css', '.sol', '.rs'],
      includedPaths: ['sources/', 'scripts/'],
      excludedPaths: ['frontend/', 'ui/', 'build/', 'node_modules/']
    },

    'nodejs': {
      includedExtensions: ['.js', '.ts', '.json'],
      excludedExtensions: ['.sol', '.rs', '.move'],
      includedPaths: ['src/', 'lib/', 'test/', 'tests/'],
      excludedPaths: ['contracts/', 'programs/', 'dist/', 'build/', 'coverage/']
    },

    'cairo': {
      includedExtensions: ['.cairo'],
      excludedExtensions: ['.tsx', '.jsx', '.vue', '.html', '.css', '.sol'],
      includedPaths: ['contracts/', 'src/', 'tests/'],
      excludedPaths: ['frontend/', 'ui/', 'build/', 'node_modules/']
    },
  };

  // Return config for specific framework, or generic config
  return configs[lowerFramework] || {
    // Default: minimal filtering (scan most things)
    includedExtensions: [],
    excludedExtensions: ['.html', '.css', '.scss', '.sass', '.less', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'],
    includedPaths: [],
    excludedPaths: ['node_modules/', '.git/', 'dist/', 'build/', 'coverage/', 'out/', 'target/', 'cache/']
  };
}

/**
 * Determine if a file should be scanned based on framework
 */
export function shouldScanFile(
  filePath: string,
  framework: string
): boolean {
  const config = getFileFilterConfig(framework);

  // Always exclude common directories
  const alwaysExclude = [
    'node_modules/',
    '.git/',
    '.github/',
    '.vscode/',
    '.idea/',
    'dist/',
    'build/',
    'coverage/',
    '.next/',
    '.nuxt/',
    '__pycache__/',
    'venv/',
    'env/',
  ];

  if (alwaysExclude.some(dir => filePath.includes(dir))) {
    return false;
  }

  // Check extension filters
  const ext = path.extname(filePath).toLowerCase();

  // If excluded extensions specified, check them first
  if (config.excludedExtensions.length > 0 && config.excludedExtensions.includes(ext)) {
    return false;
  }

  // If included extensions specified, file must have one
  if (config.includedExtensions.length > 0 && !config.includedExtensions.includes(ext)) {
    return false;
  }

  // Check path filters (normalize to forward slashes)
  const normalizedPath = filePath.replace(/\\/g, '/');

  // If excluded paths specified, check them
  if (config.excludedPaths.some(p => normalizedPath.includes(p))) {
    return false;
  }

  // If included paths specified, file must be in one of them
  if (config.includedPaths.length > 0) {
    const isInIncludedPath = config.includedPaths.some(p => normalizedPath.includes(p));
    if (!isInIncludedPath) {
      return false;
    }
  }

  return true;
}

/**
 * Filter a list of files based on framework
 */
export function filterFilesByFramework(
  files: string[],
  framework: string
): {
  included: string[];
  excluded: string[];
  stats: {
    total: number;
    included: number;
    excluded: number;
    excludedByExtension: number;
    excludedByPath: number;
  };
} {
  const config = getFileFilterConfig(framework);
  const included: string[] = [];
  const excluded: string[] = [];

  let excludedByExtension = 0;
  let excludedByPath = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const normalizedPath = file.replace(/\\/g, '/');

    // Check extension exclusions
    if (config.excludedExtensions.includes(ext)) {
      excluded.push(file);
      excludedByExtension++;
      continue;
    }

    // Check path exclusions
    if (config.excludedPaths.some(p => normalizedPath.includes(p))) {
      excluded.push(file);
      excludedByPath++;
      continue;
    }

    // Check if should scan
    if (shouldScanFile(file, framework)) {
      included.push(file);
    } else {
      excluded.push(file);
    }
  }

  log.info('File filtering complete', {
    framework,
    total: files.length,
    included: included.length,
    excluded: excluded.length,
    excludedByExtension,
    excludedByPath,
  });

  return {
    included,
    excluded,
    stats: {
      total: files.length,
      included: included.length,
      excluded: excluded.length,
      excludedByExtension,
      excludedByPath,
    },
  };
}

/**
 * Get human-readable description of what will be scanned
 */
export function getFilterDescription(framework: string): string {
  const config = getFileFilterConfig(framework);

  const parts: string[] = [];

  if (config.includedExtensions.length > 0) {
    parts.push(`Files: ${config.includedExtensions.join(', ')}`);
  }

  if (config.includedPaths.length > 0) {
    parts.push(`Paths: ${config.includedPaths.join(', ')}`);
  }

  if (config.excludedPaths.length > 0) {
    parts.push(`Excluding: ${config.excludedPaths.join(', ')}`);
  }

  return parts.join(' | ');
}
