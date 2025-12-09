import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'prompt-cache' });

/**
 * 4-Layer Prompt Caching System for Deep Intelligence Framework
 *
 * Layer 1: System Core (cached permanently) - Master auditor framework
 * Layer 2: Project Context (cached per-session) - Flattened source code
 * Layer 3: Methodologies (cached per-task) - Vulnerability patterns
 * Layer 4: Dynamic Query (never cached) - User commands
 */

export type CacheLayerType = 1 | 2 | 3 | 4;

export interface CacheLayer {
  layer: CacheLayerType;
  content: string;
  hash: string;
  cached: boolean;
  size: number; // in characters
  description: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalQueries: number;
  savings: number; // percentage (0-100)
  layerStats: {
    [key in CacheLayerType]: {
      size: number;
      hash: string;
      lastUpdated: Date | null;
      hitCount: number;
    };
  };
}

export interface PromptBuildOptions {
  domain?: 'web3' | 'backend' | 'frontend';
  methodologies?: string[]; // e.g., ['reentrancy', 'oracle-manipulation']
  milestone?: 1 | 2 | 3 | 4 | 5;
  projectContext?: string; // Optional pre-loaded context
  includePersona?: boolean; // Default: true
}

export class PromptCacheManager {
  private layers: Map<CacheLayerType, CacheLayer>;
  private stats: CacheStats;
  private claudeDir: string;

  constructor() {
    this.layers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      savings: 0,
      layerStats: {
        1: { size: 0, hash: '', lastUpdated: null, hitCount: 0 },
        2: { size: 0, hash: '', lastUpdated: null, hitCount: 0 },
        3: { size: 0, hash: '', lastUpdated: null, hitCount: 0 },
        4: { size: 0, hash: '', lastUpdated: null, hitCount: 0 }
      }
    };

