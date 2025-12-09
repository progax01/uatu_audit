import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'methodology-version-manager' });

/**
 * Methodology Version Manager
 * Tracks and manages versions of methodology files for audit reproducibility
 */

export interface MethodologyVersion {
  version: string; // Semantic version (e.g., "1.0.0")
  file: string; // Filename (e.g., "reentrancy.md" or "reentrancy/v1.0.md")
  date: string; // ISO date
  author: string;
  changelog: string;
}

export interface MethodologyInfo {
  currentVersion: string;
  versions: MethodologyVersion[];
}

export interface Manifest {
  version: string; // Manifest schema version
  methodologies: {
    [key: string]: MethodologyInfo;
  };
  auditHistory: AuditRecord[];
}

export interface AuditRecord {
  jobId: string;
  timestamp: string;
  methodologies: {
    [key: string]: string; // methodology name -> version used
  };
  domain?: string;
  milestone?: number;
}

export class MethodologyVersionManager {
  private claudeDir: string;
  private manifestPath: string;
  private manifest: Manifest | null = null;

  constructor(claudeDir?: string) {
    const cwd = process.cwd();
    this.claudeDir = claudeDir || path.join(cwd, '.claude');
    this.manifestPath = path.join(this.claudeDir, 'methodologies', 'manifest.json');
  }

