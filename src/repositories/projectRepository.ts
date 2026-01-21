import { getDb } from '../db/index.js';
import { projects, components, type Project, type Component } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'project-repository' });

export interface CreateProjectInput {
  name: string;
  description?: string;
  userId: string;
  organizationId?: string;
  type?: 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit';
  status?: 'draft' | 'active' | 'archived' | 'deleted';
  settings?: Record<string, any>;
  logoUrl?: string;
  websiteUrl?: string;
  primaryColor?: string;
  contractAddress?: string;
  chainId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  type?: 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit';
  status?: 'draft' | 'active' | 'archived' | 'deleted';
  settings?: Record<string, any>;
  logoUrl?: string;
  websiteUrl?: string;
  primaryColor?: string;
  contractAddress?: string;
  chainId?: string;
  docsUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  discordUrl?: string;
}

/**
 * Create a new project in the database
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const db = getDb();

  // Generate slug from name
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check for slug collision
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, input.userId), eq(projects.slug, slug)))
    .limit(1);

  const finalSlug = existing.length > 0 ? `${slug}-${Date.now()}` : slug;

  const [project] = await db
    .insert(projects)
    .values({
      name: input.name,
      slug: finalSlug,
      description: input.description,
      userId: input.userId,
      organizationId: input.organizationId,
      type: input.type || 'full',
      status: input.status || 'draft',
      settings: input.settings || {},
      logoUrl: input.logoUrl,
      websiteUrl: input.websiteUrl,
      primaryColor: input.primaryColor,
      contractAddress: input.contractAddress,
      chainId: input.chainId,
    })
    .returning();

  log.info('Created project in database', { projectId: project.id, slug: finalSlug });
  return project;
}

/**
 * Get project by ID
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return project || null;
}

/**
 * Get project by slug for a specific user
 */
export async function getProjectBySlug(userId: string, slug: string): Promise<Project | null> {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.slug, slug)))
    .limit(1);
  return project || null;
}

/**
 * List all projects for a user
 */
export async function listProjectsByUser(userId: string): Promise<Project[]> {
  const db = getDb();
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));

  return userProjects;
}

/**
 * Update project
 */
export async function updateProject(
  projectId: string,
  updates: UpdateProjectInput
): Promise<Project | null> {
  const db = getDb();

  const [updated] = await db
    .update(projects)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  if (updated) {
    log.info('Updated project', { projectId });
  }

  return updated || null;
}

/**
 * Delete project (soft delete by setting status to 'deleted')
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const db = getDb();

  const [deleted] = await db
    .update(projects)
    .set({
      status: 'deleted',
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  if (deleted) {
    log.info('Soft deleted project', { projectId });
    return true;
  }

  return false;
}

/**
 * Hard delete project (actually remove from database)
 */
export async function hardDeleteProject(projectId: string): Promise<boolean> {
  const db = getDb();

  // Delete associated components first
  await db.delete(components).where(eq(components.projectId, projectId));

  // Delete project
  const result = await db.delete(projects).where(eq(projects.id, projectId)).returning();

  if (result.length > 0) {
    log.info('Hard deleted project', { projectId });
    return true;
  }

  return false;
}

/**
 * Get project with components
 */
export async function getProjectWithComponents(projectId: string): Promise<{
  project: Project;
  components: Component[];
} | null> {
  const db = getDb();

  const project = await getProjectById(projectId);
  if (!project) return null;

  const projectComponents = await db
    .select()
    .from(components)
    .where(eq(components.projectId, projectId))
    .orderBy(desc(components.createdAt));

  return {
    project,
    components: projectComponents,
  };
}
