/**
 * Project API Routes
 *
 * CRUD operations for projects and components.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from '../../utils/logger.js';
import {
  createProject,
  getProjectById,
  getProjectBySlug,
  listProjectsByUser,
  updateProject,
  deleteProject,
} from '../../repositories/projectRepository.js';
import {
  addComponent,
  getComponentById,
  listComponentsByProject,
  updateComponent,
  removeComponent,
  updateComponentStatus,
} from '../../repositories/componentRepository.js';
import type {
  CreateProjectInput as CreateProjectRepoInput,
} from '../../repositories/projectRepository.js';
import type {
  CreateComponentInput as CreateComponentRepoInput,
} from '../../repositories/componentRepository.js';
import type {
  CreateProjectInput,
  AddComponentInput,
  ProjectType,
} from '../../types/project.js';

const log = logger.child({ service: 'projects-routes' });

// ============================================================================
// TYPES
// ============================================================================

interface RouteContext {
  userId?: string;
  sessionId?: string;
}

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
  params?: Record<string, string>
) => Promise<void>;

// ============================================================================
// UTILITIES
// ============================================================================

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function extractPathParams(
  pattern: string,
  path: string
): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].substring(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/projects - Create a new project
 */
const createProjectHandler: RouteHandler = async (req, res, ctx) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const body = await parseJsonBody<{
      name: string;
      description?: string;
      type: ProjectType;
      settings?: Record<string, unknown>;
      tags?: string[];
    }>(req);

    if (!body.name || !body.type) {
      return sendError(res, 400, 'name and type are required');
    }

    const validTypes: ProjectType[] = ['full', 'contract-only', 'dapp-pentest', 'library-audit'];
    if (!validTypes.includes(body.type)) {
      return sendError(res, 400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const project = await createProject({
      name: body.name,
      description: body.description,
      userId: ctx.userId,
      type: body.type,
      settings: body.settings as any,
    });
    log.info(`Created project: ${project.id} for user ${ctx.userId}`);
    sendJson(res, 201, project);
  } catch (error: any) {
    log.error('Failed to create project:', error);
    sendError(res, 500, error.message || 'Failed to create project');
  }
};

/**
 * GET /api/projects - List user's projects
 */
const listProjectsHandler: RouteHandler = async (req, res, ctx) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const projects = await listProjectsByUser(ctx.userId);

    // Enrich projects with audit and component data from database
    const { db } = await import('../../db/index.js');
    const { auditJobs, auditResults, components } = await import('../../db/schema.js');
    const { eq, desc, and, isNotNull, count } = await import('drizzle-orm');

    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        // Get all audits for this project
        const audits = await db
          .select({
            job: auditJobs,
            results: auditResults,
          })
          .from(auditJobs)
          .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
          .where(eq(auditJobs.projectId, project.id))
          .orderBy(desc(auditJobs.createdAt));

        // Calculate audit stats
        const auditCount = audits.length;
        const completedAudits = audits.filter(
          (a) => a.job.status === 'completed' && a.results?.scoreValue !== null
        );

        let aggregatedScore = null;
        let lastAuditAt = null;
        let lastAuditJobId = null;

        if (completedAudits.length > 0) {
          // Get the latest completed audit
          const latestAudit = completedAudits[0];
          lastAuditAt = latestAudit.job.completedAt || latestAudit.job.createdAt;
          lastAuditJobId = latestAudit.job.id;

          // Use the latest audit's score as aggregated score
          if (latestAudit.results && latestAudit.results.scoreValue !== null) {
            aggregatedScore = {
              value: latestAudit.results.scoreValue,
              grade: latestAudit.results.scoreLabel || 'N/A',
            };
          }
        }

        // Get component count from components table
        const componentCountResult = await db
          .select({ count: count() })
          .from(components)
          .where(eq(components.projectId, project.id));
        const componentCount = componentCountResult[0]?.count || 0;

        return {
          ...project,
          auditCount,
          aggregatedScore,
          lastAuditAt,
          lastAuditJobId,
          componentCount,
        };
      })
    );

    sendJson(res, 200, { projects: enrichedProjects });
  } catch (error: any) {
    log.error('Failed to list projects:', error);
    sendError(res, 500, error.message || 'Failed to list projects');
  }
};

