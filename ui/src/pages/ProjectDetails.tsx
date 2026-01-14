import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
    Shield, ChevronRight, ArrowLeft, Loader2, FileCode, Github, GitBranch, Play, Trash2, Plus, AlertTriangle
} from 'lucide-react'
import { authFetch } from '../services/authService'

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

export default function ProjectDetails() {
    const { slug } = useParams()
    const navigate = useNavigate()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

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

    useEffect(() => {
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
        <div className="space-y-10">
            {/* Back Button */}
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.15em]"
            >
                <ArrowLeft size={14} />
                Back to Projects
            </button>

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

            {/* Hero */}
            <div className="flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${STATUS_CONFIG[project.status]?.colorClass || 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                            {STATUS_CONFIG[project.status]?.label || project.status}
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">{project.name}</h1>
                    {project.description && (
                        <p className="text-slate-400 mt-2 text-sm">{project.description}</p>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-3 rounded-xl border border-black/[0.03] text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 transition-all"
                        title="Delete project"
                    >
                        <Trash2 size={18} />
                    </button>
                    {project.components && project.components.length > 0 && (
                        <button
                            onClick={() => navigate(`/preaudit-questionnaire/${project.lastAuditJobId || 'new'}`)}
                            className="btn-primary px-6 py-3"
                        >
                            <Play size={14} />
                            Start Audit
                        </button>
                    )}
                </div>
            </div>

            {/* Components */}
            <div className="space-y-6">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Connected Sources</h2>

                {project.components && project.components.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {project.components.map((component) => (
                            <div key={component.id} className="card-premium !p-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                                        {component.type === 'github-repo' ? (
                                            <Github size={20} className="text-slate-400" />
                                        ) : (
                                            <FileCode size={20} className="text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-slate-900 truncate">{component.displayName}</h3>
                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                            {component.config?.currentBranch && (
                                                <>
                                                    <GitBranch size={12} />
                                                    <span>{component.config.currentBranch}</span>
                                                </>
                                            )}
                                            {component.config?.role && (
                                                <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold uppercase">
                                                    {component.config.role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card-premium text-center py-12">
                        <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={24} className="text-amber-500" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 mb-2">Incomplete Setup</h3>
                        <p className="text-xs text-slate-400 mb-6 max-w-sm mx-auto">
                            This project was created but no sources were connected. Add a repository or contract to continue, or delete this project.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => {
                                    localStorage.setItem('pending_project', JSON.stringify({
                                        id: project.id,
                                        name: project.name,
                                        type: project.type
                                    }))
                                    navigate('/add-components')
                                }}
                                className="btn-primary px-6 py-3"
                            >
                                <Plus size={14} />
                                Connect Source
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center gap-2"
                            >
                                <Trash2 size={14} />
                                Delete Project
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
