/**
 * Project Service
 *
 * CRUD operations for projects and components.
 * Manages the two-level hierarchy: Projects → Components
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import {
  ProjectMetadata,
  ProjectSettings,
  ProjectStatus,
  ProjectType,
  ProjectIndex,
  ProjectIndexEntry,
  SourceComponent,
  ComponentType,
  ComponentStatus,
  ComponentConfig,
  CreateProjectInput,
  AddComponentInput,
  ComponentFingerprint,
} from '../types/project.js';

const log = logger.child({ service: 'project-service' });

// ============================================================================
// PATHS
// ============================================================================

function getUatuHome(): string {
  return process.env.UATU_HOME || path.join(process.env.HOME || '', '.uatu');
}

function getProjectsDir(): string {
  return path.join(getUatuHome(), 'projects');
}

function getProjectIndexPath(): string {
  return path.join(getProjectsDir(), 'index.json');
}

function getProjectDir(projectId: string): string {
  return path.join(getProjectsDir(), projectId);
}

function getProjectMetadataPath(projectId: string): string {
  return path.join(getProjectDir(projectId), 'metadata.json');
}

function getComponentDir(projectId: string, componentId: string): string {
  return path.join(getProjectDir(projectId), 'components', componentId);
}

function getComponentConfigPath(projectId: string, componentId: string): string {
  return path.join(getComponentDir(projectId, componentId), 'config.json');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate URL-friendly slug from name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Safe JSON read with default
 */
async function readJsonSafe<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Atomic JSON write
 */
async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

// ============================================================================
// PROJECT INDEX
// ============================================================================

/**
 * Load project index
 */
async function loadProjectIndex(): Promise<ProjectIndex> {
  const defaultIndex: ProjectIndex = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    projects: {},
  };
  return readJsonSafe(getProjectIndexPath(), defaultIndex);
}

/**
 * Save project index
 */
async function saveProjectIndex(index: ProjectIndex): Promise<void> {
  index.lastUpdated = new Date().toISOString();
  await writeJsonAtomic(getProjectIndexPath(), index);
}

/**
 * Update project in index
 */
async function updateProjectIndex(project: ProjectMetadata): Promise<void> {
  const index = await loadProjectIndex();
  index.projects[project.id] = {
    id: project.id,
    slug: project.slug,
    name: project.name,
    userId: project.userId,
    type: project.type,
    status: project.status,
    componentCount: project.components.length,
    lastAuditAt: project.lastAuditAt,
    aggregatedScore: project.aggregatedScore?.value,
  };
  await saveProjectIndex(index);
}

/**
 * Remove project from index
 */
async function removeFromProjectIndex(projectId: string): Promise<void> {
  const index = await loadProjectIndex();
  delete index.projects[projectId];
  await saveProjectIndex(index);
}

// ============================================================================
// PROJECT CRUD
// ============================================================================

/**
 * Create a new project
 */
export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<ProjectMetadata> {
  const now = new Date().toISOString();
  const id = uuidv4();
  const slug = slugify(input.name);

  // Check for slug uniqueness within user's projects
  const index = await loadProjectIndex();
  const existingSlug = Object.values(index.projects).find(
    (p) => p.userId === userId && p.slug === slug
  );
  const finalSlug = existingSlug ? `${slug}-${id.substring(0, 8)}` : slug;

  const defaultSettings: ProjectSettings = {
    testStyles: ['behavioral', 'stride'],
    aiEnabled: true,
    auditDepth: 'standard',
  };

  const project: ProjectMetadata = {
    id,
    slug: finalSlug,
    name: input.name,
    description: input.description,
    userId,
    type: input.type,
    ecosystems: [],
    networks: [],
    components: [],
    settings: { ...defaultSettings, ...input.settings },
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    auditCount: 0,
    tags: input.tags || [],
  };

  // Save project metadata
  await writeJsonAtomic(getProjectMetadataPath(id), project);

  // Update index
  await updateProjectIndex(project);

  log.info(`Created project: ${project.name} (${project.id})`);
  return project;
}

/**
 * Get project by ID
 */
export async function getProject(projectId: string): Promise<ProjectMetadata | null> {
  try {
    const content = await fs.readFile(getProjectMetadataPath(projectId), 'utf-8');
    return JSON.parse(content) as ProjectMetadata;
  } catch {
    return null;
  }
}

/**
 * Get project by slug for a user
 */
export async function getProjectBySlug(
  userId: string,
  slug: string
): Promise<ProjectMetadata | null> {
  const index = await loadProjectIndex();
  const entry = Object.values(index.projects).find(
    (p) => p.userId === userId && p.slug === slug
  );
  if (!entry) return null;
  return getProject(entry.id);
}