/**
 * GET /api/projects/:id - Get project by ID
 */
const getProjectHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }

    // Check ownership
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Fetch components for this project
    const components = await listComponentsByProject(projectId);

    sendJson(res, 200, { ...project, components });
  } catch (error: any) {
    log.error('Failed to get project:', error);
    sendError(res, 500, error.message || 'Failed to get project');
  }
};

/**
 * GET /api/projects/by-slug/:slug - Get project by slug
 */
const getProjectBySlugHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const slug = params?.slug;
  if (!slug) {
    return sendError(res, 400, 'Project slug required');
  }

  try {
    const project = await getProjectBySlug(ctx.userId, slug);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }

    // Fetch components for this project
    const components = await listComponentsByProject(project.id);

    sendJson(res, 200, { project: { ...project, components } });
  } catch (error: any) {
    log.error('Failed to get project by slug:', error);
    sendError(res, 500, error.message || 'Failed to get project');
  }
};

/**
 * PUT /api/projects/:id - Update project
 */
const updateProjectHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Check ownership
    const existing = await getProjectById(projectId);
    if (!existing) {
      return sendError(res, 404, 'Project not found');
    }
    if (existing.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const body = await parseJsonBody<Record<string, unknown>>(req);

    // Prevent updating protected fields
    delete body.id;
    delete body.userId;
    delete body.createdAt;

    const updated = await updateProject(projectId, body);
    if (!updated) {
      return sendError(res, 500, 'Failed to update project');
    }

    sendJson(res, 200, updated);
  } catch (error: any) {
    log.error('Failed to update project:', error);
    sendError(res, 500, error.message || 'Failed to update project');
  }
};

/**
 * DELETE /api/projects/:id - Delete project
 */
const deleteProjectHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Check ownership
    const existing = await getProjectById(projectId);
    if (!existing) {
      return sendError(res, 404, 'Project not found');
    }
    if (existing.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const success = await deleteProject(projectId);
    if (!success) {
      return sendError(res, 500, 'Failed to delete project');
    }

    sendJson(res, 200, { success: true });
  } catch (error: any) {
    log.error('Failed to delete project:', error);
    sendError(res, 500, error.message || 'Failed to delete project');
  }
};

/**
 * POST /api/projects/:id/components - Add component to project
 */
const addComponentHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Check ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const body = await parseJsonBody<{
      type: string;
      displayName?: string;
      config: Record<string, unknown>;
    }>(req);

    if (!body.type || !body.config) {
      return sendError(res, 400, 'type and config are required');
    }

    const validTypes = ['github-repo', 'deployed-contract', 'dapp-url', 'library-source', 'manual-upload'];
    if (!validTypes.includes(body.type)) {
      return sendError(res, 400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const component = await addComponent({
      projectId,
      type: body.type as any,
      displayName: body.displayName || `Component ${Date.now()}`,
      config: body.config as any,
    });
    if (!component) {
      return sendError(res, 500, 'Failed to add component');
    }

    log.info(`Added component ${component.id} to project ${projectId}`);
    sendJson(res, 201, component);
  } catch (error: any) {
    log.error('Failed to add component:', error);
    sendError(res, 500, error.message || 'Failed to add component');
  }
};

/**
 * GET /api/projects/:id/components - List components
 */
const listComponentsHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const components = await listComponentsByProject(projectId);
    sendJson(res, 200, { components });
  } catch (error: any) {
    log.error('Failed to list components:', error);
    sendError(res, 500, error.message || 'Failed to list components');
  }
};

/**
 * GET /api/projects/:id/audits - List audits for project
 */
const listProjectAuditsHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Verify project ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Query audits for this project
    const { db } = await import('../../db/index.js');
    const { auditJobs, auditResults } = await import('../../db/schema.js');
    const { eq, desc } = await import('drizzle-orm');

    const audits = await db
      .select({
        job: auditJobs,
        results: auditResults,
      })
      .from(auditJobs)
      .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
      .where(eq(auditJobs.projectId, projectId))
      .orderBy(desc(auditJobs.createdAt));

    // Transform to include jobId field and score for frontend compatibility
    const transformedAudits = audits.map(({ job, results }) => {
      const metadata = results?.metadata as any || {};
      const findings = results?.findings as any[] || [];

      // Extract sources and GitHub info from job metadata
      const sources: string[] = [];
      let repoOwner: string | null = null;
      let repoName: string | null = null;

      if (job.repo) {
        const repoFullName = job.repo.split('/').pop()?.replace('.git', '') || job.repo;
        sources.push(repoFullName);

        // Extract owner and repo from repo URL
        // Format: https://github.com/owner/repo.git or git@github.com:owner/repo.git
        const match = job.repo.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(?:\.git)?$/);
        if (match) {
          repoOwner = match[1];
          repoName = match[2];
        }
      }
      if (job.contractAddress) {
        sources.push(job.contractAddress.substring(0, 10) + '...');
      }

      return {
        ...job,
        jobId: job.id,
        score: results?.scoreValue || null,
        grade: results?.scoreLabel || null,
        sloc: metadata.sloc || metadata.contractAnalysis?.sloc || null,
        fileCount: metadata.fileCount || null,
        sources: sources.length > 0 ? sources : ['Unknown'],
        findingsCount: findings.length || 0,
        commitSha: job.commitSha || null,
        branch: job.branch || null,
        repoOwner,
        repoName,
        auditDepth: job.auditDepth || (job.auditType === 'quick' ? 'quick' : 'standard'),
        auditType: job.auditType,
      };
    });

    sendJson(res, 200, { audits: transformedAudits });
  } catch (error: any) {
    log.error('Failed to list audits:', error);
    sendError(res, 500, error.message || 'Failed to list audits');
  }
};

/**
 * PUT /api/projects/:id/components/:cid - Update component
 */
const updateComponentHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  const componentId = params?.cid;
  if (!projectId || !componentId) {
    return sendError(res, 400, 'Project ID and Component ID required');
  }

  try {
    // Check ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const body = await parseJsonBody<Record<string, unknown>>(req);

    // Prevent updating protected fields
    delete body.id;
    delete body.projectId;
    delete body.createdAt;

    const updated = await updateComponent(componentId, body);
    if (!updated) {
      return sendError(res, 404, 'Component not found');
    }

    sendJson(res, 200, updated);
  } catch (error: any) {
    log.error('Failed to update component:', error);
    sendError(res, 500, error.message || 'Failed to update component');
  }
};

/**
 * DELETE /api/projects/:id/components/:cid - Remove component
 */
const removeComponentHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  const componentId = params?.cid;
  if (!projectId || !componentId) {
    return sendError(res, 400, 'Project ID and Component ID required');
  }

  try {
    // Check ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const success = await removeComponent(componentId);
    if (!success) {
      return sendError(res, 404, 'Component not found');
    }

    sendJson(res, 200, { success: true });
  } catch (error: any) {
    log.error('Failed to remove component:', error);
    sendError(res, 500, error.message || 'Failed to remove component');
  }
};

/**
 * POST /api/projects/manual - Create manual project (no GitHub)
 */
