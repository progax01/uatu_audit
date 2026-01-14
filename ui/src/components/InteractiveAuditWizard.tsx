import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  X,
  Shield,
  Clock,
  Mail,
  Link2,
  Wallet,
  AlertTriangle,
  ChevronRight,
  Settings,
  Zap,
  Layers,
} from 'lucide-react'

// Types
type AuditDepth = 'quick' | 'standard' | 'deep'
type AddressType = 'eoa' | 'multisig' | 'timelock' | 'governance' | 'treasury' | 'oracle' | 'protocol' | 'renounced' | 'unknown'
type ProjectRelationship = 'admin' | 'governance' | 'timelock' | 'dependency' | 'integration' | 'proxy' | 'implementation' | 'oracle'

interface LinkedProject {
  id: string
  name: string
  sourceType: 'github-repo' | 'deployed-contract'
  sourceConfig: {
    repoUrl?: string
    contractAddress?: string
    chain?: string
  }
  relationship: ProjectRelationship
  relevantContracts?: string[]
}

interface KnownAddress {
  id: string
  address: string
  chain: string
  label: string
  addressType: AddressType
  metadata?: {
    threshold?: number
    totalSigners?: number
    walletType?: string
    timelockDuration?: string
  }
}

interface InteractiveConfig {
  interactiveMode: boolean
  auditDepth: AuditDepth
  autoContinueTimeoutSeconds: number
  notificationEmail: string
  notifyOnCompletion: boolean
  notifyOnInputNeeded: boolean
  notifyOnCriticalFinding: boolean
  linkedProjects: LinkedProject[]
  knownAddresses: KnownAddress[]
}

interface InteractiveAuditWizardProps {
  jobId?: string
  initialConfig?: Partial<InteractiveConfig>
  onComplete: (config: InteractiveConfig) => void
  onCancel: () => void
}

const AUDIT_DEPTHS: { id: AuditDepth; label: string; description: string; duration: string; features: string[] }[] = [
  {
    id: 'quick',
    label: 'Quick Scan',
    description: 'Fast automated analysis with basic tool coverage',
    duration: '5-10 min',
    features: ['Static analysis', 'Common vulnerability patterns', 'Basic severity assessment'],
  },
  {
    id: 'standard',
    label: 'Standard Audit',
    description: 'Comprehensive analysis with AI-powered review',
    duration: '30-60 min',
    features: ['Full tool suite', 'AI vulnerability validation', 'Business logic analysis', 'Interactive prompts'],
  },
  {
    id: 'deep',
    label: 'Deep Audit',
    description: 'Thorough analysis with manual-grade AI review',
    duration: '2-4 hours',
    features: ['Extended tool analysis', 'Multiple AI passes', 'Cross-contract analysis', 'Detailed recommendations'],
  },
]

const ADDRESS_TYPES: { id: AddressType; label: string; icon: ReactNode }[] = [
  { id: 'eoa', label: 'EOA (Single Key)', icon: <Wallet size={14} /> },
  { id: 'multisig', label: 'Multisig Wallet', icon: <Shield size={14} /> },
  { id: 'timelock', label: 'Timelock Contract', icon: <Clock size={14} /> },
  { id: 'governance', label: 'Governance', icon: <Layers size={14} /> },
  { id: 'treasury', label: 'Treasury', icon: <Wallet size={14} /> },
  { id: 'oracle', label: 'Oracle', icon: <Zap size={14} /> },
  { id: 'protocol', label: 'Protocol Contract', icon: <Settings size={14} /> },
  { id: 'renounced', label: 'Renounced', icon: <X size={14} /> },
]

const RELATIONSHIPS: { id: ProjectRelationship; label: string; description: string }[] = [
  { id: 'admin', label: 'Admin Contract', description: 'Administrative control over the main contract' },
  { id: 'governance', label: 'Governance', description: 'On-chain governance module' },
  { id: 'timelock', label: 'Timelock', description: 'Time-delayed execution contract' },
  { id: 'dependency', label: 'Dependency', description: 'External contract the main contract depends on' },
  { id: 'integration', label: 'Integration', description: 'Contract that integrates with the main contract' },
  { id: 'proxy', label: 'Proxy', description: 'Proxy contract for upgradability' },
  { id: 'implementation', label: 'Implementation', description: 'Implementation behind a proxy' },
  { id: 'oracle', label: 'Oracle', description: 'Price or data oracle' },
]

