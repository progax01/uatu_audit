import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Code2, FileText, Check, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { authFetch } from '../services/authService'

interface BuyNeuronsModalProps {
    isOpen: boolean
    onClose: () => void
    onPurchaseComplete: () => void
}

interface PricingTier {
    id: string
    name: string
    priceUsd: number
    priceUsdt: number
    neurons: number
    sloc: number
    aiCalls: number
}

interface ChainInfo {
    id: number
    name: string
    symbol: string
}

// Fallback tiers in case API fails
const FALLBACK_TIERS: PricingTier[] = [
    { id: 'starter', name: 'Starter', priceUsd: 29, priceUsdt: 2900, neurons: 1000, sloc: 1000, aiCalls: 50 },
    { id: 'pro', name: 'Pro', priceUsd: 149, priceUsdt: 14900, neurons: 6000, sloc: 5000, aiCalls: 300 },
    { id: 'enterprise', name: 'Enterprise', priceUsd: 499, priceUsdt: 49900, neurons: 25000, sloc: 20000, aiCalls: 9999 },
]

const FALLBACK_CHAINS: ChainInfo[] = [
    { id: 1, name: 'Ethereum', symbol: 'ETH' },
    { id: 137, name: 'Polygon', symbol: 'MATIC' },
    { id: 42161, name: 'Arbitrum', symbol: 'ARB' },
]

// ERC20 Transfer ABI
const ERC20_TRANSFER_ABI = [
    {
        name: 'transfer',
        type: 'function',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
    },
] as const