const createManualProjectHandler: RouteHandler = async (req, res, ctx) => {
  // Manual projects don't require GitHub auth
  const userId = ctx.userId || 'anonymous';

  try {
    const body = await parseJsonBody<{
      name: string;
      description?: string;
      type?: ProjectType;
      tags?: string[];
    }>(req);

    if (!body.name) {
      return sendError(res, 400, 'name is required');
    }

    const project = await createProject({
      name: body.name,
      description: body.description,
      userId,
      type: body.type || 'contract-only',
    });
    log.info(`Created manual project: ${project.id}`);
    sendJson(res, 201, project);
  } catch (error: any) {
    log.error('Failed to create manual project:', error);
    sendError(res, 500, error.message || 'Failed to create manual project');
  }
};

/**
 * PATCH /api/projects/:id/settings - Update project branding settings
 */
const updateProjectSettingsHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Check ownership
    const existing = await getProjectById(projectId);
    if (!existing) {
      return sendError(res, 404, 'Project not found');
    }
    if (existing.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const body = await parseJsonBody<{
      logoUrl?: string;
      websiteUrl?: string;
      primaryColor?: string;
      contractAddress?: string;
      chainId?: string;
      docsUrl?: string;
      githubUrl?: string;
      twitterUrl?: string;
      discordUrl?: string;
    }>(req);

    // Validate base64 image if logoUrl is provided
    if (body.logoUrl && body.logoUrl.startsWith('data:image/')) {
      // Check size limit (2MB for base64 is roughly 2.7MB encoded)
      const base64Data = body.logoUrl.split(',')[1] || '';
      const sizeInBytes = (base64Data.length * 3) / 4;
      const maxSize = 2 * 1024 * 1024; // 2MB

      if (sizeInBytes > maxSize) {
        return sendError(res, 400, 'Logo image must be less than 2MB');
      }
    }

    // Validate color format if provided
    if (body.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(body.primaryColor)) {
      return sendError(res, 400, 'Invalid color format. Use hex format like #5C61FF');
    }

    // Update only the provided settings fields
    const updates: Record<string, unknown> = {};
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl;
    if (body.websiteUrl !== undefined) updates.websiteUrl = body.websiteUrl;
    if (body.primaryColor !== undefined) updates.primaryColor = body.primaryColor;
    if (body.contractAddress !== undefined) updates.contractAddress = body.contractAddress;
    if (body.chainId !== undefined) updates.chainId = body.chainId;
    if (body.docsUrl !== undefined) updates.docsUrl = body.docsUrl;
    if (body.githubUrl !== undefined) updates.githubUrl = body.githubUrl;
    if (body.twitterUrl !== undefined) updates.twitterUrl = body.twitterUrl;
    if (body.discordUrl !== undefined) updates.discordUrl = body.discordUrl;

    const updated = await updateProject(projectId, updates);
    if (!updated) {
      return sendError(res, 500, 'Failed to update project settings');
    }

    log.info(`Updated settings for project: ${projectId}`);
    sendJson(res, 200, { success: true, settings: updated });
  } catch (error: any) {
    log.error('Failed to update project settings:', error);
    sendError(res, 500, error.message || 'Failed to update project settings');
  }
};

/**
 * GET /api/projects/:id/flows - Get user flows and diagrams from latest audit
 */
const listProjectFlowsHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Verify project ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Get the latest completed audit for this project
    const { db } = await import('../../db/index.js');
    const { auditJobs, auditResults } = await import('../../db/schema.js');
    const { eq, and, desc } = await import('drizzle-orm');

    const latestAudit = await db
      .select({
        job: auditJobs,
        results: auditResults,
      })
      .from(auditJobs)
      .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
      .where(and(
        eq(auditJobs.projectId, projectId),
        eq(auditJobs.status, 'completed')
      ))
      .orderBy(desc(auditJobs.createdAt))
      .limit(1);

    if (latestAudit.length === 0 || !latestAudit[0].results) {
      return sendJson(res, 200, { flows: [], diagrams: [] });
    }

    const results = latestAudit[0].results;
    const metadata = results.metadata as any;

    // Extract flows and diagrams from audit results
    const flows = metadata?.userFlows || [];
    const diagrams = metadata?.userFlowDiagrams || [];

    sendJson(res, 200, { flows, diagrams });
  } catch (error: any) {
    log.error('Failed to list flows:', error);
    sendError(res, 500, error.message || 'Failed to list flows');
  }
};

