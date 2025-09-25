import fs from "fs-extra";
import path from "node:path";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'projectAnalyzer' });

export interface ProjectStructure {
  rootPath: string;
  totalFiles: number;
  totalDirs: number;
  ecosystems: string[];
  mainContracts: string[];
  testFiles: string[];
  configFiles: string[];
  deploymentFiles: string[];
  documentationFiles: string[];
  criticalPaths: string[];
  securityConcerns: string[];
  testCoverage: {
    hasTests: boolean;
    testFrameworks: string[];
    testTypes: string[];
    missingTestAreas: string[];
  };
  dependencies: {
    production: string[];
    development: string[];
    security: string[];
  };
  fileTree: DirectoryNode;
}

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  extension?: string;
  importance: 'critical' | 'important' | 'normal' | 'ignore';
  children?: DirectoryNode[];
  analysis?: {
    language: string;
    purpose: string;
    securityRelevant: boolean;
    testable: boolean;
  };
}

const CRITICAL_EXTENSIONS = ['.sol', '.rs', '.ts', '.js', '.json'];
const TEST_PATTERNS = [
  /test/i, /spec/i, /__tests__/i, /\.test\./i, /\.spec\./i
];
const CONFIG_PATTERNS = [
  'package.json', 'hardhat.config', 'foundry.toml', 'Cargo.toml', 
  'tsconfig.json', 'truffle-config', '.env'
];
const SECURITY_PATTERNS = [
  /owner/i, /admin/i, /auth/i, /permission/i, /role/i, /access/i,
  /withdraw/i, /deposit/i, /transfer/i, /mint/i, /burn/i, /pause/i
];

export async function analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
  log.info('Starting comprehensive project analysis', { projectPath });
  
  const structure: ProjectStructure = {
    rootPath: projectPath,
    totalFiles: 0,
    totalDirs: 0,
    ecosystems: [],
    mainContracts: [],
    testFiles: [],
    configFiles: [],
    deploymentFiles: [],
    documentationFiles: [],
    criticalPaths: [],
    securityConcerns: [],
    testCoverage: {
      hasTests: false,
      testFrameworks: [],
      testTypes: [],
      missingTestAreas: []
    },
    dependencies: {
      production: [],
      development: [],
      security: []
    },
    fileTree: await buildFileTree(projectPath)
  };

  await analyzeDirectory(projectPath, structure);
  await detectEcosystems(structure);
  await analyzeTestCoverage(structure);
  await analyzeDependencies(structure);
  await identifySecurityConcerns(structure);
  
  log.info('Project analysis complete', {
    totalFiles: structure.totalFiles,
    ecosystems: structure.ecosystems,
    hasTests: structure.testCoverage.hasTests
  });
  
  return structure;
}

async function buildFileTree(dirPath: string, maxDepth: number = 10): Promise<DirectoryNode> {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);
  
  const node: DirectoryNode = {
    name,
    type: stats.isDirectory() ? 'directory' : 'file',
    path: dirPath,
    importance: determineImportance(dirPath, name),
  };

  if (stats.isFile()) {
    node.size = stats.size;
    node.extension = path.extname(name);
    node.analysis = await analyzeFile(dirPath);
  } else if (stats.isDirectory() && maxDepth > 0) {
    try {
      const entries = await fs.readdir(dirPath);
      node.children = [];
      
      for (const entry of entries) {
        if (shouldSkipEntry(entry)) continue;
        
        const entryPath = path.join(dirPath, entry);
        try {
          const childNode = await buildFileTree(entryPath, maxDepth - 1);
          node.children.push(childNode);
        } catch (error) {
          // Skip inaccessible files/dirs
          log.debug('Skipping inaccessible entry', { entryPath, error: String(error) });
        }
      }
    } catch (error) {
      log.warn('Failed to read directory', { dirPath, error: String(error) });
    }
  }

  return node;
}

function determineImportance(filePath: string, fileName: string): 'critical' | 'important' | 'normal' | 'ignore' {
  const ext = path.extname(fileName);
  const lowerPath = filePath.toLowerCase();
  const lowerName = fileName.toLowerCase();

  // Critical files
  if (CRITICAL_EXTENSIONS.includes(ext)) {
    if (lowerPath.includes('contracts') || lowerPath.includes('src')) return 'critical';
    if (TEST_PATTERNS.some(p => p.test(lowerPath))) return 'important';
  }
  
  // Config files
  if (CONFIG_PATTERNS.some(p => lowerName.includes(p.toLowerCase()))) return 'important';
  
  // Documentation
  if (['.md', '.txt', '.rst'].includes(ext)) return 'normal';
  
  // Ignore patterns
  if (lowerPath.includes('node_modules') || 
      lowerPath.includes('.git') || 
      lowerPath.includes('coverage') ||
      lowerPath.includes('dist') ||
      lowerPath.includes('build')) return 'ignore';
  
  return 'normal';
}

