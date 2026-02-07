import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
    Shield, ChevronRight, ArrowLeft, Loader2, Play, Trash2, AlertTriangle, FileCode, Award, Package, Settings, Layers, GitBranch,
    Coins, AlertCircle, X
} from 'lucide-react'
import { ethers } from 'ethers'
import { authFetch } from '../services/authService'
import SourcesTab from '../components/project/SourcesTab'
import AuditsTab from '../components/project/AuditsTab'
import BadgeTab from '../components/project/BadgeTab'
import ComponentsTab from '../components/project/ComponentsTab'
import SettingsTab from '../components/project/SettingsTab'
import FlowsTab from '../components/project/FlowsTab'
import { fetchGitHubBranches } from '../services/githubService'
import { useNeuronsBalance, approveNeurons } from '../hooks/useNeuronsBalance'
import { neuronsToWei, UATU_OPERATOR_ADDRESS } from '../../../src/constants/neuronsToken'

// Declare window.ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

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
    logoUrl?: string
    websiteUrl?: string
    primaryColor?: string
    contractAddress?: string
    chainId?: string
    docsUrl?: string
    githubUrl?: string
    twitterUrl?: string
    discordUrl?: string
}

type TabType = 'sources' | 'audits' | 'flows' | 'components' | 'badge' | 'settings'

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
    const [showAuditOptions, setShowAuditOptions] = useState(false)
    const [auditDepth, setAuditDepth] = useState<'quick' | 'standard' | 'deep'>('standard')
    const [auditVisibility, setAuditVisibility] = useState<'private' | 'public'>('private')
    const [selectedBranch, setSelectedBranch] = useState<string>('')
    const [selectedComponentId, setSelectedComponentId] = useState<string>('')
    const [availableBranches, setAvailableBranches] = useState<string[]>([])
    const [loadingBranches, setLoadingBranches] = useState(false)

    // Payment state
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentStep, setPaymentStep] = useState<'estimate' | 'approve' | 'confirming'>('estimate')
    const [estimatedCost, setEstimatedCost] = useState<number>(0)
    const [reservationAmount, setReservationAmount] = useState<number>(0)
    const [paymentError, setPaymentError] = useState<string | null>(null)
    const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null)

    // Web3 state
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)

    const { balance, balanceRaw } = useNeuronsBalance(walletAddress, provider)

    // Initialize Web3
    useEffect(() => {
        const initWeb3 = async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const browserProvider = new ethers.BrowserProvider(window.ethereum)
                    const accounts = await browserProvider.send('eth_accounts', [])
                    if (accounts && accounts.length > 0) {
                        const userSigner = await browserProvider.getSigner()
                        setProvider(browserProvider)
                        setSigner(userSigner)
                        setWalletAddress(accounts[0])
                    }
                } catch (err) {
                    console.error('Failed to initialize Web3:', err)
                }
            }
        }

        initWeb3()

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length > 0) {
                    setWalletAddress(accounts[0])
                } else {
                    setWalletAddress(null)
                    setSigner(null)
                }
            })
        }
    }, [])

    const loadBranchesForComponent = async (componentId: string) => {
        const component = project?.components.find(c => c.id === componentId)
        if (!component || component.type !== 'github-repo') {
            setAvailableBranches([])
            return
        }

        const config = component.config as any
        if (!config.owner || !config.repo) {
            setAvailableBranches([])
            return
        }

        setLoadingBranches(true)
        try {
            const branches = await fetchGitHubBranches(config.owner, config.repo)
            setAvailableBranches(branches)

            // Auto-select default branch if not already selected
            if (!selectedBranch && config.defaultBranch && branches.includes(config.defaultBranch)) {
                setSelectedBranch(config.defaultBranch)
            } else if (!selectedBranch && branches.length > 0) {
                // If no default, select first branch
                setSelectedBranch(branches[0])
            } else if (!selectedBranch) {
                // Fallback to 'main'
                setSelectedBranch('main')
            }
        } catch (error) {
            console.error('Failed to load branches:', error)
            setAvailableBranches([])
            // Auto-set default branch on error
            if (!selectedBranch && config.defaultBranch) {
                setSelectedBranch(config.defaultBranch)
            } else if (!selectedBranch) {
                setSelectedBranch('main')
            }
        } finally {
            setLoadingBranches(false)
        }
    }

    const handleStartAudit = async () => {
        if (!project || !project.components || project.components.length === 0) {
            setAuditError('No components configured')
            return
        }

        // Check wallet
        if (!walletAddress || !signer) {
            setAuditError('Please connect your Web3 wallet to pay for audits with Neurons tokens')
            return
        }

        // Show payment modal and estimate cost
        setShowPaymentModal(true)
        setPaymentStep('estimate')
        setPaymentError(null)

        try {
            // Estimate cost
            const estimateRes = await authFetch('/api/payments/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectType: auditDepth,
                    sloc: auditDepth === 'quick' ? 500 : auditDepth === 'standard' ? 3000 : 5000,
                    aiTokens: auditDepth === 'quick' ? 50000 : auditDepth === 'standard' ? 300000 : 600000,
                }),
            })

            if (!estimateRes.ok) {
                const error = await estimateRes.json()
                throw new Error(error.error || 'Failed to estimate cost')
            }

            const estimate = await estimateRes.json()
            setEstimatedCost(estimate.totalEstimatedCostNeurons)
            setReservationAmount(estimate.reservationAmount)

            console.log('[PAYMENT] Cost estimated:', {
                estimated: estimate.totalEstimatedCostNeurons,
                reservation: estimate.reservationAmount,
                userBalance: balance,
            })

            // Check balance
            // Balance check is now handled in UI - insufficient balance shows "Add More Neurons" button

            // Move to approve step
            setPaymentStep('approve')
        } catch (err: any) {
            console.error('[PAYMENT] Failed to estimate cost:', err)
            setPaymentError(err.message || 'Failed to estimate audit cost')
        }
    }

    const handleApproveSpending = async () => {
        if (!signer || !walletAddress) {
            setPaymentError('Wallet not connected')
            return
        }

        setPaymentError(null)

        try {
            console.log('[PAYMENT] Requesting approval for', reservationAmount, 'Neurons')

            // Add 2% buffer to handle rounding issues (approve slightly more than needed)
            const approvalAmount = Math.ceil(reservationAmount * 1.02)
            console.log('[PAYMENT] Approval amount with 2% buffer:', approvalAmount, 'Neurons')

            const amountWei = neuronsToWei(approvalAmount)
            const txHash = await approveNeurons(signer, UATU_OPERATOR_ADDRESS, amountWei)

            console.log('[PAYMENT] Approval transaction sent:', txHash)
            setApprovalTxHash(txHash)
            setPaymentStep('confirming')

            // Wait for transaction to be mined and state to update (3 seconds)
            console.log('[PAYMENT] Waiting for transaction confirmation...')
            await new Promise(resolve => setTimeout(resolve, 3000))

            // Now actually start the audit with payment data
            await handleStartAuditWithPayment(txHash)
        } catch (error: any) {
            console.error('[PAYMENT] Approval failed:', error)
            if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
                // User rejected the transaction or network switch
                setPaymentError('Transaction canceled. Please try again and approve in MetaMask.')
            } else if (error.message?.includes('switch to BNB Chain') || error.message?.includes('add BNB Chain')) {
                // Network switch or add failed
                setPaymentError(error.message)
            } else if (error.code === -32002) {
                // MetaMask already has a pending request
                setPaymentError('Please check MetaMask - there is a pending request waiting for your approval.')
            } else {
                setPaymentError(error.message || 'Failed to approve spending')
            }
            setPaymentStep('approve') // Go back to approve step so user can try again
        }
    }

    const handleStartAuditWithPayment = async (txHash: string) => {
        setStartingAudit(true)
        setAuditError(null)

        try {
            if (!project) {
                throw new Error('Project not found')
            }

            // Get stored GitHub token for private repo access
            const githubToken = localStorage.getItem('github_pat')

            // Get the selected component or first component
            const componentId = selectedComponentId || project.components[0].id
            const component = project.components.find(c => c.id === componentId) || project.components[0]

            // Build source object based on component type
            let source: any

            if (component.type === 'github-repo') {
                const config = component.config as any
                const branchToUse = selectedBranch || config.currentBranch || config.defaultBranch || 'main'
                source = {
                    type: 'github-repo',
                    owner: config.owner,
                    repo: config.repo,
                    branch: branchToUse,
                    repoUrl: config.cloneUrl,
                    includePaths: config.includePaths,
                    excludePaths: config.excludePaths,
                    accessToken: githubToken || undefined
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

            // Start the audit with payment data
            console.log('🚀 Starting audit with payment:', { depth: auditDepth, txHash })
            const response = await authFetch('/api/audit/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source,
                    depth: auditDepth,
                    visibility: auditVisibility,
                    projectId: project.id,
                    // Payment data
                    paymentApprovalTxHash: txHash,
                    walletAddress,
                    estimatedSloc: auditDepth === 'quick' ? 500 : auditDepth === 'standard' ? 3000 : 5000,
                    estimatedAiTokens: auditDepth === 'quick' ? 50000 : auditDepth === 'standard' ? 300000 : 600000,
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to start audit')
            }

            const result = await response.json()

            if (result.success && result.jobId) {
                // Close modal and navigate
                setShowPaymentModal(false)
                navigate(`/audit/${result.jobId}`)
            } else {
                throw new Error(result.error || 'Failed to start audit')
            }
        } catch (err: any) {
            console.error('Failed to start audit:', err)
            setAuditError(err.message || 'Failed to start audit')
            setPaymentError(err.message || 'Failed to start audit')
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

    // Auto-load branches when modal opens for GitHub repos
    useEffect(() => {
        if (showAuditOptions && project?.components && project.components.length > 0) {
            const firstComponent = project.components[0]
            if (firstComponent.type === 'github-repo') {
                setSelectedComponentId(firstComponent.id)
                loadBranchesForComponent(firstComponent.id)
            }
        }
    }, [showAuditOptions, project])

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

            {/* Audit Options Modal */}
            {showAuditOptions && (
                <div className="fixed inset-y-0 left-64 right-0 bg-black/30 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-slate-200">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">Start Audit</h3>
                            <p className="text-sm text-slate-500 mt-0.5">Configure audit parameters</p>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Component Selection (if multiple) */}
                            {project.components && project.components.length > 1 && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                                        Source Component
                                    </label>
                                    <div className="space-y-2">
                                        {project.components.map((component) => {
                                            const isSelected = selectedComponentId === component.id || (!selectedComponentId && component.id === project.components[0].id)
                                            return (
                                                <button
                                                    key={component.id}
                                                    onClick={() => {
                                                        setSelectedComponentId(component.id)
                                                        loadBranchesForComponent(component.id)
                                                    }}
                                                    className={`w-full px-3 py-2.5 rounded-md text-left transition-all border ${
                                                        isSelected
                                                            ? 'bg-indigo-600 border-indigo-600'
                                                            : 'bg-white border-slate-300 hover:border-slate-400'
                                                    }`}
                                                >
                                                    <div className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                                        {component.displayName}
                                                    </div>
                                                    <div className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                                        {component.type}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Branch Selection (GitHub repos only) */}
                            {(() => {
                                const selectedComponent = project.components.find(c => c.id === selectedComponentId) || project.components[0]
                                return selectedComponent?.type === 'github-repo' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                                            Branch
                                        </label>
                                        {loadingBranches ? (
                                            <div className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center gap-2 text-xs text-slate-500">
                                                <Loader2 size={14} className="animate-spin" />
                                                Loading...
                                            </div>
                                        ) : availableBranches.length > 0 ? (
                                            <>
                                                <select
                                                    value={selectedBranch}
                                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                                    className="w-full px-3 py-2.5 rounded-md border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                >
                                                    {availableBranches.map((branch) => (
                                                        <option key={branch} value={branch}>
                                                            {branch}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-slate-500 mt-1.5">
                                                    {availableBranches.length} branch{availableBranches.length !== 1 ? 'es' : ''} available
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    type="text"
                                                    value={selectedBranch}
                                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                                    placeholder={(selectedComponent.config as any)?.defaultBranch || 'main'}
                                                    className="w-full px-3 py-2.5 rounded-md border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
                                                />
                                                <p className="text-xs text-slate-500 mt-1.5">
                                                    Default: {(selectedComponent.config as any)?.defaultBranch || 'main'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Audit Depth */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-2">
                                    Audit Depth
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'quick', label: 'Quick', desc: '~10 min' },
                                        { value: 'standard', label: 'Standard', desc: '~30 min' },
                                        { value: 'deep', label: 'Deep', desc: '~2 hours' },
                                    ].map((depth) => {
                                        const isSelected = auditDepth === depth.value
                                        return (
                                            <button
                                                key={depth.value}
                                                onClick={() => setAuditDepth(depth.value as any)}
                                                className={`px-3 py-2.5 rounded-md text-center transition-all border ${
                                                    isSelected
                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                        : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                                                }`}
                                            >
                                                <div className="text-sm font-semibold">{depth.label}</div>
                                                <div className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                                    {depth.desc}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Visibility */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-2">
                                    Visibility
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'private', label: 'Private', desc: 'Only you' },
                                        { value: 'public', label: 'Public', desc: 'Anyone' },
                                    ].map((visibility) => {
                                        const isSelected = auditVisibility === visibility.value
                                        return (
                                            <button
                                                key={visibility.value}
                                                onClick={() => setAuditVisibility(visibility.value as any)}
                                                className={`px-3 py-2.5 rounded-md text-left transition-all border ${
                                                    isSelected
                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                        : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                                                }`}
                                            >
                                                <div className="text-sm font-semibold">{visibility.label}</div>
                                                <div className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                                    {visibility.desc}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAuditOptions(false)
                                    setSelectedComponentId('')
                                    setSelectedBranch('')
                                    setAvailableBranches([])
                                }}
                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md font-medium text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowAuditOptions(false)
                                    handleStartAudit()
                                }}
                                disabled={startingAudit}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {startingAudit ? 'Starting...' : 'Start Audit'}
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
                            onClick={() => setShowAuditOptions(true)}
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
                        onClick={() => setActiveTab('flows')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
                            activeTab === 'flows'
                                ? 'text-indigo-600'
                                : 'text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <GitBranch size={16} />
                        Flows
                        {activeTab === 'flows' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('components')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
                            activeTab === 'components'
                                ? 'text-indigo-600'
                                : 'text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <Layers size={16} />
                        Components
                        {activeTab === 'components' && (
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
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all relative ${
                            activeTab === 'settings'
                                ? 'text-indigo-600'
                                : 'text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <Settings size={16} />
                        Settings
                        {activeTab === 'settings' && (
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
                    {activeTab === 'flows' && (
                        <FlowsTab projectId={project.id} />
                    )}
                    {activeTab === 'components' && (
                        <ComponentsTab projectId={project.id} />
                    )}
                    {activeTab === 'badge' && (
                        <BadgeTab
                            projectId={project.id}
                            projectSlug={project.slug}
                            projectName={project.name}
                            primaryColor={project.primaryColor}
                            logoUrl={project.logoUrl}
                        />
                    )}
                    {activeTab === 'settings' && (
                        <SettingsTab
                            projectId={project.id}
                            projectSlug={project.slug}
                            projectName={project.name}
                            initialSettings={{
                                logoUrl: project.logoUrl,
                                websiteUrl: project.websiteUrl,
                                primaryColor: project.primaryColor,
                                docsUrl: project.docsUrl,
                                githubUrl: project.githubUrl,
                                twitterUrl: project.twitterUrl,
                                discordUrl: project.discordUrl
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Payment Approval Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-100 rounded-full">
                                    <Coins className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900">Audit Payment</h2>
                            </div>
                            {paymentStep === 'approve' && (
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            )}
                        </div>

                        {/* Error Display */}
                        {paymentError && (
                            <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-red-900">Error</p>
                                    <p className="text-sm text-red-700 mt-1">{paymentError}</p>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Estimating */}
                        {paymentStep === 'estimate' && (
                            <div className="text-center py-8">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                                <p className="text-lg font-semibold text-slate-900">Calculating Cost...</p>
                                <p className="text-sm text-slate-500 mt-2">Estimating audit requirements</p>
                            </div>
                        )}

                        {/* Step 2: Approve Spending */}
                        {paymentStep === 'approve' && (
                            <div className="space-y-6">
                                {/* Cost Breakdown */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Estimated Cost:</span>
                                        <span className="font-bold text-slate-900">{estimatedCost.toFixed(2)} Neurons</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Safety Buffer (50%):</span>
                                        <span className="font-bold text-slate-900">{(reservationAmount - estimatedCost).toFixed(2)} Neurons</span>
                                    </div>
                                    <div className="h-px bg-slate-200"></div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900">Total Approval:</span>
                                        <span className="text-2xl font-black text-indigo-600">{reservationAmount.toFixed(2)} Neurons</span>
                                    </div>
                                </div>

                                {/* Balance Display */}
                                <div className={`p-4 rounded-lg ${
                                    balanceRaw !== null && balanceRaw < neuronsToWei(reservationAmount)
                                        ? 'bg-amber-50 border-2 border-amber-200'
                                        : 'bg-slate-50'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-600">Your Balance:</span>
                                        <span className={`text-lg font-bold ${
                                            balanceRaw !== null && balanceRaw < neuronsToWei(reservationAmount)
                                                ? 'text-amber-700'
                                                : 'text-slate-900'
                                        }`}>
                                            {balance !== null ? `${balance.toFixed(2)} Neurons` : 'Loading...'}
                                        </span>
                                    </div>
                                    {balanceRaw !== null && balanceRaw < neuronsToWei(reservationAmount) && (
                                        <div className="mt-3 pt-3 border-t border-amber-200">
                                            <p className="text-sm text-amber-800">
                                                <strong>Insufficient Balance</strong> - You need {(Number(neuronsToWei(reservationAmount) - balanceRaw) / 1e18).toFixed(2)} more Neurons
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Info Note - Only show when balance is sufficient */}
                                {balanceRaw !== null && balanceRaw >= neuronsToWei(reservationAmount) && (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs text-blue-900">
                                            <strong>Note:</strong> We'll only charge the exact amount after your audit completes.
                                            Any unused approval stays in your wallet.
                                        </p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>

                                    {balanceRaw !== null && balanceRaw < neuronsToWei(reservationAmount) ? (
                                        <a
                                            href="https://pancakeswap.finance/swap?outputCurrency=0xE5251763988DcF2065cc67f085f9E131E2f81918&chainId=56"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <Coins className="w-5 h-5" />
                                            Add More Neurons
                                        </a>
                                    ) : (
                                        <button
                                            onClick={handleApproveSpending}
                                            disabled={!balanceRaw}
                                            className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Approve in Wallet
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Confirming */}
                        {paymentStep === 'confirming' && (
                            <div className="text-center py-8">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                </div>
                                <p className="text-lg font-semibold text-slate-900">Confirming Payment...</p>
                                <p className="text-sm text-slate-500 mt-2">Starting your audit</p>
                                {approvalTxHash && (
                                    <p className="text-xs text-slate-400 mt-4 font-mono break-all px-4">
                                        {approvalTxHash}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