/**
 * List all projects for a user
 */
export async function listProjects(userId: string): Promise<ProjectMetadata[]> {
  const index = await loadProjectIndex();
  const userProjects = Object.values(index.projects).filter(
    (p) => p.userId === userId
  );

  const projects: ProjectMetadata[] = [];
  for (const entry of userProjects) {
    const project = await getProject(entry.id);
    if (project) {
      projects.push(project);
    }
  }

  // Sort by updatedAt descending
  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Update project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Omit<ProjectMetadata, 'id' | 'createdAt' | 'userId'>>
): Promise<ProjectMetadata | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const updatedProject: ProjectMetadata = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonAtomic(getProjectMetadataPath(projectId), updatedProject);
  await updateProjectIndex(updatedProject);

  log.info(`Updated project: ${projectId}`);
  return updatedProject;
}

/**
 * Delete project and all components
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const project = await getProject(projectId);
  if (!project) return false;

  // Remove project directory
  try {
    await fs.rm(getProjectDir(projectId), { recursive: true, force: true });
  } catch (error) {
    log.error(`Failed to delete project directory: ${error}`);
  }

  // Remove from index
  await removeFromProjectIndex(projectId);

  log.info(`Deleted project: ${projectId}`);
  return true;
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<ProjectMetadata | null> {
  return updateProject(projectId, { status });
}

// ============================================================================
// COMPONENT CRUD
// ============================================================================

/**
 * Add component to project
 */
export async function addComponent(
  projectId: string,
  input: AddComponentInput
): Promise<SourceComponent | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const now = new Date().toISOString();
  const componentId = uuidv4();

  // Generate display name if not provided
  const displayName = input.displayName || generateComponentDisplayName(input);

  const component: SourceComponent = {
    id: componentId,
    projectId,
    type: input.type,
    config: { ...input.config, type: input.type } as ComponentConfig,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    displayName,
  };

  // Save component config
  await writeJsonAtomic(getComponentConfigPath(projectId, componentId), component);

  // Update project with new component
  project.components.push(component);
  project.updatedAt = now;

  // Update ecosystems/networks based on component type
  updateProjectMetadataFromComponent(project, component);

  await writeJsonAtomic(getProjectMetadataPath(projectId), project);
  await updateProjectIndex(project);

  log.info(`Added component ${componentId} to project ${projectId}`);
  return component;
}

/**
 * Get component by ID
 */
export async function getComponent(
  projectId: string,
  componentId: string
): Promise<SourceComponent | null> {
  try {
    const content = await fs.readFile(
      getComponentConfigPath(projectId, componentId),
      'utf-8'
    );
    return JSON.parse(content) as SourceComponent;
  } catch {
    return null;
  }
}

/**
 * Update component
 */