async function analyzeFile(filePath: string): Promise<DirectoryNode['analysis']> {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);
  
  let language = 'unknown';
  let purpose = 'unknown';
  let securityRelevant = false;
  let testable = false;

  // Determine language
  switch (ext) {
    case '.sol': language = 'solidity'; testable = true; break;
    case '.rs': language = 'rust'; testable = true; break;
    case '.ts': language = 'typescript'; testable = true; break;
    case '.js': language = 'javascript'; testable = true; break;
    case '.json': language = 'json'; break;
    case '.md': language = 'markdown'; break;
    case '.toml': language = 'toml'; break;
  }

  // Determine purpose
  if (TEST_PATTERNS.some(p => p.test(filePath))) {
    purpose = 'test';
  } else if (fileName.includes('config')) {
    purpose = 'configuration';
  } else if (fileName.includes('deploy')) {
    purpose = 'deployment';
  } else if (ext === '.sol') {
    purpose = 'smart_contract';
    securityRelevant = true;
  } else if (ext === '.rs' && filePath.includes('lib.rs')) {
    purpose = 'library';
    securityRelevant = true;
  }

  // Check for security relevance
  if (testable) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      securityRelevant = SECURITY_PATTERNS.some(pattern => pattern.test(content));
    } catch {
      // Ignore read errors
    }
  }

  return { language, purpose, securityRelevant, testable };
}

function shouldSkipEntry(entry: string): boolean {
  const skipPatterns = [
    /^\./, // Hidden files
    /node_modules/, /\.git/, /coverage/, /dist/, /build/, /target/,
    /\.nyc_output/, /\.next/, /\.cache/
  ];
  
  return skipPatterns.some(pattern => pattern.test(entry));
}

async function analyzeDirectory(dirPath: string, structure: ProjectStructure) {
  const traverse = async (node: DirectoryNode) => {
    if (node.type === 'file') {
      structure.totalFiles++;
      
      const fileName = node.name.toLowerCase();
      const filePath = node.path.toLowerCase();
      
      // Categorize files
      if (TEST_PATTERNS.some(p => p.test(filePath))) {
        structure.testFiles.push(node.path);
      } else if (CONFIG_PATTERNS.some(p => fileName.includes(p.toLowerCase()))) {
        structure.configFiles.push(node.path);
      } else if (fileName.includes('deploy') || filePath.includes('deployment')) {
        structure.deploymentFiles.push(node.path);
      } else if (['.md', '.txt', '.rst'].includes(node.extension || '')) {
        structure.documentationFiles.push(node.path);
      } else if (node.analysis?.purpose === 'smart_contract') {
        structure.mainContracts.push(node.path);
      }
      
      if (node.importance === 'critical') {
        structure.criticalPaths.push(node.path);
      }
    } else {
      structure.totalDirs++;
      if (node.children) {
        for (const child of node.children) {
          await traverse(child);
        }
      }
    }
  };
  
  await traverse(structure.fileTree);
}

async function detectEcosystems(structure: ProjectStructure) {
  const ecosystems = new Set<string>();
  
  for (const configFile of structure.configFiles) {
    const fileName = path.basename(configFile).toLowerCase();
    
    if (fileName.includes('hardhat')) ecosystems.add('hardhat');
    if (fileName.includes('foundry') || fileName.includes('forge')) ecosystems.add('foundry');
    if (fileName.includes('truffle')) ecosystems.add('truffle');
    if (fileName.includes('anchor')) ecosystems.add('anchor');
    if (fileName.includes('cargo')) ecosystems.add('rust');
    if (fileName.includes('package.json')) ecosystems.add('node');
  }
  
  // Check for Solidity files
  if (structure.mainContracts.some(f => f.endsWith('.sol'))) {
    ecosystems.add('solidity');
  }
  
  structure.ecosystems = Array.from(ecosystems);
}

