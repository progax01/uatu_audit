/**
 * Tool Availability Checker
 *
 * Checks which security tools are available (native or Docker)
 * and generates context for Claude AI to know what tools it can use.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { checkDockerAvailable, checkDockerImageExists } from './dockerRunner.js';
import { ECOSYSTEM_DOCKER_IMAGES, TOOL_ECOSYSTEM_MAP } from '../config/docker.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = logger.child({ module: 'tool-availability' });

export interface ToolAvailability {
  name: string;
  displayName: string;
  available: boolean;
  availableVia: 'native' | 'docker' | 'none';
  version?: string;
  dockerImage?: string;
  ecosystem?: string;
}

export interface ToolsetAvailability {
  dockerAvailable: boolean;
  dockerImages: {
    solidity: boolean;
    rust: boolean;
    move: boolean;
    substrate: boolean;
  };
  tools: ToolAvailability[];
  summary: string;
}

/**
 * Check if a tool is available natively
 */
async function checkNativeTool(name: string, checkCommand: string): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(checkCommand, { timeout: 5000 });
    const version = stdout.trim().split('\n')[0]; // First line usually has version
    return { available: true, version };
  } catch (error) {
    return { available: false };
  }
}

/**
 * Check availability of all security tools
 */
export async function checkAllToolsAvailability(): Promise<ToolsetAvailability> {
  log.info('Checking availability of all security tools...');

  // Check Docker availability
  const dockerAvailable = await checkDockerAvailable();
  log.info(`Docker available: ${dockerAvailable}`);

  // Check Docker images
  const dockerImages = {
    solidity: dockerAvailable ? await checkDockerImageExists(ECOSYSTEM_DOCKER_IMAGES.solidity) : false,
    rust: dockerAvailable ? await checkDockerImageExists(ECOSYSTEM_DOCKER_IMAGES.rust) : false,
    move: dockerAvailable ? await checkDockerImageExists(ECOSYSTEM_DOCKER_IMAGES.move) : false,
    substrate: dockerAvailable ? await checkDockerImageExists(ECOSYSTEM_DOCKER_IMAGES.substrate) : false,
  };

  log.info('Docker images:', dockerImages);

  // Define all tools to check
  const toolsToCheck = [
    // Solidity ecosystem
    { name: 'slither', displayName: 'Slither Static Analyzer', checkCommand: 'slither --version', ecosystem: 'solidity' },
    { name: 'mythril', displayName: 'Mythril Symbolic Execution', checkCommand: 'myth version', ecosystem: 'solidity' },
    { name: 'forge', displayName: 'Foundry Forge', checkCommand: 'forge --version', ecosystem: 'solidity' },
    { name: 'semgrep', displayName: 'Semgrep Pattern Scanner', checkCommand: 'semgrep --version', ecosystem: 'solidity' },
    { name: 'hardhat', displayName: 'Hardhat Testing Framework', checkCommand: 'hardhat --version', ecosystem: 'solidity' },
    { name: 'solc', displayName: 'Solidity Compiler', checkCommand: 'solc --version', ecosystem: 'solidity' },

    // Rust/Solana ecosystem
    { name: 'anchor', displayName: 'Anchor Framework', checkCommand: 'anchor --version', ecosystem: 'rust' },
    { name: 'cargo-clippy', displayName: 'Cargo Clippy Linter', checkCommand: 'cargo clippy --version', ecosystem: 'rust' },
    { name: 'cargo-audit', displayName: 'Cargo Audit Security Scanner', checkCommand: 'cargo audit --version', ecosystem: 'rust' },
    { name: 'cargo-geiger', displayName: 'Cargo Geiger Unsafe Detector', checkCommand: 'cargo geiger --version', ecosystem: 'rust' },
    { name: 'soteria', displayName: 'Soteria Solana Scanner', checkCommand: 'soteria --version', ecosystem: 'rust' },
    { name: 'solana', displayName: 'Solana CLI', checkCommand: 'solana --version', ecosystem: 'rust' },

    // Move ecosystem
    { name: 'aptos', displayName: 'Aptos CLI', checkCommand: 'aptos --version', ecosystem: 'move' },
    { name: 'sui', displayName: 'Sui CLI', checkCommand: 'sui --version', ecosystem: 'move' },
    { name: 'move-prover', displayName: 'Move Prover', checkCommand: 'move prove --help', ecosystem: 'move' },

    // Substrate ecosystem
    { name: 'cargo-contract', displayName: 'Cargo Contract', checkCommand: 'cargo contract --version', ecosystem: 'substrate' },
  ];

  // Check each tool
  const tools: ToolAvailability[] = [];

  for (const tool of toolsToCheck) {
    const native = await checkNativeTool(tool.name, tool.checkCommand);

    let availableVia: 'native' | 'docker' | 'none' = 'none';
    let dockerImage: string | undefined;

    if (native.available) {
      availableVia = 'native';
    } else if (dockerAvailable && tool.ecosystem) {
      const imageAvailable = dockerImages[tool.ecosystem as keyof typeof dockerImages];
      if (imageAvailable) {
        availableVia = 'docker';
        dockerImage = ECOSYSTEM_DOCKER_IMAGES[tool.ecosystem as keyof typeof ECOSYSTEM_DOCKER_IMAGES];
      }
    }

    tools.push({
      name: tool.name,
      displayName: tool.displayName,
      available: availableVia !== 'none',
      availableVia,
      version: native.version,
      dockerImage,
      ecosystem: tool.ecosystem,
    });

    log.info(`Tool ${tool.name}: ${availableVia} ${native.version || ''}`);
  }

  // Generate summary
  const nativeCount = tools.filter(t => t.availableVia === 'native').length;
  const dockerCount = tools.filter(t => t.availableVia === 'docker').length;
  const unavailableCount = tools.filter(t => !t.available).length;

  const summary = `${tools.length} tools checked: ${nativeCount} native, ${dockerCount} via Docker, ${unavailableCount} unavailable`;

  log.info(summary);

  return {
    dockerAvailable,
    dockerImages,
    tools,
    summary,
  };
}

