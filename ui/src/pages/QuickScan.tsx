import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2, CheckCircle, Search, Cpu, Globe, Activity, Shield, RefreshCw, FileCode, ExternalLink, Zap, Lock, Bug, FileText, GitBranch } from 'lucide-react'
import { motion } from 'framer-motion'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'
import { Link } from 'react-router-dom'
import { supportedChains } from '../components/icons/CryptoIcons'
import SEO, { pageSEO } from '../components/SEO'

type Network = 'arbitrum' | 'ethereum' | 'polygon' | 'base' | 'bnb' | 'optimism'
type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error'

interface QuickScanVulnerability {
    id: string
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    title: string
    description: string
    location?: string
    recommendation: string
}

interface QuickScanResult {
    success: boolean
    score: number
    grade: string
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE'
    vulnerabilities: QuickScanVulnerability[]
    summary: string
    scanDuration: number
}

interface ContractInfo {
    contractName: string
    compiler: string
    files: string[]
    fileCount: number
    isProxy: boolean
    explorerUrl: string
    deployerAddress?: string
    creationTxHash?: string
    sourceCodePreview?: string
}

interface ScanPhase {
    name: string
    label: string
    status: 'pending' | 'active' | 'complete'
    pct: number
}

const networks: { id: Network; name: string; shortName: string; color: string }[] = [
    { id: 'ethereum', name: 'Ethereum', shortName: 'ETH', color: '#627EEA' },
    { id: 'arbitrum', name: 'Arbitrum', shortName: 'ARB', color: '#28A0F0' },
    { id: 'polygon', name: 'Polygon', shortName: 'POLY', color: '#8247E5' },
    { id: 'base', name: 'Base', shortName: 'BASE', color: '#0052FF' },
    { id: 'bnb', name: 'BNB Chain', shortName: 'BNB', color: '#F3BA2F' },
    { id: 'optimism', name: 'Optimism', shortName: 'OP', color: '#FF0420' },
]

const SEVERITY_CONFIG = {
    critical: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    low: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    info: { color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
}

// Phase icons mapping
const PHASE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    CONTRACT_PARSE: FileCode,
    SYMBOLIC_ANALYSIS: GitBranch,
    CONTROL_FLOW: Activity,
    REENTRANCY: Lock,
    ACCESS_CONTROL: Shield,
    VULNERABILITY_SCAN: Bug,
    REPORT_GEN: FileText,
}

// Default phases for fallback
const DEFAULT_PHASES: ScanPhase[] = [
    { name: 'CONTRACT_PARSE', label: 'Contract Parse', status: 'pending', pct: 0 },
    { name: 'SYMBOLIC_ANALYSIS', label: 'Symbolic Analysis', status: 'pending', pct: 0 },
    { name: 'CONTROL_FLOW', label: 'Control Flow', status: 'pending', pct: 0 },
    { name: 'REENTRANCY', label: 'Reentrancy Check', status: 'pending', pct: 0 },
    { name: 'ACCESS_CONTROL', label: 'Access Control', status: 'pending', pct: 0 },
    { name: 'VULNERABILITY_SCAN', label: 'Vulnerability Scan', status: 'pending', pct: 0 },
    { name: 'REPORT_GEN', label: 'Report Generation', status: 'pending', pct: 0 },
]

// Helper to get explorer URL for different networks
function getExplorerUrl(network: Network, address: string): string {
    const explorers: Record<Network, string> = {
        ethereum: 'https://etherscan.io',
        arbitrum: 'https://arbiscan.io',
        polygon: 'https://polygonscan.com',
        base: 'https://basescan.org',
        bnb: 'https://bscscan.com',
        optimism: 'https://optimistic.etherscan.io',
    }
    return `${explorers[network]}/address/${address}`
}

interface ScanProgress {
    pct: number
    message: string
}

