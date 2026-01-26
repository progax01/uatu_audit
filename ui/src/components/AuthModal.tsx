import { motion, AnimatePresence } from 'framer-motion';
import { Github, Wallet, X, ChevronRight, AlertCircle, Shield, Check, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useConnect, useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { storeAuth, type AuthUser, type AuthTokens } from '../services/authService';
import logo from '../assets/logo.svg';

export type AuthPurpose = 'login' | 'claim-ownership';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onWalletSuccess?: (tokens: { accessToken: string; refreshToken: string; user: any }) => void;
    // For claim ownership flow
    purpose?: AuthPurpose;
    contractAddress?: string;
    deployerAddress?: string;
    onClaimSuccess?: () => void;
}

type AuthStep = 'select' | 'connecting' | 'signing' | 'verifying' | 'claim-verifying' | 'claim-success' | 'claim-failed' | 'error';

export default function AuthModal({
    isOpen,
    onClose,
    onWalletSuccess,
    purpose = 'login',
    contractAddress,
    deployerAddress,
    onClaimSuccess
}: AuthModalProps) {
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
            if (purpose === 'claim-ownership') {
                handleClaimOwnershipVerification();
            } else {
                handleFetchNonceAndSign();
            }
        }
    }, [isConnected, address, step]);

    const handleClaimOwnershipVerification = async () => {
        if (!address || !deployerAddress) return;

        setStep('claim-verifying');

        // Check if connected wallet matches deployer address
        const isMatch = address.toLowerCase() === deployerAddress.toLowerCase();

        await new Promise(resolve => setTimeout(resolve, 1500)); // Brief delay for UX

        if (isMatch) {
            setStep('claim-success');
            // Call the claim success callback after a brief delay
            setTimeout(() => {
                if (onClaimSuccess) {
                    onClaimSuccess();
                }
                onClose();
            }, 2000);
        } else {
            setStep('claim-failed');
            setError(`Connected wallet (${address.slice(0, 6)}...${address.slice(-4)}) does not match the contract deployer address (${deployerAddress.slice(0, 6)}...${deployerAddress.slice(-4)})`);
        }
    };

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
                needsUsername: !data.user.username,
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

    const renderContent = () => {
        // Loading states
        if (step === 'connecting' || step === 'signing' || step === 'verifying' || step === 'claim-verifying') {
            return (
                <div className="py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 relative">
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900" />
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        {step === 'connecting' && 'Connecting Wallet'}
                        {step === 'signing' && 'Sign Message'}
                        {step === 'verifying' && 'Verifying Signature'}
                        {step === 'claim-verifying' && 'Verifying Ownership'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        {step === 'connecting' && 'Approve the connection request in your wallet'}
                        {step === 'signing' && 'Sign the message to authenticate your wallet'}
                        {step === 'verifying' && 'Confirming your identity...'}
                        {step === 'claim-verifying' && 'Checking if your wallet deployed this contract...'}
                    </p>
                    {address && (
                        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                                {address.slice(0, 6)}...{address.slice(-4)}
                            </span>
                        </div>
                    )}
                </div>
            );
        }

        // Claim ownership success
        if (step === 'claim-success') {
            return (
                <div className="py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <Check size={32} className="text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        Ownership Verified
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        You've been confirmed as the contract deployer
                    </p>
                </div>
            );
        }

        // Claim ownership failed
        if (step === 'claim-failed') {
            return (
                <div className="py-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <AlertCircle size={32} className="text-red-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        Verification Failed
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-6 max-w-xs mx-auto">
                        {error}
                    </p>
                    <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-slate-800 transition-colors"
                    >
                        Try Another Wallet
                    </button>
                </div>
            );
        }

        // Error state
        if (step === 'error') {
            return (
                <div className="py-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <AlertCircle size={32} className="text-red-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        Authentication Failed
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-6">{error}</p>
                    <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-slate-800 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        // Main selection screen
        const isClaimFlow = purpose === 'claim-ownership';

        return (
            <>
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <img src={logo} alt="Uatu" className="h-7" />
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Title */}
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                        {isClaimFlow ? 'Verify Ownership' : 'Welcome Back'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isClaimFlow
                            ? 'Connect the wallet that deployed this contract'
                            : 'Choose how you want to sign in'
                        }
                    </p>
                </div>

                {/* Claim ownership info */}
                {isClaimFlow && deployerAddress && (
                    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                                <Shield size={18} className="text-indigo-600" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider mb-1">
                                    Required Deployer
                                </div>
                                <div className="text-sm font-mono text-indigo-700 dark:text-indigo-300 break-all">
                                    {deployerAddress}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {/* Wallet Methods - GitHub can only be connected via Settings */}
                    <button
                        onClick={() => handleWalletConnect('metamask')}
                        disabled={isConnecting}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group disabled:opacity-50"
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white">
                            <Wallet size={22} />
                        </div>
                        <div className="text-left flex-1">
                            <div className="text-sm font-black text-slate-900 dark:text-white">MetaMask</div>
                            <div className="text-xs text-slate-400 mt-0.5">Browser extension wallet</div>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </button>

                    <button
                        onClick={() => handleWalletConnect('wallet-connect')}
                        disabled={isConnecting}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group disabled:opacity-50"
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white">
                            <Wallet size={22} />
                        </div>
                        <div className="text-left flex-1">
                            <div className="text-sm font-black text-slate-900 dark:text-white">WalletConnect</div>
                            <div className="text-xs text-slate-400 mt-0.5">Mobile & desktop wallets</div>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </button>
                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-[10px] text-slate-400 dark:text-slate-500">
                    By continuing, you agree to our{' '}
                    <a href="/terms" className="text-slate-900 dark:text-slate-300 hover:underline">Terms</a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-slate-900 dark:text-slate-300 hover:underline">Privacy Policy</a>
                </p>
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.5 }}
                        className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto max-h-[90vh] overflow-y-auto">
                            {renderContent()}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