export default function BuyNeuronsModal({ isOpen, onClose, onPurchaseComplete }: BuyNeuronsModalProps) {
    const { address, isConnected } = useAccount()
    const [step, setStep] = useState<'select' | 'pay' | 'processing' | 'success' | 'error'>('select')
    const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null)
    const [selectedChain, setSelectedChain] = useState<number>(137) // Default to Polygon
    const [tiers, setTiers] = useState<PricingTier[]>(FALLBACK_TIERS)
    const [chains, setChains] = useState<ChainInfo[]>(FALLBACK_CHAINS)
    const [, setReceiverAddress] = useState<string>('')
    const [, setUsdtContract] = useState<string>('')
    const [error, setError] = useState<string>('')
    const [txHash, setTxHash] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)

    // Wagmi write contract
    const { writeContract, data: writeData, isPending: isWritePending, error: writeError } = useWriteContract()

    // Wait for transaction receipt
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: writeData,
    })

    // Fetch pricing info on mount
    useEffect(() => {
        if (isOpen) {
            fetchPricing()
            setStep('select')
            setSelectedTier(null)
            setError('')
            setTxHash('')
        }
    }, [isOpen])

    // Handle transaction confirmation
    useEffect(() => {
        if (isConfirmed && writeData && selectedTier) {
            verifyPurchase(writeData)
        }
    }, [isConfirmed, writeData, selectedTier])

    // Handle write errors
    useEffect(() => {
        if (writeError) {
            setError(writeError.message || 'Transaction failed')
            setStep('error')
        }
    }, [writeError])

    const fetchPricing = async () => {
        setLoading(true)
        try {
            const res = await authFetch('/api/billing/pricing')
            if (res.ok) {
                const data = await res.json()
                if (data.tiers && data.tiers.length > 0) {
                    setTiers(data.tiers)
                }
                if (data.chains && data.chains.length > 0) {
                    setChains(data.chains)
                }
                if (data.receiverAddress) {
                    setReceiverAddress(data.receiverAddress)
                }
            }
        } catch (err) {
            console.error('Failed to fetch pricing, using fallback:', err)
            // Keep using fallback tiers
        } finally {
            setLoading(false)
        }
    }

    const initiatePurchase = async () => {
        if (!selectedTier || !isConnected) return

        try {
            setStep('pay')
            const res = await authFetch('/api/billing/purchase/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tier: selectedTier.id,
                    chainId: selectedChain,
                }),
            })

            if (!res.ok) {
                throw new Error('Failed to initiate purchase')
            }

            const data = await res.json()
            setUsdtContract(data.usdtContract)
            setReceiverAddress(data.receiverAddress)

            // Execute the USDT transfer
            const amountInUnits = parseUnits(data.amountUsdt.toString(), 6) // USDT has 6 decimals

            writeContract({
                address: data.usdtContract as `0x${string}`,
                abi: ERC20_TRANSFER_ABI,
                functionName: 'transfer',
                args: [data.receiverAddress as `0x${string}`, amountInUnits],
            })

            setStep('processing')
        } catch (err: any) {
            setError(err.message || 'Failed to initiate purchase')
            setStep('error')
        }
    }

    const verifyPurchase = async (hash: string) => {
        try {
            setTxHash(hash)
            const res = await authFetch('/api/billing/purchase/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txHash: hash,
                    chainId: selectedChain,
                    tier: selectedTier?.id,
                    fromAddress: address,
                }),
            })

            if (!res.ok) {
                throw new Error('Purchase verification failed')
            }

            setStep('success')
        } catch (err: any) {
            setError(err.message || 'Purchase verification failed')
            setStep('error')
        }
    }

    const handleComplete = () => {
        onPurchaseComplete()
        onClose()
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <>
                {/* Backdrop: Alabaster Glass */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    onClick={onClose}
                />

                {/* Modal Container - centered on main content area */}
                <div className="fixed inset-y-0 left-72 right-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        className="relative bg-white rounded-[40px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] w-full max-w-2xl overflow-hidden border border-black/[0.03] pointer-events-auto"
                    >
                    {/* Header: Clean & Borderless */}
                    <div className="px-10 pt-10 pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Buy <span className="text-indigo-600">Neurons</span></h2>
                                <p className="text-slate-400 font-medium text-[13px] mt-1">Power up your protocol audit capabilities.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-slate-50 border border-black/[0.03] flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all hover:bg-white hover:shadow-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {/* Step: Select Tier */}
                        {step === 'select' && (
                            <div className="space-y-6">
                                {/* Loading State */}
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 size={32} className="animate-spin text-indigo-600" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Tier Selection */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                            {tiers.map((tier) => (
                                                <button
                                                    key={tier.id}
                                                    onClick={() => setSelectedTier(tier)}
                                                    className={`p-8 rounded-3xl border transition-all text-left flex flex-col justify-between group ${selectedTier?.id === tier.id
                                                        ? 'border-indigo-600 bg-white shadow-2xl shadow-indigo-100'
                                                        : 'border-black/[0.03] bg-slate-50/30 hover:bg-white hover:border-indigo-200'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-6">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${selectedTier?.id === tier.id ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                            {tier.name}
                                                        </span>
                                                        {selectedTier?.id === tier.id && (
                                                            <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                                                                <Check size={10} className="text-white" strokeWidth={4} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mb-6">
                                                        <div className="text-4xl font-black text-slate-900 tracking-tighter">
                                                            ${tier.priceUsd}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">USDT</div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${selectedTier?.id === tier.id ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-300'}`}>
                                                                <Zap size={10} strokeWidth={3} />
                                                            </div>
                                                            <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">{tier.neurons.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${selectedTier?.id === tier.id ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-300'}`}>
                                                                <Code2 size={10} strokeWidth={3} />
                                                            </div>
                                                            <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">{tier.sloc.toLocaleString()} SLOC</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${selectedTier?.id === tier.id ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-300'}`}>
                                                                <FileText size={10} strokeWidth={3} />
                                                            </div>
                                                            <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">{tier.aiCalls === 9999 ? 'UNLIMITED' : tier.aiCalls} REPORTS</span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Chain Selection */}
                                        {selectedTier && (
                                            <div className="animate-reveal">
                                                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">
                                                    Infrastructure Network
                                                </label>
                                                <div className="flex gap-4">
                                                    {chains.map((c) => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => setSelectedChain(c.id)}
                                                            className={`flex-1 p-5 rounded-2xl border transition-all ${selectedChain === c.id
                                                                ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-100'
                                                                : 'border-black/[0.03] bg-slate-50/30 hover:border-indigo-200'
                                                                }`}
                                                        >
                                                            <div className="text-xs font-black text-slate-900 uppercase tracking-tighter">{c.name}</div>
                                                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">{c.symbol}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Wallet Status */}
                                        {!isConnected && (
                                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <AlertCircle size={18} className="text-amber-600" />
                                                    <span className="text-sm text-amber-700 font-medium">
                                                        Please connect your wallet to continue
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Continue Button */}
                                        <div className="pt-4">
                                            <button
                                                onClick={initiatePurchase}
                                                disabled={!selectedTier || !isConnected}
                                                className={`w-full h-16 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-2xl relative overflow-hidden group ${selectedTier && isConnected
                                                    ? 'bg-slate-900 text-white hover:bg-indigo-600 shadow-indigo-200'
                                                    : 'bg-slate-50 text-slate-300 border border-black/[0.03] shadow-none cursor-not-allowed'
                                                    }`}
                                            >
                                                <div className="relative z-10 flex items-center justify-center gap-3">
                                                    {selectedTier ? (
                                                        <>
                                                            <span>Initialize Transaction</span>
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                                            <span>${selectedTier.priceUsd} USDT</span>
                                                        </>
                                                    ) : (
                                                        'Select Performance Tier'
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Step: Processing */}
                        {(step === 'pay' || step === 'processing') && (
                            <div className="text-center py-12">
                                <Loader2 size={48} className="mx-auto text-indigo-600 animate-spin mb-6" />
                                <h3 className="text-xl font-black text-slate-900 mb-2">
                                    {isWritePending ? 'Confirm in Wallet' : isConfirming ? 'Confirming Transaction' : 'Processing...'}
                                </h3>
                                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                    {isWritePending
                                        ? 'Please confirm the USDT transfer in your wallet'
                                        : isConfirming
                                            ? 'Waiting for blockchain confirmation...'
                                            : 'Please wait while we process your purchase'}
                                </p>
                            </div>
                        )}

                        {/* Step: Success */}
                        {step === 'success' && (
                            <div className="text-center py-12">
                                <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                                    <Check size={40} className="text-emerald-600" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">Purchase Complete!</h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Your account has been credited with:
                                </p>
                                <div className="inline-flex gap-6 p-4 bg-slate-50 rounded-xl mb-6">
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-indigo-600">
                                            {selectedTier?.neurons.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-slate-400 font-bold">Neurons</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-slate-900">
                                            {selectedTier?.sloc.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-slate-400 font-bold">SLOC</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-emerald-600">
                                            {selectedTier?.aiCalls === 9999 ? '∞' : selectedTier?.aiCalls}
                                        </div>
                                        <div className="text-xs text-slate-400 font-bold">AI Reports</div>
                                    </div>
                                </div>
                                {txHash && (
                                    <a
                                        href={`https://polygonscan.com/tx/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 mb-6"
                                    >
                                        View Transaction <ExternalLink size={14} />
                                    </a>
                                )}
                                <button onClick={handleComplete} className="w-full btn-primary h-14">
                                    Continue
                                </button>
                            </div>
                        )}

                        {/* Step: Error */}
                        {step === 'error' && (
                            <div className="text-center py-12">
                                <div className="w-20 h-20 mx-auto bg-rose-100 rounded-full flex items-center justify-center mb-6">
                                    <AlertCircle size={40} className="text-rose-600" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">Transaction Failed</h3>
                                <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                                    {error || 'Something went wrong. Please try again.'}
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setStep('select')
                                            setError('')
                                        }}
                                        className="flex-1 h-12 border border-black/[0.05] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                                    >
                                        Try Again
                                    </button>
                                    <button onClick={onClose} className="flex-1 btn-primary h-12">
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    </motion.div>
                </div>
            </>
        </AnimatePresence>
    )
}
