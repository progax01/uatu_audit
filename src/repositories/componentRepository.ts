import { getDb } from '../db/index.js';
import { components, type Component } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'component-repository' });

export interface CreateComponentInput {
  projectId: string;
  type: 'github-repo' | 'deployed-contract' | 'dapp-url' | 'library-source' | 'manual-upload';
  displayName: string;
  config: Record<string, any>;
  status?: 'pending' | 'syncing' | 'synced' | 'error';
}

export interface UpdateComponentInput {
  displayName?: string;
  status?: 'pending' | 'syncing' | 'synced' | 'error';
  config?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Add a component to a project
 */
export async function addComponent(input: CreateComponentInput): Promise<Component> {
  const db = getDb();

  const [component] = await db
    .insert(components)
    .values({
      projectId: input.projectId,
      type: input.type,
      displayName: input.displayName,
      config: input.config,
      status: input.status || 'pending',
    })
    .returning();

  log.info('Added component to project', { componentId: component.id, projectId: input.projectId });
  return component;
}

/**
 * Get component by ID
 */
export async function getComponentById(componentId: string): Promise<Component | null> {
  const db = getDb();
  const [component] = await db
    .select()
    .from(components)
    .where(eq(components.id, componentId))
    .limit(1);
  return component || null;
}

/**
 * List components for a project
 */
export async function listComponentsByProject(projectId: string): Promise<Component[]> {
  const db = getDb();
  return await db
    .select()
    .from(components)
    .where(eq(components.projectId, projectId))
    .orderBy(desc(components.createdAt));
}

/**
 * Update component
 */
export async function updateComponent(
  componentId: string,
  updates: UpdateComponentInput
): Promise<Component | null> {
  const db = getDb();

  const [updated] = await db
    .update(components)
    .set({
      ...updates,
      lastSyncedAt: updates.status === 'synced' ? new Date() : undefined,
    })
    .where(eq(components.id, componentId))
    .returning();

  if (updated) {
    log.info('Updated component', { componentId });
  }

  return updated || null;
}

/**
 * Remove component from project
 */
export async function removeComponent(componentId: string): Promise<boolean> {
  const db = getDb();

  const result = await db.delete(components).where(eq(components.id, componentId)).returning();

  if (result.length > 0) {
    log.info('Removed component', { componentId });
    return true;
  }

  return false;
}

/**
 * Update component status
 */
export async function updateComponentStatus(
  componentId: string,
  status: 'pending' | 'syncing' | 'synced' | 'error',
  errorMessage?: string
): Promise<Component | null> {
  return updateComponent(componentId, { status, errorMessage });
}
