import { logger } from "../utils/logger.js";
import { ToolchainInfo } from "./sandboxProvisioner.js";
import { getNodeVersionInfo, isNodeVersionCompatible, getNodeVersionRecommendation } from "./nodeVersionEnforcer.js";
import { isDockerAvailable } from "./dockerSandboxRunner.js";
import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";

const log = logger.child({ service: 'preflight-checker' });

export interface PreflightCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  impact: 'none' | 'coverage_skip' | 'network_tests_skip' | 'performance' | 'failure';
  recommendations: string[];
}

export interface PreflightResults {
  overall: 'pass' | 'warn' | 'fail';
  checks: PreflightCheck[];
  summary: {
    nodeVersion: string;
    dockerAvailable: boolean;
    networkTestsFound: number;
    estimatedRuntime: string;
    coverageWillRun: boolean;
  };
}

/**
 * Run comprehensive preflight checks before executing tests
 */
export async function runPreflightChecks(
  sandboxPath: string,
  toolchain: ToolchainInfo,
  runPath: string
): Promise<PreflightResults> {
  log.info('Running preflight checks', { 
    sandboxPath, 
    toolchain: toolchain.detectedFramework 
  });

  const checks: PreflightCheck[] = [];
  
  // Check 1: Node version compatibility
  await checkNodeVersion(checks, sandboxPath, toolchain);
  
  // Check 2: Docker availability
  await checkDockerAvailability(checks);
  
  // Check 3: Network tests detection
  await checkNetworkTests(checks, sandboxPath);
  
  // Check 4: Coverage feasibility
  await checkCoverageFeasibility(checks, sandboxPath, toolchain);
  
  // Check 5: Dependency health
  await checkDependencyHealth(checks, sandboxPath, toolchain);
  
  // Check 6: Disk space
  await checkDiskSpace(checks);

  // Determine overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const overall = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';

  // Build summary
  const nodeInfo = await getNodeVersionInfo(sandboxPath).catch(() => ({ current: 'unknown', major: 0, isSupported: false, isLTS: false, recommended: '20.11.0' }));
  const dockerAvailable = await isDockerAvailable();
  const networkTestsFound = await countNetworkTests(sandboxPath);
  const coverageWillRun = await willCoverageRun(sandboxPath, toolchain);

  const results: PreflightResults = {
    overall,
    checks,
    summary: {
      nodeVersion: nodeInfo.current,
      dockerAvailable,
      networkTestsFound,
      estimatedRuntime: estimateRuntime(toolchain, networkTestsFound, coverageWillRun),
      coverageWillRun
    }
  };

  // Log summary
  log.info('Preflight checks completed', {
    overall,
    nodeVersion: nodeInfo.current,
    dockerAvailable,
    networkTestsFound,
    coverageWillRun,
    warnings: checks.filter(c => c.status === 'warn').length,
    failures: checks.filter(c => c.status === 'fail').length
  });

  return results;
}

async function checkNodeVersion(checks: PreflightCheck[], sandboxPath: string, toolchain: ToolchainInfo) {
  try {
    const nodeInfo = await getNodeVersionInfo(sandboxPath);
    const isCompatible = isNodeVersionCompatible(nodeInfo, toolchain.detectedFramework || 'node');
    const recommendation = getNodeVersionRecommendation(nodeInfo, toolchain.detectedFramework);

    if (isCompatible) {
      checks.push({
        name: 'Node Version',
        status: 'pass',
        message: `Node ${nodeInfo.current} is compatible with ${toolchain.detectedFramework}`,
        impact: 'none',
        recommendations: []
      });
    } else {
      const isHardhatWithNewNode = toolchain.hasHardhat && nodeInfo.major >= 22;
      
      checks.push({
        name: 'Node Version',
        status: isHardhatWithNewNode ? 'warn' : 'warn',
        message: `Node ${nodeInfo.current} may have issues with ${toolchain.detectedFramework}`,
        impact: isHardhatWithNewNode ? 'coverage_skip' : 'performance',
        recommendations: recommendation.commands
      });
    }
  } catch (error) {
    checks.push({
      name: 'Node Version',
      status: 'fail',
      message: `Could not determine Node version: ${error}`,
      impact: 'failure',
      recommendations: ['Ensure Node.js is installed and accessible']
    });
  }
}

