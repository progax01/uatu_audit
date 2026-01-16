import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
    Shield, ChevronRight, ArrowLeft, Loader2, Play, Trash2, AlertTriangle, FileCode, Award, Package
} from 'lucide-react'
import { authFetch } from '../services/authService'
import SourcesTab from '../components/project/SourcesTab'
import AuditsTab from '../components/project/AuditsTab'
import BadgeTab from '../components/project/BadgeTab'

interface Project {
    id: string
    name: string
    slug: string
    type: string
    status: string
    description?: string
    components: {
        id: string
        type: string
        displayName: string
        config: any
    }[]
    lastAuditAt?: string
    lastAuditJobId?: string
}

type TabType = 'sources' | 'audits' | 'badge'

export default function ProjectDetails() {
    const { slug } = useParams()
    const navigate = useNavigate()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [activeTab, setActiveTab] = useState<TabType>('sources')
    const [startingAudit, setStartingAudit] = useState(false)
    const [auditError, setAuditError] = useState<string | null>(null)
    const [runningJobId, setRunningJobId] = useState<string | null>(null)

    const handleStartAudit = async () => {
        if (!project || !project.components || project.components.length === 0) {
            setAuditError('No components configured')
            return
        }

        setStartingAudit(true)
        setAuditError(null)

        try {
            // Get the first component (for now, we'll handle multi-component later)
            const component = project.components[0]

            // Build source object based on component type
            let source: any

            if (component.type === 'github-repo') {
                const config = component.config as any
                source = {
                    type: 'github-repo',
                    owner: config.owner,
                    repo: config.repo,
                    branch: config.currentBranch || config.defaultBranch,
                    repoUrl: config.cloneUrl,
                    includePaths: config.includePaths,
                    excludePaths: config.excludePaths
                }
            } else if (component.type === 'deployed-contract') {
                const config = component.config as any
                source = {
                    type: 'deployed-contract',
                    address: config.address,
                    network: config.network,
                    chainId: config.chainId
                }
            } else if (component.type === 'manual-upload') {
                const config = component.config as any
                source = {
                    type: 'manual-upload',
                    uploadId: config.uploadId,
                    files: config.files
                }
            } else {
                throw new Error(`Unsupported component type: ${component.type}`)
            }

            // Start the audit
            // Note: Don't send projectId for file-based projects since they don't exist in the database
            const response = await authFetch('/api/audit/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source,
                    depth: 'standard', // Default to standard audit
                    visibility: 'private',
                    // projectId: project.id  // Omitted - file-based projects aren't in DB
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to start audit')
            }

            const result = await response.json()

            if (result.success && result.jobId) {
                // Save running job ID and switch to audits tab
                setRunningJobId(result.jobId)
                setActiveTab('audits')
            } else {
                throw new Error(result.error || 'Failed to start audit')
            }
        } catch (err: any) {
            console.error('Failed to start audit:', err)
            setAuditError(err.message || 'Failed to start audit')
        } finally {
            setStartingAudit(false)
        }
    }

    const handleDelete = async () => {
        if (!project) return
        setDeleting(true)
        try {
            const response = await authFetch(`/api/projects/${project.id}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                navigate('/dashboard')
            } else {
                setError('Failed to delete project')
            }
        } catch (err) {
            setError('Failed to delete project')
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    const fetchProject = async () => {
        try {
            const response = await authFetch(`/api/projects/by-slug/${slug}`)
            if (response.ok) {
                const data = await response.json()
                setProject(data.project)
            } else {
                setError('Project not found')
            }
        } catch (err) {
            setError('Failed to load project')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (slug) {
            fetchProject()
        }
    }, [slug])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-6">
                    <Loader2 size={32} className="animate-spin text-indigo-600" />
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Loading Project...</span>
                </div>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="space-y-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.15em]"
                >
                    <ArrowLeft size={14} />
                    Back to Projects
                </button>

                <div className="card-premium text-center py-16">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
                        <Shield size={32} className="text-slate-300" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-2">Project Not Found</h2>
                    <p className="text-sm text-slate-400 mb-8">This project doesn't exist or you don't have access to it.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn-primary px-8 py-3 mx-auto"
                    >
                        Go to Dashboard
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        )
    }

    const STATUS_CONFIG: Record<string, { label: string; colorClass: string }> = {
        'draft': { label: 'NOT CONFIGURED', colorClass: 'text-slate-400 bg-slate-100 border-slate-200' },
        'configured': { label: 'READY', colorClass: 'text-blue-600 bg-blue-50 border-blue-100' },
        'awaiting-preaudit': { label: 'PENDING', colorClass: 'text-amber-600 bg-amber-50 border-amber-100' },
        'auditing': { label: 'AUDITING', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100 animate-pulse' },
        'completed': { label: 'COMPLETED', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
    }

    return (
        <div className="space-y-4">
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
                        <div className="w-14 h-14 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-5">
                            <AlertTriangle size={28} className="text-rose-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Project?</h3>
                        <p className="text-sm text-slate-500 text-center mb-8">
                            This will permanently delete <span className="font-bold text-slate-700">"{project.name}"</span> and all associated data. This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Row: Back Button | Project Name | Actions */}
            <div className="flex items-center justify-between gap-4">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.15em] flex-shrink-0"
                >
                    <ArrowLeft size={14} />
                    Back to Projects
                </button>

                {/* Separator */}
                <div className="h-10 w-px bg-black/[0.05] flex-shrink-0" />

                {/* Project Name with Status */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tighter truncate">{project.name}</h1>
                        <div className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${STATUS_CONFIG[project.status]?.colorClass || 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                            {STATUS_CONFIG[project.status]?.label || project.status}
                        </div>
                    </div>
                    {project.description && (
                        <p className="text-slate-400 text-xs mt-1 truncate">{project.description}</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2.5 rounded-lg border border-black/[0.03] text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 transition-all"
                        title="Delete project"
                    >
                        <Trash2 size={16} />
                    </button>
                    {project.components && project.components.length > 0 && (
                        <button
                            onClick={handleStartAudit}
                            disabled={startingAudit}
                            className="btn-primary px-4 py-2.5 text-xs"
                        >
                            {startingAudit ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play size={14} />
                                    Start Audit
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {auditError && (
                <div className="card-premium !bg-rose-50 !border-rose-200 p-4 flex items-start gap-3">
                    <AlertTriangle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-rose-900 mb-1">Failed to Start Audit</h4>
                        <p className="text-xs text-rose-700">{auditError}</p>
                    </div>
                    <button
                        onClick={() => setAuditError(null)}
                        className="text-rose-400 hover:text-rose-600"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Tabs Row */}
            <div className="space-y-4">
                {/* Tab Navigation */}
                <div className="flex items-center gap-2 border-b border-black/[0.05]">
                    <button
                        onClick={() => setActiveTab('sources')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
                            activeTab === 'sources'
                                ? 'text-indigo-600'
                                : 'text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <FileCode size={16} />
                        Sources
                        {activeTab === 'sources' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('audits')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
                            activeTab === 'audits'
                                ? 'text-indigo-600'
                                : 'text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <Package size={16} />
                        Audits
                        {activeTab === 'audits' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('badge')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
                            activeTab === 'badge'
                                ? 'text-indigo-600'
                                : 'text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <Award size={16} />
                        Badge
                        {activeTab === 'badge' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                        )}
                    </button>
                </div>

                {/* Tab Content */}
                <div>
                    {activeTab === 'sources' && (
                        <SourcesTab
                            projectId={project.id}
                            components={project.components || []}
                            onComponentAdded={fetchProject}
                        />
                    )}
                    {activeTab === 'audits' && (
                        <AuditsTab
                            projectId={project.id}
                            runningJobId={runningJobId}
                            onAuditComplete={() => setRunningJobId(null)}
                        />
                    )}
                    {activeTab === 'badge' && (
                        <BadgeTab
                            projectId={project.id}
                            projectSlug={project.slug}
                            projectName={project.name}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