    // Find .claude directory (check current dir and parent)
    const cwd = process.cwd();
    if (fs.access(path.join(cwd, '.claude')).then(() => true).catch(() => false)) {
      this.claudeDir = path.join(cwd, '.claude');
    } else {
      this.claudeDir = path.join(cwd, '..', '.claude');
    }
  }

  /**
   * Generate hash for content
   */
  private hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Load Layer 1: System Core (Master Security Auditor Framework)
   * This layer is cached permanently and rarely changes
   */
  async setSystemCore(): Promise<void> {
    try {
      const systemPath = path.join(this.claudeDir, 'system.md');
      const content = await fs.readFile(systemPath, 'utf-8');
      const hash = this.hash(content);

      this.layers.set(1, {
        layer: 1,
        content,
        hash,
        cached: true,
        size: content.length,
        description: 'System Core: Master Security Auditor Framework'
      });

      this.stats.layerStats[1] = {
        size: content.length,
        hash,
        lastUpdated: new Date(),
        hitCount: 0
      };

      log.info(`✅ Layer 1 (System Core) loaded: ${content.length} chars, hash: ${hash}`);
    } catch (error) {
      log.error(`Failed to load Layer 1 (System Core):`, error);
      throw new Error(`Failed to load system core: ${error}`);
    }
  }

  /**
   * Load Layer 2: Project Context (Flattened source code, dependencies, architecture)
   * This layer is cached per-session (per audit)
   */
  async setProjectContext(context: string): Promise<void> {
    const hash = this.hash(context);

    // Check if context has changed
    const existingLayer = this.layers.get(2);
    if (existingLayer && existingLayer.hash === hash) {
      this.stats.hits++;
      this.stats.layerStats[2].hitCount++;
      log.debug(`✓ Layer 2 (Project Context) cache HIT: ${hash}`);
      return;
    }

    this.stats.misses++;
    this.layers.set(2, {
      layer: 2,
      content: context,
      hash,
      cached: true,
      size: context.length,
      description: 'Project Context: Source code and architecture'
    });

    this.stats.layerStats[2] = {
      size: context.length,
      hash,
      lastUpdated: new Date(),
      hitCount: 0
    };

    log.info(`✅ Layer 2 (Project Context) loaded: ${context.length} chars, hash: ${hash}`);
  }

  /**
   * Load Layer 3: Methodologies (Vulnerability detection patterns)
   * This layer is cached per-task (per milestone or analysis type)
   */
  async setMethodologies(methodologies: string[], domain?: string): Promise<void> {
    try {
      const contents: string[] = [];

      // Load domain persona if specified
      if (domain) {
        const personaPath = path.join(this.claudeDir, 'personas', `${domain}.md`);
        try {
          const personaContent = await fs.readFile(personaPath, 'utf-8');
          contents.push(`# Domain Persona: ${domain.toUpperCase()}\n\n${personaContent}`);
          log.debug(`Loaded persona: ${domain}.md`);
        } catch (error) {
          log.warn(`Persona ${domain}.md not found, skipping`);
        }
      }

      // Load methodology files
      for (const methodology of methodologies) {
        const methodologyPath = path.join(this.claudeDir, 'methodologies', `${methodology}.md`);
        try {
          const methodologyContent = await fs.readFile(methodologyPath, 'utf-8');
          contents.push(`# Methodology: ${methodology}\n\n${methodologyContent}`);
          log.debug(`Loaded methodology: ${methodology}.md`);
        } catch (error) {
          log.warn(`Methodology ${methodology}.md not found, skipping`);
        }
      }

      const combinedContent = contents.join('\n\n---\n\n');
      const hash = this.hash(combinedContent);

      // Check if methodologies have changed
      const existingLayer = this.layers.get(3);
      if (existingLayer && existingLayer.hash === hash) {
        this.stats.hits++;
        this.stats.layerStats[3].hitCount++;
        log.debug(`✓ Layer 3 (Methodologies) cache HIT: ${hash}`);
        return;
      }

      this.stats.misses++;
      this.layers.set(3, {
        layer: 3,
        content: combinedContent,
        hash,
        cached: true,
        size: combinedContent.length,
        description: `Methodologies: ${methodologies.join(', ')}${domain ? ` + ${domain} persona` : ''}`
      });

      this.stats.layerStats[3] = {
        size: combinedContent.length,
        hash,
        lastUpdated: new Date(),
        hitCount: 0
      };

      log.info(`✅ Layer 3 (Methodologies) loaded: ${combinedContent.length} chars, hash: ${hash}`);
    } catch (error) {
      log.error(`Failed to load Layer 3 (Methodologies):`, error);
      throw new Error(`Failed to load methodologies: ${error}`);
    }
  }

  /**
   * Load milestone instructions
   */
  async loadMilestone(milestoneNumber: 1 | 2 | 3 | 4 | 5): Promise<string> {
    try {
      const milestonePath = path.join(this.claudeDir, 'milestones', `m${milestoneNumber}-*.md`);

      // Find matching milestone file
      const files = await fs.readdir(path.join(this.claudeDir, 'milestones'));
      const milestoneFile = files.find(f => f.startsWith(`m${milestoneNumber}-`));

      if (!milestoneFile) {
        throw new Error(`Milestone ${milestoneNumber} file not found`);
      }

      const content = await fs.readFile(
        path.join(this.claudeDir, 'milestones', milestoneFile),
        'utf-8'
      );

      log.debug(`Loaded milestone: ${milestoneFile}`);
      return content;
    } catch (error) {
      log.error(`Failed to load milestone ${milestoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Build complete prompt from all layers + dynamic query
   * Layer 4 (Dynamic Query) is NEVER cached
   */
  async buildPrompt(dynamicQuery: string, options: PromptBuildOptions = {}): Promise<string> {
    this.stats.totalQueries++;

    const sections: string[] = [];

    // Layer 1: System Core (always included, cached)
    const layer1 = this.layers.get(1);
    if (layer1) {
      sections.push(`<!-- LAYER 1: SYSTEM CORE [CACHED: ${layer1.hash}] -->`);
      sections.push(layer1.content);
      this.stats.layerStats[1].hitCount++;
    } else {
      log.warn('Layer 1 (System Core) not loaded, loading now...');
      await this.setSystemCore();
      const layer1 = this.layers.get(1);
      if (layer1) {
        sections.push(`<!-- LAYER 1: SYSTEM CORE [CACHED: ${layer1.hash}] -->`);
        sections.push(layer1.content);
      }
    }

    // Layer 2: Project Context (cached per-session)
    const layer2 = this.layers.get(2);
    if (layer2) {
      sections.push(`\n<!-- LAYER 2: PROJECT CONTEXT [CACHED: ${layer2.hash}] -->`);
      sections.push(layer2.content);
      this.stats.layerStats[2].hitCount++;
    }

    // Layer 3: Methodologies (cached per-task)
    const layer3 = this.layers.get(3);
    if (layer3) {
      sections.push(`\n<!-- LAYER 3: METHODOLOGIES [CACHED: ${layer3.hash}] -->`);
      sections.push(layer3.content);
      this.stats.layerStats[3].hitCount++;
    }

    // Load milestone instructions if specified
    if (options.milestone) {
      try {
        const milestoneContent = await this.loadMilestone(options.milestone);
        sections.push(`\n<!-- MILESTONE ${options.milestone} INSTRUCTIONS -->`);
        sections.push(milestoneContent);
      } catch (error) {
        log.warn(`Failed to load milestone ${options.milestone}, continuing without it`);
      }
    }

    // Layer 4: Dynamic Query (NEVER cached)
    const queryHash = this.hash(dynamicQuery);
    sections.push(`\n<!-- LAYER 4: DYNAMIC QUERY [NOT CACHED: ${queryHash}] -->`);
    sections.push(dynamicQuery);

    this.stats.layerStats[4] = {
      size: dynamicQuery.length,
      hash: queryHash,
      lastUpdated: new Date(),
      hitCount: this.stats.layerStats[4].hitCount + 1
    };

    // Calculate savings
    const cachedSize = (layer1?.size || 0) + (layer2?.size || 0) + (layer3?.size || 0);
    const totalSize = cachedSize + dynamicQuery.length;
    this.stats.savings = totalSize > 0 ? (cachedSize / totalSize) * 100 : 0;

    const fullPrompt = sections.join('\n\n');

    log.info('📦 Prompt built with caching:');
    log.info(`   Layer 1: ${layer1 ? `${layer1.size} chars (cached)` : 'not loaded'}`);
    log.info(`   Layer 2: ${layer2 ? `${layer2.size} chars (cached)` : 'not loaded'}`);
    log.info(`   Layer 3: ${layer3 ? `${layer3.size} chars (cached)` : 'not loaded'}`);
    log.info(`   Layer 4: ${dynamicQuery.length} chars (not cached)`);
    log.info(`   Total: ${fullPrompt.length} chars`);
    log.info(`   Cache savings: ${this.stats.savings.toFixed(1)}%`);

    return fullPrompt;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear specific cache layer
   */
  clearLayer(layer: CacheLayerType): void {
    this.layers.delete(layer);
    this.stats.layerStats[layer] = {
      size: 0,
      hash: '',
      lastUpdated: null,
      hitCount: 0
    };
    log.info(`Cleared cache layer ${layer}`);
  }

  /**
   * Clear all cache layers
   */
  clearAll(): void {
    this.layers.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      savings: 0,
      layerStats: {
        1: { size: 0, hash: '', lastUpdated: null, hitCount: 0 },
        2: { size: 0, hash: '', lastUpdated: null, hitCount: 0 },
        3: { size: 0, hash: '', lastUpdated: null, hitCount: 0 },
        4: { size: 0, hash: '', lastUpdated: null, hitCount: 0 }
      }
    };
    log.info('Cleared all cache layers');
  }

  /**
   * Get layer info
   */
  getLayer(layer: CacheLayerType): CacheLayer | undefined {
    return this.layers.get(layer);
  }

  /**
   * Check if layer is cached
   */
  isLayerCached(layer: CacheLayerType): boolean {
    return this.layers.has(layer);
  }
}

// Singleton instance
let cacheManager: PromptCacheManager | null = null;

/**
 * Get or create the singleton cache manager instance
 */
export function getPromptCacheManager(): PromptCacheManager {
  if (!cacheManager) {
    cacheManager = new PromptCacheManager();
  }
  return cacheManager;
}

/**
 * Reset the cache manager (useful for testing)
 */
export function resetCacheManager(): void {
  cacheManager = null;
}