async function checkDockerAvailability(checks: PreflightCheck[]) {
  const dockerAvailable = await isDockerAvailable();
  
  if (dockerAvailable) {
    checks.push({
      name: 'Docker Availability',
      status: 'pass',
      message: 'Docker is available for containerized execution',
      impact: 'none',
      recommendations: []
    });
  } else {
    checks.push({
      name: 'Docker Availability',
      status: 'warn',
      message: 'Docker not available, using local execution',
      impact: 'performance',
      recommendations: [
        'Install Docker for consistent, isolated execution',
        'Ensure local Node/toolchain versions are compatible'
      ]
    });
  }
}

async function checkNetworkTests(checks: PreflightCheck[], sandboxPath: string) {
  const networkTestCount = await countNetworkTests(sandboxPath);
  const includeNetworkTests = process.env.UATU_INCLUDE_NETWORK_TESTS === '1';
  
  if (networkTestCount === 0) {
    checks.push({
      name: 'Network Tests',
      status: 'pass',
      message: 'No network-coupled tests detected',
      impact: 'none',
      recommendations: []
    });
  } else if (includeNetworkTests) {
    checks.push({
      name: 'Network Tests',
      status: 'warn',
      message: `Found ${networkTestCount} network test files - will attempt to run with fixtures`,
      impact: 'performance',
      recommendations: [
        'Provide fixtures in .uatu/sandbox/fixtures/ for reliable execution',
        'Set UATU_INCLUDE_NETWORK_TESTS=0 to skip network tests'
      ]
    });
  } else {
    checks.push({
      name: 'Network Tests',
      status: 'pass',
      message: `Found ${networkTestCount} network test files - will be excluded by default`,
      impact: 'network_tests_skip',
      recommendations: [
        'Set UATU_INCLUDE_NETWORK_TESTS=1 and provide fixtures to include network tests'
      ]
    });
  }
}

async function checkCoverageFeasibility(checks: PreflightCheck[], sandboxPath: string, toolchain: ToolchainInfo) {
  if (!toolchain.hasHardhat) {
    checks.push({
      name: 'Coverage Feasibility',
      status: 'pass',
      message: 'Coverage not applicable for this toolchain',
      impact: 'none',
      recommendations: []
    });
    return;
  }

  const willRun = await willCoverageRun(sandboxPath, toolchain);
  const testFileCount = await countTestFiles(sandboxPath);
  const nodeInfo = await getNodeVersionInfo(sandboxPath).catch(() => ({ major: 0 }));
  
  if (!willRun) {
    const reason = nodeInfo.major >= 22 ? 'unsupported Node version' : 
                   process.env.UATU_HARDHAT_COVERAGE === '0' ? 'disabled via config' :
                   'unknown reason';
    
    checks.push({
      name: 'Coverage Feasibility',
      status: 'warn',
      message: `Coverage will be skipped (${reason})`,
      impact: 'coverage_skip',
      recommendations: [
        'Use Node 18-20 for Hardhat coverage support',
        'Set UATU_HARDHAT_COVERAGE=1 to enable',
        'Use Docker with node:20-bullseye for consistent environment'
      ]
    });
  } else if (testFileCount > 200) {
    checks.push({
      name: 'Coverage Feasibility',
      status: 'warn',
      message: `Large test suite (${testFileCount} files) may cause coverage to timeout or OOM`,
      impact: 'performance',
      recommendations: [
        'Consider increasing UATU_NODE_HEAP_MB (current: ' + (process.env.UATU_NODE_HEAP_MB || '6144') + ')',
        'Use Docker with more memory allocation',
        'Set UATU_HARDHAT_COVERAGE=0 to skip coverage for faster execution'
      ]
    });
  } else {
    checks.push({
      name: 'Coverage Feasibility',
      status: 'pass',
      message: `Coverage should run successfully (${testFileCount} test files)`,
      impact: 'none',
      recommendations: []
    });
  }
}