async function analyzeTestCoverage(structure: ProjectStructure) {
  structure.testCoverage.hasTests = structure.testFiles.length > 0;
  
  // Detect test frameworks
  const frameworks = new Set<string>();
  for (const testFile of structure.testFiles) {
    try {
      const content = await fs.readFile(testFile, 'utf8');
      if (content.includes('describe') || content.includes('it(')) frameworks.add('mocha/jest');
      if (content.includes('forge-std')) frameworks.add('foundry');
      if (content.includes('#[test]')) frameworks.add('rust-test');
      if (content.includes('anchor')) frameworks.add('anchor-test');
    } catch {
      // Ignore read errors
    }
  }
  
  structure.testCoverage.testFrameworks = Array.from(frameworks);
  
  // Identify missing test areas
  const missingAreas = [];
  if (structure.mainContracts.length > 0 && structure.testFiles.length === 0) {
    missingAreas.push('No tests found for smart contracts');
  }
  
  structure.testCoverage.missingTestAreas = missingAreas;
}

async function analyzeDependencies(structure: ProjectStructure) {
  for (const configFile of structure.configFiles) {
    if (path.basename(configFile) === 'package.json') {
      try {
        const pkg = await fs.readJson(configFile);
        structure.dependencies.production.push(...Object.keys(pkg.dependencies || {}));
        structure.dependencies.development.push(...Object.keys(pkg.devDependencies || {}));
        
        // Identify security-related packages
        const securityPackages = [
          '@openzeppelin/contracts', 'hardhat-contract-sizer', 'solhint',
          'slither-analyzer', 'mythril', 'echidna'
        ];
        structure.dependencies.security = structure.dependencies.production
          .concat(structure.dependencies.development)
          .filter(dep => securityPackages.some(sec => dep.includes(sec)));
      } catch {
        // Ignore JSON parse errors
      }
    }
  }
}

async function identifySecurityConcerns(structure: ProjectStructure) {
  const concerns = [];
  
  if (structure.mainContracts.length > 0 && structure.testFiles.length === 0) {
    concerns.push('No tests found for smart contracts');
  }
  
  if (!structure.dependencies.security.length) {
    concerns.push('No security analysis tools detected in dependencies');
  }
  
  // Check for common security patterns in contracts
  for (const contractFile of structure.mainContracts) {
    try {
      const content = await fs.readFile(contractFile, 'utf8');
      if (content.includes('selfdestruct')) {
        concerns.push(`Self-destruct found in ${path.basename(contractFile)}`);
      }
      if (content.includes('delegatecall')) {
        concerns.push(`Delegate call found in ${path.basename(contractFile)}`);
      }
      if (content.includes('tx.origin')) {
        concerns.push(`tx.origin usage found in ${path.basename(contractFile)}`);
      }
    } catch {
      // Ignore read errors
    }
  }
  
  structure.securityConcerns = concerns;
}

export async function generateProjectSummary(structure: ProjectStructure): Promise<string> {
  const summary = `
# Project Analysis Summary

## Overview
- **Total Files**: ${structure.totalFiles}
- **Total Directories**: ${structure.totalDirs}
- **Ecosystems Detected**: ${structure.ecosystems.join(', ') || 'None'}

## Smart Contracts
- **Main Contracts**: ${structure.mainContracts.length}
- **Critical Files**: ${structure.criticalPaths.length}

## Testing
- **Has Tests**: ${structure.testCoverage.hasTests ? 'Yes' : 'No'}
- **Test Files**: ${structure.testFiles.length}
- **Test Frameworks**: ${structure.testCoverage.testFrameworks.join(', ') || 'None'}

## Security Analysis
- **Security Concerns**: ${structure.securityConcerns.length}
${structure.securityConcerns.map(c => `  - ${c}`).join('\n')}

## Missing Test Areas
${structure.testCoverage.missingTestAreas.map(area => `- ${area}`).join('\n')}

## Recommended Actions
${generateRecommendations(structure).map(r => `- ${r}`).join('\n')}
`;

  return summary.trim();
}

function generateRecommendations(structure: ProjectStructure): string[] {
  const recommendations = [];
  
  if (!structure.testCoverage.hasTests) {
    recommendations.push('Implement comprehensive test suite');
  }
  
  if (structure.securityConcerns.length > 0) {
    recommendations.push('Address identified security concerns');
  }
  
  if (!structure.dependencies.security.length) {
    recommendations.push('Add security analysis tools (slither, mythril, etc.)');
  }
  
  if (structure.mainContracts.length > structure.testFiles.length) {
    recommendations.push('Increase test coverage for smart contracts');
  }
  
  return recommendations;
}
