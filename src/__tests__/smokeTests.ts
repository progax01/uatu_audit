/**
 * Smoke Tests for UatuAudit SOPs
 * Validates the golden path scenarios and critical functionality
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { executeEnhancedSOP } from '../sops/executeEnhanced.js';
import { probeClaudeCapabilities, checkSourceMutation, createSourceSentinel, removeSourceSentinel } from '../services/safetyGuards.js';
import { writeAutoInsights } from '../services/insightAutoWriter.js';

describe('UatuAudit Smoke Tests', () => {
  let tempDir: string;
  let projectDir: string;
  let runsDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uatu-smoke-'));
    projectDir = path.join(tempDir, 'project');
    runsDir = path.join(tempDir, 'runs');
    await fs.ensureDir(projectDir);
    await fs.ensureDir(runsDir);
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  describe('Claude CLI Integration', () => {
    it('should probe Claude CLI capabilities', async () => {
      const capabilities = await probeClaudeCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities).toHaveProperty('available');
      expect(capabilities).toHaveProperty('supportsPrint');
      expect(capabilities).toHaveProperty('lastChecked');
      
      // If Claude is available, it should support the features we need
      if (capabilities.available) {
        expect(capabilities.supportsPrint).toBe(true);
      }
    });
  });

  describe('Source Mutation Detection', () => {
    it('should detect when source files are modified', async () => {
      // Create a test project
      const testFile = path.join(projectDir, 'test.txt');
      await fs.writeFile(testFile, 'original content');
      
      // Create sentinel
      await createSourceSentinel(projectDir);
      
      const baselineTime = Date.now();
      
      // Wait a bit and modify file
      await new Promise(resolve => setTimeout(resolve, 100));
      await fs.writeFile(testFile, 'modified content');
      
      // Check for mutations
      const result = await checkSourceMutation(projectDir, baselineTime);
      
      expect(result.mutationDetected).toBe(true);
      expect(result.changedFiles).toContain('test.txt');
      
      // Cleanup
      await removeSourceSentinel(projectDir);
    });

    it('should not detect mutations when no files are changed', async () => {
      await createSourceSentinel(projectDir);
      
      const baselineTime = Date.now();
      
      // Check immediately without changes
      const result = await checkSourceMutation(projectDir, baselineTime);
      
      expect(result.mutationDetected).toBe(false);
      expect(result.changedFiles).toHaveLength(0);
      
      await removeSourceSentinel(projectDir);
    });
  });

  describe('Insight Auto-Writer', () => {
    it('should detect Hardhat plugin missing errors', async () => {
      const insights = await writeAutoInsights(runsDir, {
        cmd: 'npx hardhat compile',
        exitCode: 1,
        stderr: "Error: Cannot find module 'hardhat-coverage'\nRequire stack: hardhat.config.ts",
        toolchain: { hasHardhat: true }
      });

      expect(insights).toHaveLength(1);
      expect(insights[0].area).toBe('Config');
      expect(insights[0].summary).toContain('Hardhat plugin missing');
      
      // Check that insights.md was created
      const insightsFile = path.join(runsDir, 'insights.md');
      expect(await fs.pathExists(insightsFile)).toBe(true);
      
      const content = await fs.readFile(insightsFile, 'utf8');
      expect(content).toContain('Hardhat plugin missing');
    });

    it('should detect extglob shell errors', async () => {
      const insights = await writeAutoInsights(runsDir, {
        cmd: 'npx hardhat coverage --testfiles "test/!(exclude)/**/*.ts"',
        exitCode: 2,
        stderr: "syntax error near unexpected token `('",
        toolchain: { hasHardhat: true }
      });

      expect(insights).toHaveLength(1);
      expect(insights[0].area).toBe('Coverage');
      expect(insights[0].summary).toContain('extglob');
    });

    it('should detect NPM network errors', async () => {
      const insights = await writeAutoInsights(runsDir, {
        cmd: 'npm install',
        exitCode: 1,
        stderr: 'npm ERR! code ETIMEDOUT\nnpm ERR! network timeout at: https://registry.npmjs.org/',
        toolchain: { hasNode: true }
      });

      expect(insights).toHaveLength(1);
      expect(insights[0].area).toBe('Toolchain');
      expect(insights[0].summary).toContain('Network error');
      expect(insights[0].severity).toBe('low');
    });

    it('should detect Claude CLI timeout errors', async () => {
      const insights = await writeAutoInsights(runsDir, {
        cmd: 'claude --print',
        exitCode: 1,
        stderr: 'Claude CLI timeout after 300000ms',
        toolchain: {}
      });

      expect(insights).toHaveLength(1);
      expect(insights[0].area).toBe('Toolchain');
      expect(insights[0].summary).toContain('Claude CLI timeout');
    });

    it('should detect security patterns in code', async () => {
      const insights = await writeAutoInsights(runsDir, {
        cmd: 'forge build',
        exitCode: 0,
        stdout: 'function authenticate(address user) { require(tx.origin == owner); }',
        toolchain: { hasFoundry: true }
      });

      expect(insights).toHaveLength(1);
      expect(insights[0].area).toBe('Security');
      expect(insights[0].summary).toContain('tx.origin');
      expect(insights[0].severity).toBe('high');
    });
  });

  describe('Enhanced Execute SOP', () => {
    it('should validate inputs correctly', async () => {
      const validInputs = {
        projectPath: projectDir,
        runsPath: runsDir,
        timestamp: '2025-09-26'
      };

      const isValid = await executeEnhancedSOP.validateInputs(validInputs);
      expect(isValid).toBe(true);

      const invalidInputs = {
        projectPath: '',
        runsPath: runsDir
      };

      const isInvalid = await executeEnhancedSOP.validateInputs(invalidInputs);
      expect(isInvalid).toBe(false);
    });

    it('should handle empty project directory gracefully', async () => {
      // Create a minimal project structure
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'echo "no tests"'
        }
      };
      
      await fs.writeJson(path.join(projectDir, 'package.json'), packageJson);

      const result = await executeEnhancedSOP.execute({
        projectPath: projectDir,
        runsPath: runsDir,
        timestamp: '2025-09-26-test'
      });

      // Should complete even without smart contracts
      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      
      // Check that required files were created
      const runPath = path.join(runsDir, '2025-09-26-test');
      expect(await fs.pathExists(path.join(runPath, 'insights.md'))).toBe(true);
    });
  });

  describe('Environment Validation', () => {
    it('should handle missing environment variables gracefully', async () => {
      // Save original env vars
      const originalClaudePath = process.env.CLAUDE_CLI_PATH;
      const originalTimeout = process.env.CLAUDE_TIMEOUT_MS;

      // Unset for test
      delete process.env.CLAUDE_CLI_PATH;
      delete process.env.CLAUDE_TIMEOUT_MS;

      // Test should still work with defaults
      const capabilities = await probeClaudeCapabilities();
      expect(capabilities).toBeDefined();

      // Restore env vars
      if (originalClaudePath) process.env.CLAUDE_CLI_PATH = originalClaudePath;
      if (originalTimeout) process.env.CLAUDE_TIMEOUT_MS = originalTimeout;
    });
  });

  describe('Queue Resilience', () => {
    it('should handle queue directory creation', async () => {
      const queueDir = path.join(tempDir, 'queue');
      
      // Ensure directory exists
      await fs.ensureDir(queueDir);
      expect(await fs.pathExists(queueDir)).toBe(true);
      
      // Test should be able to write files
      const testFile = path.join(queueDir, 'test.json');
      await fs.writeJson(testFile, { test: true });
      
      const content = await fs.readJson(testFile);
      expect(content.test).toBe(true);
    });
  });
});