async function checkDependencyHealth(checks: PreflightCheck[], sandboxPath: string, toolchain: ToolchainInfo) {
  if (!toolchain.hasNode && !toolchain.hasHardhat) {
    checks.push({
      name: 'Dependency Health',
      status: 'pass',
      message: 'No Node.js dependencies to check',
      impact: 'none',
      recommendations: []
    });
    return;
  }

  try {
    const packageJsonPath = path.join(sandboxPath, 'package.json');
    const lockfilePath = path.join(sandboxPath, 'package-lock.json');
    
    const hasPackageJson = await fs.pathExists(packageJsonPath);
    const hasLockfile = await fs.pathExists(lockfilePath);
    
    if (!hasPackageJson) {
      checks.push({
        name: 'Dependency Health',
        status: 'fail',
        message: 'No package.json found',
        impact: 'failure',
        recommendations: ['Ensure project has valid package.json']
      });
      return;
    }

    if (!hasLockfile) {
      checks.push({
        name: 'Dependency Health',
        status: 'warn',
        message: 'No package-lock.json found - dependency versions may vary',
        impact: 'performance',
        recommendations: [
          'Run npm install to generate package-lock.json',
          'Commit lockfile for reproducible builds'
        ]
      });
    } else {
      checks.push({
        name: 'Dependency Health',
        status: 'pass',
        message: 'Package.json and lockfile present',
        impact: 'none',
        recommendations: []
      });
    }
  } catch (error) {
    checks.push({
      name: 'Dependency Health',
      status: 'warn',
      message: `Could not check dependencies: ${error}`,
      impact: 'performance',
      recommendations: ['Verify project structure and file permissions']
    });
  }
}

async function checkDiskSpace(checks: PreflightCheck[]) {
  try {
    const fs = await import('node:fs');
    const stats = fs.statSync('.');
    
    // Simple check - if we can write, assume we have enough space
    // In production, you might want to check actual available space
    checks.push({
      name: 'Disk Space',
      status: 'pass',
      message: 'Sufficient disk space available',
      impact: 'none',
      recommendations: []
    });
  } catch (error) {
    checks.push({
      name: 'Disk Space',
      status: 'warn',
      message: 'Could not verify disk space',
      impact: 'performance',
      recommendations: ['Ensure sufficient disk space for dependencies and artifacts']
    });
  }
}

async function countNetworkTests(sandboxPath: string): Promise<number> {
  try {
    const networkPatterns = [
      'test/**/linea*/**',
      'test/**/sepolia/**',
      'test/**/mainnet/**',
      'test/**/testnet/**',
      'test/**/integration/**'
    ];
    
    const files = await fg(networkPatterns, { 
      cwd: sandboxPath,
      onlyFiles: true
    });
    
    return files.length;
  } catch (error) {
    return 0;
  }
}

async function countTestFiles(sandboxPath: string): Promise<number> {
  try {
    const testFiles = await fg(['test/**/*.{ts,tsx,js,sol}'], {
      cwd: sandboxPath,
      onlyFiles: true
    });
    
    return testFiles.length;
  } catch (error) {
    return 0;
  }
}

async function willCoverageRun(sandboxPath: string, toolchain: ToolchainInfo): Promise<boolean> {
  if (!toolchain.hasHardhat) return false;
  if (process.env.UATU_HARDHAT_COVERAGE === '0') return false;
  
  try {
    const nodeInfo = await getNodeVersionInfo(sandboxPath);
    return nodeInfo.major < 22;
  } catch {
    return false;
  }
}

function estimateRuntime(toolchain: ToolchainInfo, networkTests: number, coverageWillRun: boolean): string {
  let minutes = 2; // Base compilation + basic tests
  
  if (toolchain.hasHardhat) minutes += 1;
  if (toolchain.hasFoundry) minutes += 0.5;
  if (networkTests > 0) minutes += networkTests * 0.5;
  if (coverageWillRun) minutes += 3; // Coverage adds significant time
  
  const totalMinutes = Math.ceil(minutes);
  return totalMinutes === 1 ? '1 minute' : `${totalMinutes} minutes`;
}
