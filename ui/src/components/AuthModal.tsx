import { motion, AnimatePresence } from 'framer-motion';
import { Github, Wallet, X, ChevronRight, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useConnect, useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { storeAuth, type AuthUser, type AuthTokens } from '../services/authService';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGitHubLogin: () => void;
    onWalletSuccess?: (tokens: { accessToken: string; refreshToken: string; user: any }) => void;
}

type AuthStep = 'select' | 'connecting' | 'signing' | 'verifying' | 'error';

export default function AuthModal({ isOpen, onClose, onGitHubLogin, onWalletSuccess }: AuthModalProps) {
    const [step, setStep] = useState<AuthStep>('select');
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState<string | null>(null);
    const [messageToSign, setMessageToSign] = useState<string | null>(null);

    const { connect, connectors, isPending: isConnecting } = useConnect();
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setStep('select');
            setError(null);
            setNonce(null);
            setMessageToSign(null);
        }
    }, [isOpen]);

    // When connected, fetch nonce and sign
    useEffect(() => {
        if (isConnected && address && step === 'connecting') {
            handleFetchNonceAndSign();
        }
    }, [isConnected, address, step]);

    const handleFetchNonceAndSign = async () => {
        if (!address) return;

        try {
            setStep('signing');
            setError(null);

            // Fetch nonce from backend
            const nonceResp = await fetch(`/auth/wallet/nonce?address=${address}`);
            if (!nonceResp.ok) {
                const err = await nonceResp.json();
                throw new Error(err.error || 'Failed to get nonce');
            }
            const { nonce: fetchedNonce, message } = await nonceResp.json();
            setNonce(fetchedNonce);
            setMessageToSign(message);

            // Sign the message
            const signature = await signMessageAsync({ message });

            // Verify with backend
            setStep('verifying');
            const verifyResp = await fetch('/auth/wallet/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    signature,
                    nonce: fetchedNonce,
                    walletType: 'ethereum',
                }),
            });

            if (!verifyResp.ok) {
                const err = await verifyResp.json();
                throw new Error(err.error || 'Verification failed');
            }

            const data = await verifyResp.json();

            // Build proper tokens and user objects
            const tokens: AuthTokens = {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresAt: data.expiresAt,
            };

            const user: AuthUser = {
                id: data.user.id,
                displayName: data.user.displayName,
                avatarUrl: data.user.avatarUrl,
                walletAddress: data.user.walletAddress,
                walletType: data.user.walletType,
                tier: data.user.tier || 'free',
                xpBalance: data.user.xpBalance || 0,
                needsUsername: !data.user.username, // Need onboarding if no username
                isNewUser: data.isNew,
            };

            // Store tokens properly using authService
            storeAuth(tokens, user);

            // Callback success
            if (onWalletSuccess) {
                onWalletSuccess({ ...data, user });
            }

            // Close modal
            onClose();

            // Redirect - new users go to onboarding, existing users go to dashboard
            if (user.needsUsername || user.isNewUser) {
                window.location.href = '/onboarding';
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err: any) {
            console.error('Wallet auth error:', err);
            setError(err.message || 'Authentication failed');
            setStep('error');
            disconnect();
        }
    };

    const handleWalletConnect = async (connectorId: string) => {
        setError(null);
        setStep('connecting');

        try {
            const connector = connectors.find(c =>
                (connectorId === 'metamask' && c.id === 'injected') ||
                (connectorId === 'wallet-connect' && c.id === 'walletConnect')
            );

            if (!connector) {
                throw new Error('Wallet connector not found');
            }

            connect({ connector });
        } catch (err: any) {
            console.error('Connect error:', err);
            setError(err.message || 'Failed to connect wallet');
            setStep('error');
        }
    };

    const handleRetry = () => {
        setError(null);
        setStep('select');
        disconnect();
    };

    const walletMethods = [
        { id: 'metamask', name: 'MetaMask / EVM', icon: Wallet, description: 'Connect using your EVM wallet' },
        { id: 'wallet-connect', name: 'WalletConnect', icon: Wallet, description: 'Universal mobile wallet link' },
    ];

    const renderContent = () => {
        if (step === 'connecting' || step === 'signing' || step === 'verifying') {
            return (
                <div className="py-12 text-center">
                    <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                    <h3 className="text-lg font-black text-slate-900 mb-2">
                        {step === 'connecting' && 'Connecting Wallet...'}
                        {step === 'signing' && 'Sign Message'}
                        {step === 'verifying' && 'Verifying...'}
                    </h3>
                    <p className="text-sm text-slate-500">
                        {step === 'connecting' && 'Please approve the connection in your wallet'}
                        {step === 'signing' && 'Please sign the message in your wallet to authenticate'}
                        {step === 'verifying' && 'Verifying your signature...'}
                    </p>
                    {address && (
                        <p className="text-xs text-slate-400 mt-4 font-mono">
                            {address.slice(0, 6)}...{address.slice(-4)}
                        </p>
                    )}
                </div>
            );
        }

        if (step === 'error') {
            return (
                <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2">Authentication Failed</h3>
                    <p className="text-sm text-red-600 mb-6">{error}</p>
                    <button
                        onClick={handleRetry}
                        className="px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return (
            <>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign In</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Select your access method</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-3">
                    {/* GitHub */}
                    <button
                        onClick={onGitHubLogin}
                        className="w-full flex items-center justify-between p-4 rounded-[20px] bg-slate-900 text-white hover:bg-slate-800 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <Github size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-black uppercase tracking-wider">GitHub OAuth</div>
                                <div className="text-[9px] opacity-60 font-bold uppercase tracking-widest mt-0.5">Primary Entry</div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="opacity-40 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div className="py-4 flex items-center gap-4">
                        <div className="h-px bg-black/[0.03] flex-1" />
                        <span className="text-[8px] font-black text-slate-200 uppercase tracking-[0.3em]">Web3 Auth</span>
                        <div className="h-px bg-black/[0.03] flex-1" />
                    </div>

                    {/* Wallet Methods */}
                    {walletMethods.map((method) => (
                        <button
                            key={method.id}
                            onClick={() => handleWalletConnect(method.id)}
                            disabled={isConnecting}
                            className="w-full flex items-center justify-between p-4 rounded-[20px] bg-white/40 border border-white/60 backdrop-blur-md hover:bg-white/60 hover:border-indigo-600/20 transition-all group disabled:opacity-50"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/80 border border-black/5 flex items-center justify-center text-slate-900 group-hover:text-indigo-600 transition-colors">
                                    <method.icon size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-black text-slate-900 uppercase tracking-wider">{method.name}</div>
                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{method.description}</div>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </button>
                    ))}
                </div>

                <div className="mt-8 p-4 rounded-[24px] bg-slate-50/50 border border-black/[0.02]">
                    <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest leading-relaxed">
                        By signing in, you agree to our <br />
                        <span className="text-slate-900">Terms</span> and <span className="text-slate-900">Privacy Policy</span>
                    </p>
                </div>
            </>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="glass-liquid !p-8 rounded-[32px] shadow-premium w-full max-w-[400px] pointer-events-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
                            {renderContent()}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