  /**
   * Load manifest from disk
   */
  async loadManifest(): Promise<Manifest> {
    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(content);
      log.debug(`Loaded methodology manifest: ${this.manifest!.version}`);
      return this.manifest!;
    } catch (error) {
      log.error(`Failed to load manifest:`, error);

      // Create default manifest if it doesn't exist
      this.manifest = {
        version: '1.0.0',
        methodologies: {},
        auditHistory: []
      };

      try {
        await this.saveManifest();
        log.info('Created new methodology manifest');
      } catch (saveError) {
        log.error('Failed to create manifest:', saveError);
      }

      return this.manifest;
    }
  }

  /**
   * Save manifest to disk
   */
  async saveManifest(): Promise<void> {
    if (!this.manifest) {
      throw new Error('Manifest not loaded');
    }

    try {
      await fs.writeFile(
        this.manifestPath,
        JSON.stringify(this.manifest, null, 2),
        'utf-8'
      );
      log.debug('Saved methodology manifest');
    } catch (error) {
      log.error('Failed to save manifest:', error);
      throw error;
    }
  }

  /**
   * Get current version of a methodology
   */
  async getCurrentVersion(methodologyName: string): Promise<string | null> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    const info = this.manifest!.methodologies[methodologyName];
    return info ? info.currentVersion : null;
  }

  /**
   * Get specific version info
   */
  async getVersionInfo(
    methodologyName: string,
    version?: string
  ): Promise<MethodologyVersion | null> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    const info = this.manifest!.methodologies[methodologyName];
    if (!info) return null;

    const targetVersion = version || info.currentVersion;
    return info.versions.find(v => v.version === targetVersion) || null;
  }

  /**
   * Register a new methodology version
   */
  async registerVersion(
    methodologyName: string,
    version: MethodologyVersion
  ): Promise<void> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    if (!this.manifest!.methodologies[methodologyName]) {
      this.manifest!.methodologies[methodologyName] = {
        currentVersion: version.version,
        versions: []
      };
    }

    const info = this.manifest!.methodologies[methodologyName];

    // Check if version already exists
    const existingIndex = info.versions.findIndex(v => v.version === version.version);
    if (existingIndex >= 0) {
      // Update existing version
      info.versions[existingIndex] = version;
      log.info(`Updated methodology ${methodologyName} version ${version.version}`);
    } else {
      // Add new version
      info.versions.push(version);
      log.info(`Registered new methodology ${methodologyName} version ${version.version}`);
    }

    // Update current version to latest
    info.currentVersion = version.version;

    await this.saveManifest();
  }

  /**
   * Record which methodology versions were used in an audit
   */
  async recordAuditUsage(
    jobId: string,
    methodologies: string[],
    domain?: string,
    milestone?: number
  ): Promise<void> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    const record: AuditRecord = {
      jobId,
      timestamp: new Date().toISOString(),
      methodologies: {},
      domain,
      milestone
    };

    // Record the version of each methodology used
    for (const methodologyName of methodologies) {
      const currentVersion = await this.getCurrentVersion(methodologyName);
      if (currentVersion) {
        record.methodologies[methodologyName] = currentVersion;
      }
    }

    this.manifest!.auditHistory.push(record);

    // Keep only last 100 audit records
    if (this.manifest!.auditHistory.length > 100) {
      this.manifest!.auditHistory = this.manifest!.auditHistory.slice(-100);
    }

    await this.saveManifest();
    log.info(`Recorded methodology usage for audit ${jobId}`);
  }

  /**
   * Get audit history for a specific job
   */
  async getAuditRecord(jobId: string): Promise<AuditRecord | null> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    return this.manifest!.auditHistory.find(r => r.jobId === jobId) || null;
  }

  /**
   * List all available methodologies
   */
  async listMethodologies(): Promise<string[]> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    return Object.keys(this.manifest!.methodologies);
  }

  /**
   * Get methodology file path for a specific version
   */
  getMethodologyPath(methodologyName: string, version?: string): string {
    if (version) {
      // If version is specified, use versioned path
      return path.join(
        this.claudeDir,
        'methodologies',
        methodologyName,
        `v${version}.md`
      );
    } else {
      // Use current version (direct file)
      return path.join(this.claudeDir, 'methodologies', `${methodologyName}.md`);
    }
  }

  /**
   * Load methodology content for a specific version
   */
  async loadMethodology(
    methodologyName: string,
    version?: string
  ): Promise<string> {
    const versionInfo = await this.getVersionInfo(methodologyName, version);

    if (!versionInfo) {
      throw new Error(
        `Methodology ${methodologyName}${version ? ` version ${version}` : ''} not found`
      );
    }

    const filePath = path.join(
      this.claudeDir,
      'methodologies',
      versionInfo.file
    );

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      log.debug(
        `Loaded methodology ${methodologyName} v${versionInfo.version} (${content.length} chars)`
      );
      return content;
    } catch (error) {
      log.error(`Failed to load methodology file ${filePath}:`, error);
      throw new Error(`Failed to load methodology ${methodologyName}: ${error}`);
    }
  }

  /**
   * Create a new version of a methodology
   */
  async createVersion(
    methodologyName: string,
    newVersion: string,
    changelog: string,
    author: string = 'UatuAudit Team'
  ): Promise<void> {
    // Copy current version to versioned file
    const currentPath = path.join(
      this.claudeDir,
      'methodologies',
      `${methodologyName}.md`
    );
    const versionedPath = path.join(
      this.claudeDir,
      'methodologies',
      methodologyName,
      `v${newVersion}.md`
    );

    try {
      // Ensure versioned directory exists
      await fs.mkdir(path.dirname(versionedPath), { recursive: true });

      // Copy file
      await fs.copyFile(currentPath, versionedPath);

      // Register new version
      await this.registerVersion(methodologyName, {
        version: newVersion,
        file: `${methodologyName}/v${newVersion}.md`,
        date: new Date().toISOString().split('T')[0],
        author,
        changelog
      });

      log.info(`Created new version ${newVersion} for methodology ${methodologyName}`);
    } catch (error) {
      log.error(`Failed to create version ${newVersion}:`, error);
      throw error;
    }
  }

  /**
   * Compare two versions of a methodology
   */
  async compareVersions(
    methodologyName: string,
    version1: string,
    version2: string
  ): Promise<{ added: number; removed: number; changed: boolean }> {
    const content1 = await this.loadMethodology(methodologyName, version1);
    const content2 = await this.loadMethodology(methodologyName, version2);

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    // Simple line-based diff
    const added = lines2.length - lines1.length;
    const removed = Math.max(0, lines1.length - lines2.length);
    const changed = content1 !== content2;

    return { added, removed, changed };
  }
}

// Singleton instance
let versionManager: MethodologyVersionManager | null = null;

/**
 * Get or create the singleton version manager instance
 */
export function getMethodologyVersionManager(): MethodologyVersionManager {
  if (!versionManager) {
    versionManager = new MethodologyVersionManager();
  }
  return versionManager;
}

/**
 * Reset the version manager (useful for testing)
 */
export function resetVersionManager(): void {
  versionManager = null;
}