export async function updateComponent(
  projectId: string,
  componentId: string,
  updates: Partial<Omit<SourceComponent, 'id' | 'projectId' | 'createdAt'>>
): Promise<SourceComponent | null> {
  const component = await getComponent(projectId, componentId);
  if (!component) return null;

  const updatedComponent: SourceComponent = {
    ...component,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonAtomic(
    getComponentConfigPath(projectId, componentId),
    updatedComponent
  );

  // Update in project metadata
  const project = await getProject(projectId);
  if (project) {
    const idx = project.components.findIndex((c) => c.id === componentId);
    if (idx !== -1) {
      project.components[idx] = updatedComponent;
      project.updatedAt = new Date().toISOString();
      await writeJsonAtomic(getProjectMetadataPath(projectId), project);
      await updateProjectIndex(project);
    }
  }

  log.info(`Updated component ${componentId} in project ${projectId}`);
  return updatedComponent;
}

/**
 * Update component status
 */
export async function updateComponentStatus(
  projectId: string,
  componentId: string,
  status: ComponentStatus,
  error?: string
): Promise<SourceComponent | null> {
  const updates: Partial<SourceComponent> = { status };
  if (status === 'synced') {
    updates.lastSyncAt = new Date().toISOString();
    updates.syncError = undefined;
  } else if (status === 'error' && error) {
    updates.syncError = error;
  }
  return updateComponent(projectId, componentId, updates);
}

/**
 * Remove component from project
 */
export async function removeComponent(
  projectId: string,
  componentId: string
): Promise<boolean> {
  const project = await getProject(projectId);
  if (!project) return false;

  // Remove component directory
  try {
    await fs.rm(getComponentDir(projectId, componentId), {
      recursive: true,
      force: true,
    });
  } catch (error) {
    log.error(`Failed to delete component directory: ${error}`);
  }

  // Remove from project
  project.components = project.components.filter((c) => c.id !== componentId);
  project.updatedAt = new Date().toISOString();
  await writeJsonAtomic(getProjectMetadataPath(projectId), project);
  await updateProjectIndex(project);

  log.info(`Removed component ${componentId} from project ${projectId}`);
  return true;
}

/**
 * Update component fingerprint
 */
export async function updateComponentFingerprint(
  projectId: string,
  componentId: string,
  fingerprint: ComponentFingerprint
): Promise<SourceComponent | null> {
  const component = await getComponent(projectId, componentId);
  if (!component) return null;

  component.fingerprint = fingerprint;
  component.status = 'synced';
  component.lastSyncAt = new Date().toISOString();
  component.updatedAt = new Date().toISOString();

  await writeJsonAtomic(getComponentConfigPath(projectId, componentId), component);

  // Update in project and derive ecosystems
  const project = await getProject(projectId);
  if (project) {
    const idx = project.components.findIndex((c) => c.id === componentId);
    if (idx !== -1) {
      project.components[idx] = component;

      // Derive ecosystems from fingerprint
      for (const eco of fingerprint.ecosystems) {
        if (!project.ecosystems.includes(eco.name)) {
          project.ecosystems.push(eco.name);
        }
      }

      project.updatedAt = new Date().toISOString();
      await writeJsonAtomic(getProjectMetadataPath(projectId), project);
      await updateProjectIndex(project);
    }
  }

  log.info(`Updated fingerprint for component ${componentId}`);
  return component;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate display name from component config
 */
function generateComponentDisplayName(input: AddComponentInput): string {
  switch (input.type) {
    case 'github-repo': {
      const config = input.config as { fullName?: string; repo?: string };
      return config.fullName || config.repo || 'GitHub Repository';
    }
    case 'deployed-contract': {
      const config = input.config as { contractName?: string; address?: string };
      const addr = config.address?.substring(0, 10) || '';
      return config.contractName ? `${config.contractName} (${addr}...)` : `Contract ${addr}...`;
    }
    case 'dapp-url': {
      const config = input.config as { name?: string; url?: string };
      return config.name || new URL(config.url || 'https://unknown').hostname;
    }
    case 'library-source': {
      const config = input.config as { packageName?: string; version?: string };
      return config.version ? `${config.packageName}@${config.version}` : config.packageName || 'Library';
    }
    case 'manual-upload': {
      const config = input.config as { filename?: string };
      return config.filename || 'Uploaded Source';
    }
    default:
      return 'Component';
  }
}

/**
 * Update project metadata from component
 */
function updateProjectMetadataFromComponent(
  project: ProjectMetadata,
  component: SourceComponent
): void {
  // Add networks for deployed contracts
  if (component.type === 'deployed-contract') {
    const config = component.config as { network?: string };
    if (config.network && !project.networks.includes(config.network)) {
      project.networks.push(config.network);
    }
  }
}

// ============================================================================
// WORKSPACE INTEGRATION
// ============================================================================

/**
 * Get workspace path for a component
 */
export function getComponentWorkspacePath(
  userId: string,
  projectSlug: string,
  componentId: string
): string {
  return path.join(
    getUatuHome(),
    'workspace',
    'users',
    userId,
    'projects',
    projectSlug,
    'components',
    componentId
  );
}

/**
 * Get unified workspace path for a project
 */
export function getUnifiedWorkspacePath(
  userId: string,
  projectSlug: string
): string {
  return path.join(
    getUatuHome(),
    'workspace',
    'users',
    userId,
    'projects',
    projectSlug,
    'unified'
  );
}

/**
 * Ensure component workspace exists
 */
export async function ensureComponentWorkspace(
  userId: string,
  projectSlug: string,
  componentId: string
): Promise<string> {
  const workspacePath = getComponentWorkspacePath(userId, projectSlug, componentId);
  await ensureDir(path.join(workspacePath, '.uatu', 'context'));
  await ensureDir(path.join(workspacePath, 'runs'));
  return workspacePath;
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  // Project CRUD
  createProject,
  getProject,
  getProjectBySlug,
  listProjects,
  updateProject,
  deleteProject,
  updateProjectStatus,

  // Component CRUD
  addComponent,
  getComponent,
  updateComponent,
  updateComponentStatus,
  removeComponent,
  updateComponentFingerprint,

  // Workspace
  getComponentWorkspacePath,
  getUnifiedWorkspacePath,
  ensureComponentWorkspace,
};