/**
 * GET /api/projects/:id/badge-settings - Get badge settings
 */
const getBadgeSettingsHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Verify project ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Get badge settings from database
    const { db } = await import('../../db/index.js');
    const { badgeSettings } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const settings = await db
      .select()
      .from(badgeSettings)
      .where(eq(badgeSettings.projectId, projectId))
      .limit(1);

    if (settings.length === 0) {
      // Return default settings if none exist
      sendJson(res, 200, {
        isPublic: false,
        selectedAuditId: null,
      });
    } else {
      sendJson(res, 200, {
        isPublic: settings[0].isPublic,
        selectedAuditId: settings[0].selectedAuditId,
      });
    }
  } catch (error: any) {
    log.error('Failed to get badge settings:', error);
    sendError(res, 500, error.message || 'Failed to get badge settings');
  }
};

/**
 * PUT /api/projects/:id/badge-settings - Update badge settings
 */
const updateBadgeSettingsHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Verify project ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const body = await parseJsonBody<{
      isPublic: boolean;
      selectedAuditId?: string | null;
    }>(req);

    // Update or insert badge settings
    const { db } = await import('../../db/index.js');
    const { badgeSettings } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const existing = await db
      .select()
      .from(badgeSettings)
      .where(eq(badgeSettings.projectId, projectId))
      .limit(1);

    if (existing.length === 0) {
      // Insert new settings
      await db.insert(badgeSettings).values({
        projectId,
        isPublic: body.isPublic,
        selectedAuditId: body.selectedAuditId || null,
      });
    } else {
      // Update existing settings
      await db
        .update(badgeSettings)
        .set({
          isPublic: body.isPublic,
          selectedAuditId: body.selectedAuditId || null,
          updatedAt: new Date(),
        })
        .where(eq(badgeSettings.projectId, projectId));
    }

    sendJson(res, 200, {
      success: true,
      isPublic: body.isPublic,
      selectedAuditId: body.selectedAuditId || null,
    });
  } catch (error: any) {
    log.error('Failed to update badge settings:', error);
    sendError(res, 500, error.message || 'Failed to update badge settings');
  }
};

/**
 * GET /api/projects/:id/public-url - Get public URLs for sharing
 */
const getPublicUrlHandler: RouteHandler = async (req, res, ctx, params) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const projectId = params?.id;
  if (!projectId) {
    return sendError(res, 400, 'Project ID required');
  }

  try {
    // Verify project ownership
    const project = await getProjectById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    // Get badge settings
    const { db } = await import('../../db/index.js');
    const { badgeSettings, auditJobs } = await import('../../db/schema.js');
    const { eq, and, desc } = await import('drizzle-orm');

    const settings = await db
      .select()
      .from(badgeSettings)
      .where(eq(badgeSettings.projectId, projectId))
      .limit(1);

    if (settings.length === 0 || !settings[0].isPublic) {
      return sendJson(res, 200, {
        isPublic: false,
        message: 'Badge is not public'
      });
    }

    let selectedAuditId = settings[0].selectedAuditId;

    // If no audit selected, get the latest completed audit
    if (!selectedAuditId) {
      const latestAudits = await db
        .select()
        .from(auditJobs)
        .where(and(
          eq(auditJobs.projectId, projectId),
          eq(auditJobs.status, 'completed')
        ))
        .orderBy(desc(auditJobs.createdAt))
        .limit(1);

      if (latestAudits.length === 0) {
        return sendJson(res, 200, {
          isPublic: true,
          message: 'No completed audits available'
        });
      }

      selectedAuditId = latestAudits[0].id;
    }

    // Build URLs
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    sendJson(res, 200, {
      isPublic: true,
      publicUrl: `${baseUrl}/public-audits/${selectedAuditId}`,
      badgeUrl: `${baseUrl}/badge/${project.slug}`,
      ogImageUrl: `${baseUrl}/og-images/${selectedAuditId}.png`,
      selectedAuditId
    });

  } catch (error: any) {
    log.error('Failed to get public URL:', error);
    sendError(res, 500, error.message || 'Failed to get public URL');
  }
};

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

