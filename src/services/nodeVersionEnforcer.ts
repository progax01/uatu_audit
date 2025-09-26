import { logger } from "../utils/logger.js";
import { runCmdLogged } from "./cmdLog.js";
import { writeAutoInsights } from "./insightAutoWriter.js";

const log = logger.child({ service: 'node-version-enforcer' });

export interface NodeVersionInfo {
  current: string;
  major: number;
  isSupported: boolean;
  isLTS: boolean;
  recommended: string;
}

/**
 * Get current Node.js version information
 */
export async function getNodeVersionInfo(cwd: string = process.cwd()): Promise<NodeVersionInfo> {
  try {
    const versionOutput = await runCmdLogged('', 'node', ['-v'], { cwd });
    const version = versionOutput.trim().replace('v', '');
    const major = parseInt(version.split('.')[0], 10);
    
    // LTS versions as of 2024: 18.x, 20.x
    const isLTS = major === 18 || major === 20;
    const isSupported = major >= 18 && major <= 20;
    
    return {
      current: version,
      major,
      isSupported,
      isLTS,
      recommended: '20.11.0' // Latest LTS
    };
  } catch (error) {
    log.error('Failed to get Node version', { error: String(error) });
    throw new Error('Could not determine Node.js version');
  }
}

/**
 * Attempt to switch to a supported Node version using nvm
 */
export async function enforceNodeLTS(runPath: string, sandboxPath: string): Promise<{
  success: boolean;
  version: string;
  method: 'already_supported' | 'nvm_switch' | 'failed';
  error?: string;
}> {
  const nodeInfo = await getNodeVersionInfo(sandboxPath);
  
  if (nodeInfo.isSupported) {
    log.info('Node version is already supported', { 
      version: nodeInfo.current,
      major: nodeInfo.major 
    });
    
    return {
      success: true,
      version: nodeInfo.current,
      method: 'already_supported'
    };
  }

  log.warn('Unsupported Node version detected, attempting to switch to LTS', {
    current: nodeInfo.current,
    major: nodeInfo.major,
    recommended: nodeInfo.recommended
  });

  // Try to use nvm to switch to Node 20
  try {
    const nvmScript = `
      set -e
      export NVM_DIR="$HOME/.nvm"
      if [ -s "$NVM_DIR/nvm.sh" ]; then
        . "$NVM_DIR/nvm.sh"
        echo "NVM found, attempting to use Node 20..."
        nvm install 20 >/dev/null 2>&1 || echo "Node 20 already installed"
        nvm use 20
        node -v
      else
        echo "NVM not found"
        exit 1
      fi
    `;

    const nvmResult = await runCmdLogged(runPath, 'bash', ['-lc', nvmScript], { 
      cwd: sandboxPath 
    });
    
    const newVersion = nvmResult.trim().split('\n').pop()?.replace('v', '') || '';
    const newMajor = parseInt(newVersion.split('.')[0], 10);
    
    if (newMajor === 20) {
      log.info('Successfully switched to Node 20 using nvm', { 
        newVersion,
        oldVersion: nodeInfo.current 
      });
      
      return {
        success: true,
        version: newVersion,
        method: 'nvm_switch'
      };
    } else {
      throw new Error(`nvm use 20 resulted in version ${newVersion}, expected v20.x`);
    }

  } catch (nvmError) {
    log.error('Failed to switch Node version using nvm', { 
      error: String(nvmError),
      currentVersion: nodeInfo.current 
    });

    // Generate insight about the Node version issue
    await writeAutoInsights(runPath, {
      cmd: 'node version check',
      exitCode: null,
      stdout: `Current: Node ${nodeInfo.current}`,
      stderr: `Node ${nodeInfo.major} is not supported for Hardhat. Recommended: Node 18 or 20 LTS.`,
      toolchain: { hasHardhat: true, hasNode: true }
    });

    return {
      success: false,
      version: nodeInfo.current,
      method: 'failed',
      error: String(nvmError)
    };
  }
}

/**
 * Check if the current Node version supports a given toolchain
 */
export function isNodeVersionCompatible(nodeInfo: NodeVersionInfo, toolchain: string): boolean {
  switch (toolchain.toLowerCase()) {
    case 'hardhat':
      // Hardhat officially supports Node 16+, but Node 22+ has issues
      return nodeInfo.major >= 16 && nodeInfo.major <= 21;
    
    case 'foundry':
      // Foundry doesn't depend on Node version
      return true;
    
    case 'anchor':
      // Anchor works with most Node versions
      return nodeInfo.major >= 16;
    
    case 'node':
    case 'nodejs':
      // General Node.js projects
      return nodeInfo.major >= 16;
    
    default:
      return nodeInfo.isSupported;
  }
}

/**
 * Get recommended action for unsupported Node version
 */
export function getNodeVersionRecommendation(nodeInfo: NodeVersionInfo, toolchain?: string): {
  action: 'continue' | 'switch' | 'docker';
  reason: string;
  commands: string[];
} {
  if (nodeInfo.isSupported) {
    return {
      action: 'continue',
      reason: 'Node version is supported',
      commands: []
    };
  }

  const isHardhat = toolchain?.toLowerCase() === 'hardhat';
  
  if (nodeInfo.major >= 22 && isHardhat) {
    return {
      action: 'docker',
      reason: `Node ${nodeInfo.major} has known issues with Hardhat (coverage OOM, compilation warnings)`,
      commands: [
        'Use Docker: docker run --rm -v "$(pwd):/work" -w /work node:20-bullseye npm test',
        'Or use nvm: nvm use 20 && npm test',
        'Or disable coverage: export UATU_HARDHAT_COVERAGE=0'
      ]
    };
  }

  if (nodeInfo.major < 16) {
    return {
      action: 'switch',
      reason: `Node ${nodeInfo.major} is too old for modern tooling`,
      commands: [
        'nvm install 20 && nvm use 20',
        'Or update Node.js to latest LTS: https://nodejs.org/'
      ]
    };
  }

  return {
    action: 'switch',
    reason: `Node ${nodeInfo.major} is not LTS, recommend switching to 20.x`,
    commands: [
      'nvm use 20',
      'Or use Docker for isolation'
    ]
  };
}