/**
 * Generate Claude-friendly context about available tools
 */
export function generateClaudeToolContext(availability: ToolsetAvailability): string {
  const lines = [
    '# Available Security Tools',
    '',
    '## Environment Status',
    `- Docker: ${availability.dockerAvailable ? '✅ Available' : '❌ Not available'}`,
    '',
    '## Docker Images',
    `- Solidity Tools: ${availability.dockerImages.solidity ? '✅ Built' : '❌ Not built'}`,
    `- Rust/Solana Tools: ${availability.dockerImages.rust ? '✅ Built' : '❌ Not built'}`,
    `- Move Tools: ${availability.dockerImages.move ? '✅ Built' : '❌ Not built'}`,
    `- Substrate Tools: ${availability.dockerImages.substrate ? '✅ Built' : '❌ Not built'}`,
    '',
    '## Tool Availability',
    '',
  ];

  // Group tools by ecosystem
  const byEcosystem = {
    solidity: availability.tools.filter(t => t.ecosystem === 'solidity'),
    rust: availability.tools.filter(t => t.ecosystem === 'rust'),
    move: availability.tools.filter(t => t.ecosystem === 'move'),
    substrate: availability.tools.filter(t => t.ecosystem === 'substrate'),
  };

  for (const [ecosystem, tools] of Object.entries(byEcosystem)) {
    if (tools.length === 0) continue;

    lines.push(`### ${ecosystem.charAt(0).toUpperCase() + ecosystem.slice(1)} Ecosystem`);
    lines.push('');

    for (const tool of tools) {
      const status = tool.available ? '✅' : '❌';
      const via = tool.availableVia !== 'none' ? ` (${tool.availableVia})` : '';
      const version = tool.version ? ` - ${tool.version}` : '';
      lines.push(`- ${status} **${tool.displayName}** (\`${tool.name}\`)${via}${version}`);
    }

    lines.push('');
  }

  lines.push('## Usage Instructions');
  lines.push('');
  lines.push('You can use any tool marked with ✅ in your analysis steps.');
  lines.push('');

  if (availability.dockerAvailable) {
    lines.push('**Docker is available** - Tools will automatically run in secure containers if not installed natively.');
  } else {
    lines.push('**Docker is NOT available** - Only natively installed tools can be used.');
  }

  lines.push('');
  lines.push('When specifying tools in audit steps, use the command name (shown in backticks).');
  lines.push('');
  lines.push('Example: `slither`, `mythril`, `forge`, `anchor`, `aptos`');

  return lines.join('\n');
}

/**
 * Get list of available tool names (for quick checks)
 */
export async function getAvailableToolNames(): Promise<string[]> {
  const availability = await checkAllToolsAvailability();
  return availability.tools.filter(t => t.available).map(t => t.name);
}

/**
 * Check if a specific tool is available
 */
export async function isToolAvailable(toolName: string): Promise<boolean> {
  const availability = await checkAllToolsAvailability();
  const tool = availability.tools.find(t => t.name === toolName);
  return tool?.available || false;
}

/**
 * Get tool availability for a specific ecosystem
 */
export async function getEcosystemToolAvailability(ecosystem: 'solidity' | 'rust' | 'move' | 'substrate'): Promise<ToolAvailability[]> {
  const availability = await checkAllToolsAvailability();
  return availability.tools.filter(t => t.ecosystem === ecosystem);
}

/**
 * Generate a simple status report
 */
export async function generateToolStatusReport(): Promise<string> {
  const availability = await checkAllToolsAvailability();

  const report = [
    '='.repeat(60),
    'UATU AUDIT - TOOL AVAILABILITY REPORT',
    '='.repeat(60),
    '',
    availability.summary,
    '',
    'NATIVE TOOLS:',
  ];

  const native = availability.tools.filter(t => t.availableVia === 'native');
  if (native.length === 0) {
    report.push('  (none)');
  } else {
    native.forEach(t => {
      report.push(`  ✅ ${t.displayName} - ${t.version || 'unknown version'}`);
    });
  }

  report.push('');
  report.push('DOCKER TOOLS:');

  const docker = availability.tools.filter(t => t.availableVia === 'docker');
  if (docker.length === 0) {
    report.push('  (none)');
  } else {
    docker.forEach(t => {
      report.push(`  🐳 ${t.displayName} - ${t.dockerImage}`);
    });
  }

  report.push('');
  report.push('UNAVAILABLE TOOLS:');

  const unavailable = availability.tools.filter(t => !t.available);
  if (unavailable.length === 0) {
    report.push('  (none - all tools available!)');
  } else {
    unavailable.forEach(t => {
      report.push(`  ❌ ${t.displayName}`);
    });
  }

  report.push('');
  report.push('='.repeat(60));

  return report.join('\n');
}