interface Route {
  method: string;
  pattern: string;
  handler: RouteHandler;
}

/**
 * GET /api/projects/clarification-status - Get projects with pending clarifications
 */
const getClarificationStatusHandler: RouteHandler = async (req, res, ctx) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const { db } = await import('../../db/index.js');
    const { auditClarifications, auditJobs, projects } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');

    // Find all projects with pending clarifications
    const projectsWithClarifications = await db
      .select({
        projectId: projects.id,
        jobId: auditJobs.id,
      })
      .from(auditClarifications)
      .innerJoin(auditJobs, eq(auditClarifications.jobId, auditJobs.id))
      .innerJoin(projects, eq(auditJobs.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, ctx.userId),
          eq(auditClarifications.status, 'answered')
        )
      )
      .groupBy(projects.id, auditJobs.id);

    const projectIds = [...new Set(projectsWithClarifications.map(p => p.projectId))];

    sendJson(res, 200, { projectIds });
  } catch (error: any) {
    log.error('Failed to fetch clarification status:', error);
    sendError(res, 500, error.message || 'Failed to fetch clarification status');
  }
};

const routes: Route[] = [
  { method: 'GET', pattern: '/api/projects/clarification-status', handler: getClarificationStatusHandler },
  { method: 'POST', pattern: '/api/projects', handler: createProjectHandler },
  { method: 'GET', pattern: '/api/projects', handler: listProjectsHandler },
  { method: 'GET', pattern: '/api/projects/by-slug/:slug', handler: getProjectBySlugHandler },
  { method: 'GET', pattern: '/api/projects/:id', handler: getProjectHandler },
  { method: 'PUT', pattern: '/api/projects/:id', handler: updateProjectHandler },
  { method: 'DELETE', pattern: '/api/projects/:id', handler: deleteProjectHandler },
  { method: 'PATCH', pattern: '/api/projects/:id/settings', handler: updateProjectSettingsHandler },
  { method: 'POST', pattern: '/api/projects/:id/components', handler: addComponentHandler },
  { method: 'GET', pattern: '/api/projects/:id/components', handler: listComponentsHandler },
  { method: 'GET', pattern: '/api/projects/:id/audits', handler: listProjectAuditsHandler },
  { method: 'GET', pattern: '/api/projects/:id/flows', handler: listProjectFlowsHandler },
  { method: 'GET', pattern: '/api/projects/:id/badge-settings', handler: getBadgeSettingsHandler },
  { method: 'PUT', pattern: '/api/projects/:id/badge-settings', handler: updateBadgeSettingsHandler },
  { method: 'GET', pattern: '/api/projects/:id/public-url', handler: getPublicUrlHandler },
  { method: 'PUT', pattern: '/api/projects/:id/components/:cid', handler: updateComponentHandler },
  { method: 'DELETE', pattern: '/api/projects/:id/components/:cid', handler: removeComponentHandler },
  { method: 'POST', pattern: '/api/projects/manual', handler: createManualProjectHandler },
];

// ============================================================================
// ROUTER
// ============================================================================

/**
 * Handle project API requests
 */
export async function handleProjectRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext
): Promise<boolean> {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Check if this is a project route
  if (!pathname.startsWith('/api/projects')) {
    return false;
  }

  // Find matching route
  for (const route of routes) {
    if (route.method !== method) continue;

    const params = extractPathParams(route.pattern, pathname);
    if (params !== null) {
      await route.handler(req, res, ctx, params);
      return true;
    }
  }

  // No matching route found
  sendError(res, 404, 'Not found');
  return true;
}

export default handleProjectRoutes;
