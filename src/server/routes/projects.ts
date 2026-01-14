/**
 * Project API Routes
 *
 * CRUD operations for projects and components.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from '../../utils/logger.js';
import {
  createProject,
  getProject,
  getProjectBySlug,
  listProjects,
  updateProject,
  deleteProject,
  addComponent,
  getComponent,
  updateComponent,
  removeComponent,
  updateProjectStatus,
} from '../../services/projectService.js';
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

    const input: CreateProjectInput = {
      name: body.name,
      description: body.description,
      type: body.type,
      settings: body.settings as any,
      tags: body.tags,
    };

    const project = await createProject(ctx.userId, input);
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
    const projects = await listProjects(ctx.userId);
    sendJson(res, 200, { projects });
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
    const project = await getProject(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }

    // Check ownership
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    sendJson(res, 200, project);
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

    sendJson(res, 200, { project });
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
    const existing = await getProject(projectId);
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
    const existing = await getProject(projectId);
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
    const project = await getProject(projectId);
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

    const input: AddComponentInput = {
      type: body.type as any,
      displayName: body.displayName,
      config: body.config as any,
    };

    const component = await addComponent(projectId, input);
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
    const project = await getProject(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    sendJson(res, 200, { components: project.components });
  } catch (error: any) {
    log.error('Failed to list components:', error);
    sendError(res, 500, error.message || 'Failed to list components');
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
    const project = await getProject(projectId);
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

    const updated = await updateComponent(projectId, componentId, body);
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
    const project = await getProject(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found');
    }
    if (project.userId !== ctx.userId) {
      return sendError(res, 403, 'Access denied');
    }

    const success = await removeComponent(projectId, componentId);
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

    const input: CreateProjectInput = {
      name: body.name,
      description: body.description,
      type: body.type || 'contract-only',
      tags: body.tags,
    };

    const project = await createProject(userId, input);
    log.info(`Created manual project: ${project.id}`);
    sendJson(res, 201, project);
  } catch (error: any) {
    log.error('Failed to create manual project:', error);
    sendError(res, 500, error.message || 'Failed to create manual project');
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

const routes: Route[] = [
  { method: 'POST', pattern: '/api/projects', handler: createProjectHandler },
  { method: 'GET', pattern: '/api/projects', handler: listProjectsHandler },
  { method: 'GET', pattern: '/api/projects/by-slug/:slug', handler: getProjectBySlugHandler },
  { method: 'GET', pattern: '/api/projects/:id', handler: getProjectHandler },
  { method: 'PUT', pattern: '/api/projects/:id', handler: updateProjectHandler },
  { method: 'DELETE', pattern: '/api/projects/:id', handler: deleteProjectHandler },
  { method: 'POST', pattern: '/api/projects/:id/components', handler: addComponentHandler },
  { method: 'GET', pattern: '/api/projects/:id/components', handler: listComponentsHandler },
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