const CHAINS = [
  'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche', 'fantom', 'solana', 'other'
]

export default function InteractiveAuditWizard({
  jobId: _jobId,
  initialConfig,
  onComplete,
  onCancel,
}: InteractiveAuditWizardProps) {
  // Note: _jobId reserved for future use (loading existing config)
  const [step, setStep] = useState(1)
  const totalSteps = 4

  // Config state
  const [config, setConfig] = useState<InteractiveConfig>({
    interactiveMode: true,
    auditDepth: 'standard',
    autoContinueTimeoutSeconds: 300,
    notificationEmail: '',
    notifyOnCompletion: true,
    notifyOnInputNeeded: true,
    notifyOnCriticalFinding: true,
    linkedProjects: [],
    knownAddresses: [],
    ...initialConfig,
  })

  // Modal states
  const [showAddProject, setShowAddProject] = useState(false)
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [newProject, setNewProject] = useState<Partial<LinkedProject>>({})
  const [newAddress, setNewAddress] = useState<Partial<KnownAddress>>({})

  // Step 1: Audit Depth & Mode
  const renderStep1 = () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Select Audit Depth</h3>
        <p className="text-sm text-slate-500 mb-6">Choose how thorough the audit should be</p>

        <div className="grid grid-cols-3 gap-4">
          {AUDIT_DEPTHS.map((depth) => (
            <button
              key={depth.id}
              onClick={() => setConfig({ ...config, auditDepth: depth.id })}
              className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                config.auditDepth === depth.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {config.auditDepth === depth.id && (
                <div className="absolute top-4 right-4">
                  <Check size={18} className="text-indigo-600" />
                </div>
              )}
              <div className="font-semibold text-slate-900 mb-1">{depth.label}</div>
              <div className="text-xs text-slate-500 mb-3">{depth.duration}</div>
              <div className="text-sm text-slate-600 mb-4">{depth.description}</div>
              <ul className="space-y-1">
                {depth.features.map((feature, i) => (
                  <li key={i} className="text-xs text-slate-500 flex items-center gap-2">
                    <div className="w-1 h-1 bg-indigo-400 rounded-full" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Interactive Mode</h3>
            <p className="text-sm text-slate-500">AI will pause to ask clarifying questions during analysis</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, interactiveMode: !config.interactiveMode })}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              config.interactiveMode ? 'bg-indigo-500' : 'bg-slate-300'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.interactiveMode ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {config.interactiveMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Important:</strong> The AI will pause for your input when it discovers admin addresses,
              external dependencies, or needs clarification about your protocol. If you don't respond within
              the timeout period, it will use safe default assumptions.
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Step 2: Linked Projects
  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Linked Projects</h3>
        <p className="text-sm text-slate-500">
          Add related contracts or projects that work together with the main contract being audited
        </p>
      </div>

      {config.linkedProjects.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <Link2 size={32} className="mx-auto text-slate-300 mb-4" />
          <div className="text-slate-500 mb-4">No linked projects yet</div>
          <button
            onClick={() => setShowAddProject(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Add Project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {config.linkedProjects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Link2 size={18} className="text-indigo-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">{project.name}</div>
                  <div className="text-sm text-slate-500">
                    {project.sourceType === 'github-repo' ? project.sourceConfig.repoUrl : project.sourceConfig.contractAddress}
                    <span className="mx-2">•</span>
                    <span className="text-indigo-600 font-medium">{project.relationship}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    linkedProjects: config.linkedProjects.filter((p) => p.id !== project.id),
                  })
                }
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowAddProject(true)}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <Plus size={16} />
            Add Another Project
          </button>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-xl font-semibold mb-6">Add Linked Project</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
                <input
                  type="text"
                  value={newProject.name || ''}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g., Admin Multisig"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Source Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewProject({ ...newProject, sourceType: 'deployed-contract' })}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      newProject.sourceType === 'deployed-contract'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Deployed Contract
                  </button>
                  <button
                    onClick={() => setNewProject({ ...newProject, sourceType: 'github-repo' })}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      newProject.sourceType === 'github-repo'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    GitHub Repo
                  </button>
                </div>
              </div>

              {newProject.sourceType === 'deployed-contract' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Contract Address</label>
                    <input
                      type="text"
                      value={newProject.sourceConfig?.contractAddress || ''}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          sourceConfig: { ...newProject.sourceConfig, contractAddress: e.target.value },
                        })
                      }
                      placeholder="0x..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Chain</label>
                    <select
                      value={newProject.sourceConfig?.chain || ''}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          sourceConfig: { ...newProject.sourceConfig, chain: e.target.value },
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select chain...</option>
                      {CHAINS.map((chain) => (
                        <option key={chain} value={chain}>
                          {chain.charAt(0).toUpperCase() + chain.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {newProject.sourceType === 'github-repo' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Repository URL</label>
                  <input
                    type="text"
                    value={newProject.sourceConfig?.repoUrl || ''}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        sourceConfig: { ...newProject.sourceConfig, repoUrl: e.target.value },
                      })
                    }
                    placeholder="https://github.com/org/repo"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Relationship</label>
                <select
                  value={newProject.relationship || ''}
                  onChange={(e) =>
                    setNewProject({ ...newProject, relationship: e.target.value as ProjectRelationship })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select relationship...</option>
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel.id} value={rel.id}>
                      {rel.label} - {rel.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setShowAddProject(false)
                  setNewProject({})
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newProject.name && newProject.sourceType && newProject.relationship) {
                    setConfig({
                      ...config,
                      linkedProjects: [
                        ...config.linkedProjects,
                        {
                          ...newProject,
                          id: `proj_${Date.now()}`,
                        } as LinkedProject,
                      ],
                    })
                    setShowAddProject(false)
                    setNewProject({})
                  }
                }}
                disabled={!newProject.name || !newProject.sourceType || !newProject.relationship}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Step 3: Known Addresses
  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Known Addresses</h3>
        <p className="text-sm text-slate-500">
          Pre-label admin addresses, multisigs, and other known contracts to improve finding accuracy
        </p>
      </div>

      {config.knownAddresses.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <Wallet size={32} className="mx-auto text-slate-300 mb-4" />
          <div className="text-slate-500 mb-4">No known addresses yet</div>
          <button
            onClick={() => setShowAddAddress(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Add Address
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {config.knownAddresses.map((addr) => (
            <div
              key={addr.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  {ADDRESS_TYPES.find((t) => t.id === addr.addressType)?.icon || <Wallet size={18} className="text-indigo-600" />}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{addr.label}</div>
                  <div className="text-sm text-slate-500 font-mono">
                    {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                    <span className="mx-2">•</span>
                    <span className="text-indigo-600 font-sans">{addr.chain}</span>
                    <span className="mx-2">•</span>
                    <span className="text-slate-600 font-sans">
                      {ADDRESS_TYPES.find((t) => t.id === addr.addressType)?.label}
                    </span>
                  </div>
                  {addr.metadata?.threshold && (
                    <div className="text-xs text-slate-400 mt-1">
                      {addr.metadata.threshold}/{addr.metadata.totalSigners} signatures required
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    knownAddresses: config.knownAddresses.filter((a) => a.id !== addr.id),
                  })
                }
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowAddAddress(true)}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <Plus size={16} />
            Add Another Address
          </button>
        </div>
      )}

      {/* Add Address Modal */}
      {showAddAddress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-xl font-semibold mb-6">Add Known Address</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Label</label>
                <input
                  type="text"
                  value={newAddress.label || ''}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  placeholder="e.g., Protocol Treasury"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <input
                  type="text"
                  value={newAddress.address || ''}
                  onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chain</label>
                <select
                  value={newAddress.chain || ''}
                  onChange={(e) => setNewAddress({ ...newAddress, chain: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select chain...</option>
                  {CHAINS.map((chain) => (
                    <option key={chain} value={chain}>
                      {chain.charAt(0).toUpperCase() + chain.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ADDRESS_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setNewAddress({ ...newAddress, addressType: type.id })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        newAddress.addressType === type.id
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {type.icon}
                      <span className="text-sm">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {newAddress.addressType === 'multisig' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Required Signatures</label>
                    <input
                      type="number"
                      min="1"
                      value={newAddress.metadata?.threshold || ''}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          metadata: { ...newAddress.metadata, threshold: parseInt(e.target.value, 10) },
                        })
                      }
                      placeholder="e.g., 3"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Total Signers</label>
                    <input
                      type="number"
                      min="1"
                      value={newAddress.metadata?.totalSigners || ''}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          metadata: { ...newAddress.metadata, totalSigners: parseInt(e.target.value, 10) },
                        })
                      }
                      placeholder="e.g., 5"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setShowAddAddress(false)
                  setNewAddress({})
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newAddress.label && newAddress.address && newAddress.chain && newAddress.addressType) {
                    setConfig({
                      ...config,
                      knownAddresses: [
                        ...config.knownAddresses,
                        {
                          ...newAddress,
                          id: `addr_${Date.now()}`,
                        } as KnownAddress,
                      ],
                    })
                    setShowAddAddress(false)
                    setNewAddress({})
                  }
                }}
                disabled={!newAddress.label || !newAddress.address || !newAddress.chain || !newAddress.addressType}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Step 4: Notifications
  const renderStep4 = () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Notification Settings</h3>
        <p className="text-sm text-slate-500">
          Configure how you want to be notified during the audit
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Email for Notifications</label>
          <div className="flex items-center gap-3">
            <Mail size={18} className="text-slate-400" />
            <input
              type="email"
              value={config.notificationEmail}
              onChange={(e) => setConfig({ ...config, notificationEmail: e.target.value })}
              placeholder="you@example.com"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-medium text-slate-900">Audit Complete</div>
              <div className="text-sm text-slate-500">Get notified when the audit finishes</div>
            </div>
            <input
              type="checkbox"
              checked={config.notifyOnCompletion}
              onChange={(e) => setConfig({ ...config, notifyOnCompletion: e.target.checked })}
              className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-medium text-slate-900">Input Needed</div>
              <div className="text-sm text-slate-500">Get notified when AI needs your input</div>
            </div>
            <input
              type="checkbox"
              checked={config.notifyOnInputNeeded}
              onChange={(e) => setConfig({ ...config, notifyOnInputNeeded: e.target.checked })}
              className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-medium text-slate-900">Critical Findings</div>
              <div className="text-sm text-slate-500">Get immediately notified of critical vulnerabilities</div>
            </div>
            <input
              type="checkbox"
              checked={config.notifyOnCriticalFinding}
              onChange={(e) => setConfig({ ...config, notifyOnCriticalFinding: e.target.checked })}
              className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
            />
          </label>
        </div>

        {config.interactiveMode && (
          <div className="pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Auto-Continue Timeout
            </label>
            <p className="text-sm text-slate-500 mb-3">
              If you don't respond to a prompt, the audit will continue with safe defaults after this time
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="60"
                max="1800"
                step="60"
                value={config.autoContinueTimeoutSeconds}
                onChange={(e) =>
                  setConfig({ ...config, autoContinueTimeoutSeconds: parseInt(e.target.value, 10) })
                }
                className="flex-1"
              />
              <div className="w-24 text-center font-medium text-slate-900">
                {Math.floor(config.autoContinueTimeoutSeconds / 60)} min
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1()
      case 2:
        return renderStep2()
      case 3:
        return renderStep3()
      case 4:
        return renderStep4()
      default:
        return null
    }
  }

  const stepTitles = ['Audit Settings', 'Linked Projects', 'Known Addresses', 'Notifications']

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            <span>Cancel</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Configure Interactive Audit</h1>
          <p className="text-slate-500 mt-1">
            Set up your audit preferences, linked projects, and known addresses
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center">
              <button
                onClick={() => setStep(s)}
                className={`flex items-center justify-center w-8 h-8 rounded-full font-medium transition-all ${
                  s === step
                    ? 'bg-indigo-600 text-white'
                    : s < step
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s < step ? <Check size={14} /> : s}
              </button>
              <span
                className={`ml-2 text-sm font-medium ${
                  s === step ? 'text-indigo-600' : s < step ? 'text-green-600' : 'text-slate-400'
                }`}
              >
                {stepTitles[s - 1]}
              </span>
              {s < totalSteps && (
                <ChevronRight size={16} className="mx-4 text-slate-300" />
              )}
            </div>
          ))}
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => onComplete(config)}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check size={16} />
              Start Audit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