// Mock Solidity code for the scanning animation
const MOCK_CONTRACT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VaultProtocol is ReentrancyGuard, Ownable {
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public rewards;

    IERC20 public immutable token;
    uint256 public totalDeposits;
    uint256 public rewardRate = 100;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        token.transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalDeposits += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(deposits[msg.sender] >= amount, "Insufficient");
        deposits[msg.sender] -= amount;
        totalDeposits -= amount;
        token.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        uint256 reward = calculateReward(msg.sender);
        require(reward > 0, "No rewards");
        rewards[msg.sender] = 0;
        token.transfer(msg.sender, reward);
        emit RewardsClaimed(msg.sender, reward);
    }

    function calculateReward(address user) public view returns (uint256) {
        return (deposits[user] * rewardRate) / 10000;
    }

    function setRewardRate(uint256 _rate) external onlyOwner {
        require(_rate <= 1000, "Rate too high");
        rewardRate = _rate;
    }
}`

export default function QuickScan() {
    const navigate = useNavigate()
    const [selectedNetwork, setSelectedNetwork] = useState<Network>('ethereum')
    const [contractAddress, setContractAddress] = useState('')
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [isStarting, setIsStarting] = useState(false)
    const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
    const [scanPhases, setScanPhases] = useState<ScanPhase[]>(DEFAULT_PHASES)
    const [scanResult, setScanResult] = useState<QuickScanResult | null>(null)
    const [jobId, setJobId] = useState<string | null>(null)
    const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)

    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    // Track highest progress to prevent backwards movement
    const highestProgressRef = useRef<number>(0)

    const validateAndFetch = useCallback(async (address: string, network: Network) => {
        setValidationStatus('validating')
        setError(null)
        setContractInfo(null)
        try {
            const response = await fetch('/scan/validate-and-fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, network }),
            })
            const data = await response.json()
            if (!response.ok || !data.isContract || !data.isVerified) {
                setError(data.error || 'Contract must be verified on explorer')
                setValidationStatus('invalid')
                return
            }

            // Set contract info with fallbacks for all fields
            const info: ContractInfo = {
                contractName: data.contractName || `Contract ${address.slice(0, 8)}...`,
                compiler: data.compiler || 'Unknown',
                files: data.files || [],
                fileCount: data.fileCount || 0,
                isProxy: data.isProxy || false,
                explorerUrl: data.explorerUrl || getExplorerUrl(network, address),
                deployerAddress: data.deployerAddress,
                creationTxHash: data.creationTxHash
            }

            setContractInfo(info)
            setValidationStatus('valid')
        } catch (err) {
            setError('Connection failed')
            setValidationStatus('error')
        }
    }, [])

    const handleAddressChange = (rawInput: string) => {
        // Trim whitespace and normalize: remove any existing 0x prefix, then add it back
        const trimmed = rawInput.trim()
        const cleaned = trimmed.replace(/^0x/i, '').replace(/[^a-fA-F0-9]/g, '')
        const address = cleaned ? `0x${cleaned}` : ''
        setContractAddress(address)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        setContractInfo(null) // Clear previous contract info when address changes

        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            setValidationStatus('idle')
            return
        }
        debounceRef.current = setTimeout(() => validateAndFetch(address, selectedNetwork), 500)
    }

    const handleNetworkChange = (network: Network) => {
        setSelectedNetwork(network)
        setValidationStatus('idle')
        setError(null)
        setContractInfo(null)
        if (contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            validateAndFetch(contractAddress, network)
        }
    }

    const handleStartScan = async () => {
        if (!contractAddress || validationStatus !== 'valid') return

        setIsStarting(true)
        setError(null)
        setScanResult(null)
        setScanPhases(DEFAULT_PHASES)
        highestProgressRef.current = 0
        setScanProgress({ pct: 0, message: 'Initializing scan...' })

        try {
            const response = await fetch('/scan/enqueue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: contractAddress,
                    network: selectedNetwork,
                    scanMode: 'quick'
                }),
            })

            const contentType = response.headers.get('content-type') || ''

            // Handle SSE streaming (new flow)
            if (contentType.includes('text/event-stream')) {
                const reader = response.body?.getReader()
                if (!reader) throw new Error('No response body')

                const decoder = new TextDecoder()
                let buffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))

                                // Ensure progress only moves forward, never backwards
                                const newPct = data.progressPct || 0
                                const displayPct = Math.max(newPct, highestProgressRef.current)
                                if (newPct > highestProgressRef.current) {
                                    highestProgressRef.current = newPct
                                }

                                setScanProgress({
                                    pct: displayPct,
                                    message: data.message || 'Processing...',
                                })

                                // Update phases if available
                                if (data.phases && Array.isArray(data.phases)) {
                                    setScanPhases(data.phases)
                                }

                                if (data.jobId) setJobId(data.jobId)

                                if (data.status === 'completed' && data.redirectUrl) {
                                    setIsStarting(false)
                                    setScanProgress(null)
                                    setScanPhases(DEFAULT_PHASES)
                                    highestProgressRef.current = 0
                                    navigate(data.redirectUrl)
                                    return
                                }

                                if (data.status === 'failed') {
                                    throw new Error(data.error || data.message || 'Scan failed')
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse SSE event:', line)
                            }
                        }
                    }
                }
            }
            // Handle JSON response (cached result or error)
            else if (contentType.includes('application/json')) {
                const data = await response.json()
                if (!response.ok) throw new Error(data.error || 'Failed to start scan')

                setJobId(data.jobId || data.job?.id || null)

                // Cached result - redirect directly
                if (data.cached && data.redirectUrl) {
                    navigate(data.redirectUrl)
                    return
                }

                // Quick scan result with redirect - always redirect to audit page
                if (data.quickScanResult) {
                    const targetUrl = data.redirectUrl || (data.jobId ? `/audit/${data.jobId}` : null)
                    if (targetUrl) {
                        // Redirect without showing inline result
                        setIsStarting(false)
                        setScanProgress(null)
                        navigate(targetUrl)
                        return
                    }
                    // Fallback: show inline result only if no redirect URL
                    setScanResult(data.quickScanResult)
                    setIsStarting(false)
                    setScanProgress(null)
                    return
                }

                // Full audit fallback
                if (data.job?.id) {
                    navigate(`/audit/${data.job.id}`)
                    return
                }
            }

            setIsStarting(false)
            setScanProgress(null)
        } catch (err: any) {
            setError(err.message || 'Failed to start scan')
            setIsStarting(false)
            setScanProgress(null)
            setScanPhases(DEFAULT_PHASES)
            highestProgressRef.current = 0
        }
    }

    const handleNewScan = () => {
        setScanResult(null)
        setJobId(null)
        setContractAddress('')
        setValidationStatus('idle')
        setError(null)
        setContractInfo(null)
    }

    return (
        <>
            <SEO
                title={pageSEO.quickScan.title}
                description={pageSEO.quickScan.description}
                keywords={pageSEO.quickScan.keywords}
                url="https://uatu.xyz/quick-scan"
            />
            <div className="min-h-screen bg-white selection:bg-indigo-500/10 flex flex-col font-sans overflow-hidden">
            <MouseTooltip />

            {/* Sticky Professional Header */}
            <header className="sticky top-0 h-20 bg-white/80 backdrop-blur-xl border-b border-black/[0.03] flex items-center justify-between px-10 shrink-0 z-[100]">
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex items-center">
                        <img src={logo} alt="Uatu" className="h-8" />
                    </Link>
                    <div className="h-4 w-[1px] bg-black/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Security Analyzer Console</span>
                </div>
                <div className="flex items-center gap-8">
                    <Link to="/public-audits" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Audit Ledger</Link>
                    <Link to="/dashboard" className="btn-primary !py-2.5 !px-8 !text-[10px]">Launch Console</Link>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Left: Configuration Console */}
                <div className="w-[500px] bg-white border-r border-black/[0.03] flex flex-col p-10 overflow-y-auto">
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-6">
                            <Activity size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Formal Verification Node</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Initialize Scan.</h1>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed">Provide deployment target for deep-level bytecode analysis and security posture assessment.</p>
                    </div>

                    <div className="space-y-10">
                        {/* Network Select */}
                        <div className="space-y-5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Globe size={12} /> Deployment Network
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {networks.map(n => {
                                    const chainIcon = supportedChains.find(c => c.name.toLowerCase() === n.id.toLowerCase() || (n.id === 'bnb' && c.name === 'BSC'));
                                    const isSelected = selectedNetwork === n.id;
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => handleNetworkChange(n.id)}
                                            className={`group px-5 py-4 rounded-[20px] border text-[10px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-3 relative overflow-hidden ${isSelected ? 'bg-white shadow-xl shadow-slate-200/50' : 'bg-slate-50 border-black/[0.02] text-slate-400 hover:bg-white hover:border-black/[0.1]'}`}
                                            style={{ borderColor: isSelected ? `${n.color}40` : undefined }}
                                        >
                                            <div className="relative z-10 w-6 h-6 rounded-lg flex items-center justify-center bg-white border border-black/[0.03] shadow-sm">
                                                {chainIcon && <chainIcon.icon size={14} color={isSelected ? n.color : '#cbd5e1'} />}
                                            </div>
                                            <span className={`relative z-10 ${isSelected ? 'text-slate-900' : ''}`}>{n.name}</span>
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-gradient-to-br opacity-[0.03]" style={{ backgroundImage: `linear-gradient(to bottom right, ${n.color}, transparent)` }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Address Input */}
                        <div className="space-y-5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Search size={12} /> Contract Identity
                            </label>
                            <div className="relative">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">0x</div>
                                <input
                                    type="text"
                                    value={contractAddress.replace(/^0x/i, '')}
                                    onChange={(e) => handleAddressChange(e.target.value)}
                                    placeholder="Enter verified contract address..."
                                    className="w-full bg-slate-50 border border-black/[0.03] rounded-[20px] py-6 pl-14 pr-12 text-xs font-mono font-bold focus:outline-none focus:bg-white focus:border-indigo-500/30 focus:shadow-2xl focus:shadow-indigo-500/5 transition-all placeholder:text-slate-200 text-slate-900"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                    {validationStatus === 'validating' && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                                    {validationStatus === 'valid' && <CheckCircle size={16} className="text-emerald-500" />}
                                    {validationStatus === 'invalid' && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                                </div>
                            </div>
                            {error && (
                                <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest pl-2">
                                    Target Refused: {error}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleStartScan}
                            disabled={validationStatus !== 'valid' || isStarting}
                            className="w-full py-6 bg-slate-900 hover:bg-black disabled:bg-slate-50 disabled:text-slate-200 rounded-[22px] text-white text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-2xl shadow-slate-900/10 group overflow-hidden relative"
                        >
                            {isStarting ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10 flex items-center gap-3">Let's Quick Scan <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" /></span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-auto pt-10 border-t border-black/[0.03] flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">System Status: Operational</span>
                        </div>
                        <div className="text-[9px] font-black text-slate-200 uppercase tracking-widest">v2.4.0-STABLE</div>
                    </div>
                </div>

                {/* Right: Analysis Visualization */}
                <div className="flex-1 bg-slate-50/50 p-12 relative flex items-center justify-center overflow-y-auto">
                    <div className="absolute inset-0 bg-dot-pattern opacity-[0.03] pointer-events-none" />

                    {/* Scan Result View */}
                    {scanResult ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-2xl"
                        >
                            {/* Score Card */}
                            <div className="bg-white rounded-3xl border border-black/[0.03] p-8 shadow-xl mb-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield size={16} className="text-indigo-600" />
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Quick Scan Complete</span>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Security Assessment</h3>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-5xl font-black ${scanResult.score >= 70 ? 'text-emerald-600' : scanResult.score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                            {scanResult.score}
                                        </div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/ 100</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                        scanResult.riskLevel === 'SAFE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                        scanResult.riskLevel === 'LOW' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                        scanResult.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                        scanResult.riskLevel === 'HIGH' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                        'bg-rose-50 text-rose-600 border border-rose-100'
                                    }`}>
                                        {scanResult.riskLevel} Risk
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        Completed in {(scanResult.scanDuration / 1000).toFixed(1)}s
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600 leading-relaxed">{scanResult.summary}</p>
                            </div>

                            {/* Vulnerabilities */}
                            {scanResult.vulnerabilities.length > 0 && (
                                <div className="bg-white rounded-3xl border border-black/[0.03] p-6 shadow-xl mb-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                        {scanResult.vulnerabilities.length} Issue{scanResult.vulnerabilities.length !== 1 ? 's' : ''} Found
                                    </h4>
                                    <div className="space-y-3">
                                        {scanResult.vulnerabilities.map((vuln) => {
                                            const config = SEVERITY_CONFIG[vuln.severity] || SEVERITY_CONFIG.info
                                            return (
                                                <div key={vuln.id} className={`p-4 rounded-xl border ${config.bg} ${config.border}`}>
                                                    <div className="flex items-start justify-between mb-2">
                                                        <span className={`text-xs font-black ${config.color}`}>{vuln.title}</span>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${config.color}`}>
                                                            {vuln.severity}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 mb-2">{vuln.description}</p>
                                                    {vuln.location && (
                                                        <p className="text-[10px] font-mono text-slate-400 mb-2">Location: {vuln.location}</p>
                                                    )}
                                                    <p className="text-[10px] text-slate-500"><strong>Fix:</strong> {vuln.recommendation}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleNewScan}
                                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={14} /> New Scan
                                </button>
                                {jobId && (
                                    <Link
                                        to={`/audit/${jobId}`}
                                        className="flex-1 py-4 bg-slate-900 hover:bg-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2"
                                    >
                                        View Full Report <ArrowRight size={14} />
                                    </Link>
                                )}
                            </div>
                        </motion.div>
                    ) : isStarting ? (
                        /* Active Scanning View - Priority over contractInfo */
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-4xl"
                        >
                            <div className="flex gap-6">
                                {/* Left: Code Scanner Panel */}
                                <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
                                    {/* Header */}
                                    <div className="flex items-center gap-2 px-5 py-3 bg-slate-800/50 border-b border-slate-700/50">
                                        <div className="flex gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 ml-3">
                                            {contractInfo?.contractName || 'Contract'}.sol
                                        </span>
                                        <div className="ml-auto flex items-center gap-2">
                                            <Zap size={12} className="text-indigo-400 animate-pulse" />
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Scanning</span>
                                        </div>
                                    </div>

                                    {/* Large ASCII Logo Display with Progress */}
                                    <div className="relative h-[450px] overflow-hidden flex flex-col items-center justify-center">
                                        {/* Large ASCII Art Logo - Centered */}
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.5 }}
                                            className="mb-8"
                                        >
                                            <pre className="text-[28px] leading-[1.1] font-mono font-black select-none whitespace-pre">
                                                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
{`██╗   ██╗ █████╗ ████████╗██╗   ██╗
██║   ██║██╔══██╗╚══██╔══╝██║   ██║
██║   ██║███████║   ██║   ██║   ██║
██║   ██║██╔══██║   ██║   ██║   ██║
╚██████╔╝██║  ██║   ██║   ╚██████╔╝
 ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝`}
                                                </span>
                                            </pre>
                                            {/* Glow effect behind logo */}
                                            <div className="absolute inset-0 -z-10">
                                                <motion.div
                                                    className="w-full h-full bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-purple-500/20 blur-3xl"
                                                    animate={{
                                                        scale: [1, 1.1, 1],
                                                        opacity: [0.3, 0.5, 0.3]
                                                    }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut'
                                                    }}
                                                />
                                            </div>
                                        </motion.div>

                                        {/* Progress Messages Below Logo */}
                                        <div className="space-y-3 w-full max-w-md px-6">
                                            {/* Current Phase */}
                                            <motion.div
                                                key={scanProgress?.message}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex items-center gap-3"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-xs font-mono text-emerald-400 font-bold">uatu@scanner</span>
                                                </div>
                                                <span className="text-slate-600">~</span>
                                                <span className="text-xs font-mono text-slate-300">
                                                    {scanProgress?.message || 'Initializing security scan...'}
                                                </span>
                                                <motion.div
                                                    className="w-1.5 h-3.5 bg-emerald-400 ml-1"
                                                    animate={{ opacity: [1, 0, 1] }}
                                                    transition={{ duration: 0.8, repeat: Infinity }}
                                                />
                                            </motion.div>

                                            {/* Progress Bar */}
                                            <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${scanProgress?.pct || 0}%` }}
                                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                                />
                                                {/* Shimmer effect */}
                                                <motion.div
                                                    className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                                    animate={{ left: ['-20%', '120%'] }}
                                                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                                                />
                                            </div>

                                            {/* Secondary Status */}
                                            <div className="flex items-center justify-between text-[10px] font-mono">
                                                <span className="text-slate-500">
                                                    Analyzing: {contractInfo?.contractName || 'Contract'}.sol
                                                </span>
                                                <span className="text-indigo-400 font-bold">
                                                    {scanProgress?.pct || 0}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Continuous Looping Laser Scanner Line */}
                                        <motion.div
                                            className="absolute left-0 right-0 h-10 pointer-events-none"
                                            initial={{ top: '-5%' }}
                                            animate={{ top: '105%' }}
                                            transition={{
                                                duration: 3,
                                                repeat: Infinity,
                                                ease: 'linear',
                                            }}
                                        >
                                            {/* Glow effect */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent" />
                                            {/* Main line */}
                                            <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.8)]" />
                                            {/* Pulse effect */}
                                            <motion.div
                                                className="absolute left-0 right-0 top-1/2 h-[2px] bg-white/60"
                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                transition={{ duration: 0.3, repeat: Infinity }}
                                            />
                                        </motion.div>

                                        {/* Progress-based scanned overlay (green tint from top) */}
                                        <motion.div
                                            className="absolute top-0 left-0 right-0 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent pointer-events-none"
                                            animate={{ height: `${(scanProgress?.pct || 0)}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                        />
                                    </div>
                                </div>

                                {/* Right: Phase Progress Panel */}
                                <div className="w-80 bg-white rounded-3xl border border-black/[0.03] p-6 shadow-xl">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Shield size={16} className="text-indigo-600" />
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Security Analysis</span>
                                    </div>

                                    {/* Overall Progress */}
                                    <div className="mb-8">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-700">Overall Progress</span>
                                            <span className="text-lg font-black text-indigo-600">{scanProgress?.pct || 0}%</span>
                                        </div>
                                        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${scanProgress?.pct || 0}%` }}
                                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                            />
                                            {/* Shimmer effect */}
                                            <motion.div
                                                className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                                animate={{ left: ['-20%', '120%'] }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Phase List */}
                                    <div className="space-y-3">
                                        {scanPhases.map((phase, idx) => {
                                            const PhaseIcon = PHASE_ICONS[phase.name] || Activity
                                            const isActive = phase.status === 'active'
                                            const isComplete = phase.status === 'complete'

                                            return (
                                                <motion.div
                                                    key={phase.name}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                                        isActive ? 'bg-indigo-50 border border-indigo-100' :
                                                        isComplete ? 'bg-emerald-50/50 border border-emerald-100/50' :
                                                        'bg-slate-50 border border-transparent'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                        isActive ? 'bg-indigo-100' :
                                                        isComplete ? 'bg-emerald-100' :
                                                        'bg-slate-100'
                                                    }`}>
                                                        {isComplete ? (
                                                            <CheckCircle size={16} className="text-emerald-500" />
                                                        ) : isActive ? (
                                                            <Loader2 size={16} className="text-indigo-600 animate-spin" />
                                                        ) : (
                                                            <PhaseIcon size={16} className="text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-[10px] font-black uppercase tracking-widest truncate ${
                                                                isActive ? 'text-indigo-700' :
                                                                isComplete ? 'text-emerald-700' :
                                                                'text-slate-400'
                                                            }`}>
                                                                {phase.label}
                                                            </span>
                                                            {isActive && (
                                                                <span className="text-[9px] font-bold text-indigo-500">{phase.pct}%</span>
                                                            )}
                                                            {isComplete && (
                                                                <span className="text-[9px] font-bold text-emerald-500">Done</span>
                                                            )}
                                                        </div>
                                                        {isActive && (
                                                            <div className="mt-1.5 h-1 bg-indigo-100 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    className="h-full bg-indigo-500 rounded-full"
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${phase.pct}%` }}
                                                                    transition={{ duration: 0.3 }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                    </div>

                                    {/* Current Status Message */}
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                        <p className="text-[10px] text-slate-500 font-medium text-center">
                                            {scanProgress?.message || 'Initializing security analysis...'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : contractInfo ? (
                        /* Contract Info View */
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-lg"
                        >
                            {/* Contract Info Card */}
                            <div className="bg-white rounded-3xl border border-black/[0.03] p-8 shadow-xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                        <CheckCircle size={24} className="text-emerald-500" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Contract Verified</div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">{contractInfo.contractName}</h3>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center justify-between py-3 border-b border-black/[0.03]">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiler</span>
                                        <span className="text-xs font-mono font-bold text-slate-700">{contractInfo.compiler}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-b border-black/[0.03]">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Files</span>
                                        <span className="text-xs font-bold text-slate-700">{contractInfo.fileCount} file{contractInfo.fileCount !== 1 ? 's' : ''}</span>
                                    </div>
                                    {contractInfo.isProxy && (
                                        <div className="flex items-center justify-between py-3 border-b border-black/[0.03]">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                                            <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100">Proxy</span>
                                        </div>
                                    )}
                                    {contractInfo.deployerAddress && (
                                        <div className="flex items-center justify-between py-3 border-b border-black/[0.03]">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deployer</span>
                                            <a
                                                href={`${contractInfo.explorerUrl.replace(/\/address\/.*$/, '')}/address/${contractInfo.deployerAddress}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                            >
                                                {contractInfo.deployerAddress.slice(0, 6)}...{contractInfo.deployerAddress.slice(-4)}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* File List */}
                                {contractInfo.files.length > 0 && (
                                    <div className="mb-8">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Source Files</div>
                                        <div className="space-y-2">
                                            {contractInfo.files.slice(0, 5).map((file, i) => (
                                                <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                                                    <FileCode size={14} className="text-slate-400" />
                                                    <span className="text-xs font-mono text-slate-600 truncate">{file}</span>
                                                </div>
                                            ))}
                                            {contractInfo.files.length > 5 && (
                                                <div className="text-[10px] font-bold text-slate-400 text-center py-2">
                                                    +{contractInfo.files.length - 5} more files
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <a
                                    href={contractInfo.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
                                >
                                    <ExternalLink size={12} /> View on Explorer
                                </a>
                            </div>

                            <div className="mt-6 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Ready for security analysis
                                </p>
                            </div>
                        </motion.div>
                    ) : (
                        /* Idle/Validating States */
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center max-w-md"
                        >
                            {validationStatus === 'validating' ? (
                                <>
                                    <div className="w-24 h-24 bg-white border border-black/[0.03] rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-xl shadow-slate-200/50">
                                        <Loader2 size={40} className="text-indigo-600 animate-spin" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-4 uppercase">Fetching Contract</h2>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-sm mx-auto">
                                        Retrieving source code from block explorer...
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="w-24 h-24 bg-white border border-black/[0.03] rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-xl shadow-slate-200/50 group hover:scale-105 transition-transform duration-500">
                                        <Cpu size={40} className="text-indigo-600/20 group-hover:text-indigo-600 transition-colors duration-500" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-4 uppercase">System Awaiting Target</h2>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-sm mx-auto">
                                        Formal security node idle. Input a verified contract address on the left to initiate the bytecode extraction and vulnerability mapping phase.
                                    </p>
                                </>
                            )}
                        </motion.div>
                    )}
                </div>
            </main>
        </div>
        </>
    )
}
