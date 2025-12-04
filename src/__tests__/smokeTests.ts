/**
 * Smoke Tests for UatuAudit SOPs
 * Validates the golden path scenarios and critical functionality
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { singlePromptAuditSOP } from '../sops/singlePromptAudit.js';
import { bootstrapSOP } from '../sops/bootstrap.js';
import { writeAutoInsights } from '../services/insightAutoWriter.js';

describe('UatuAudit Smoke Tests', () => {
  let tempDir: string;
  let projectDir: string;
  let runsDir: string;
  let contextDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uatu-smoke-'));
    projectDir = path.join(tempDir, 'project');
    runsDir = path.join(tempDir, 'runs');
    contextDir = path.join(tempDir, 'context');
    await fs.ensureDir(projectDir);
    await fs.ensureDir(runsDir);
    await fs.ensureDir(contextDir);
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
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

  describe('Bootstrap SOP', () => {
    it('should validate inputs correctly', async () => {
      const validInputs = {
        projectPath: projectDir,
        contextPath: contextDir,
        runsPath: runsDir,
        timestamp: '2025-09-26'
      };

      const isValid = await bootstrapSOP.validateInputs(validInputs);
      expect(isValid).toBe(true);

      const invalidInputs = {
        projectPath: '',
        contextPath: contextDir
      };

      const isInvalid = await bootstrapSOP.validateInputs(invalidInputs);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Single Prompt Audit SOP', () => {
    it('should validate inputs correctly', async () => {
      const validInputs = {
        projectPath: projectDir,
        contextPath: contextDir,
        runsPath: runsDir,
        timestamp: '2025-09-26'
      };

      const isValid = await singlePromptAuditSOP.validateInputs(validInputs);
      expect(isValid).toBe(true);

      const invalidInputs = {
        projectPath: '',
        contextPath: ''
      };

      const isInvalid = await singlePromptAuditSOP.validateInputs(invalidInputs);
      expect(isInvalid).toBe(false);
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
