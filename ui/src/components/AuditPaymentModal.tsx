/**
 * Audit Payment Modal
 *
 * Displays cost estimate and handles Neurons token payment for audits.
 * Shows wallet connection, balance checking, and payment confirmation.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, AlertCircle, CheckCircle2, RefreshCw, ExternalLink, Info } from 'lucide-react';
import { useWallet, formatAddress, getNetworkName, isSupportedNetwork } from '../hooks/useWallet';
import { useNeuronsBalance, hasSufficientBalance, transferNeurons } from '../hooks/useNeuronsBalance';
import { UATU_TREASURY_ADDRESS, neuronsToWei, formatNeurons } from '../../../src/constants/neuronsToken';
import { authFetch } from '../services/authService';

interface CostEstimate {
  estimatedSloc: number;
  estimatedAiTokens: number;
  slocCostNeurons: number;
  aiTokensCostNeurons: number;
  totalEstimatedCostNeurons: number;
  reservationAmount: number;
  bufferMultiplier: number;
}

interface AuditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (reservationId: string, txHash: string) => void;
  jobId: string;
  projectName: string;
  costEstimate: CostEstimate;
}

type PaymentStep = 'connect' | 'review' | 'paying' | 'confirming' | 'complete' | 'error';

export function AuditPaymentModal({
  isOpen,
  onClose,
  onPaymentComplete,
  jobId,
  projectName,
  costEstimate,
}: AuditPaymentModalProps) {
  const wallet = useWallet();
  const balance = useNeuronsBalance(wallet.address, wallet.provider);

  const [step, setStep] = useState<PaymentStep>('connect');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  // Determine current step based on wallet state
  useEffect(() => {
    if (!isOpen) {
      setStep('connect');
      setError(null);
      setTxHash(null);
      setReservationId(null);
      return;
    }

    if (!wallet.isConnected) {
      setStep('connect');
    } else if (!isSupportedNetwork(wallet.chainId)) {
      setStep('error');
      setError(`Please switch to a supported network`);
    } else if (balance.balance !== null && !hasSufficientBalance(balance.balance, costEstimate.reservationAmount)) {
      setStep('error');
      setError(`Insufficient balance. You need ${formatNeurons(costEstimate.reservationAmount)} Neurons but have ${balance.balanceFormatted}`);
    } else if (wallet.isConnected && step === 'connect') {
      setStep('review');
    }
  }, [wallet.isConnected, wallet.chainId, balance.balance, costEstimate.reservationAmount, isOpen, step]);

  const handlePayment = async () => {
    if (!wallet.signer || !wallet.address) {
      setError('Wallet not connected');
      return;
    }

    setStep('paying');
    setError(null);

    try {
      // Step 1: Create reservation on backend
      const createRes = await authFetch(`/api/payments/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          walletAddress: wallet.address,
          chainId: wallet.chainId,
          estimatedSloc: costEstimate.estimatedSloc,
          estimatedAiTokens: costEstimate.estimatedAiTokens,
        }),
      });

      if (!createRes.ok) {
        const errorData = await createRes.json();
        throw new Error(errorData.error || 'Failed to create reservation');
      }

      const reservationData = await createRes.json();
      setReservationId(reservationData.reservationId);

      // Step 2: Transfer Neurons tokens
      const amountWei = neuronsToWei(costEstimate.reservationAmount);
      const hash = await transferNeurons(wallet.signer, UATU_TREASURY_ADDRESS, amountWei);
      setTxHash(hash);

      setStep('confirming');

      // Step 3: Confirm payment on backend
      const confirmRes = await authFetch(`/api/payments/reservations/${reservationData.reservationId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: hash,
          userBalance: balance.balance,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error('Failed to confirm payment');
      }

      setStep('complete');

      // Notify parent component
      setTimeout(() => {
        onPaymentComplete(reservationData.reservationId, hash);
      }, 2000);

    } catch (err: any) {
      console.error('Payment failed:', err);
      setStep('error');
      setError(err.message || 'Payment failed');
    }
  };

  const handleClose = () => {
    if (step === 'paying' || step === 'confirming') {
      // Don't allow closing during payment
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between rounded-t-3xl">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Audit Payment
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {projectName}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={step === 'paying' || step === 'confirming'}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={24} className="text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-6">
            {/* Cost Breakdown */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-black text-slate-900">Cost Estimate</h3>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Lines of Code (SLOC):</span>
                  <span className="font-mono font-semibold">{costEstimate.estimatedSloc.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">SLOC Cost:</span>
                  <span className="font-mono font-semibold">{formatNeurons(costEstimate.slocCostNeurons)} Neurons</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">AI Tokens (estimated):</span>
                  <span className="font-mono font-semibold">{costEstimate.estimatedAiTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">AI Tokens Cost:</span>
                  <span className="font-mono font-semibold">{formatNeurons(costEstimate.aiTokensCostNeurons)} Neurons</span>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-slate-300">
                <div className="flex justify-between text-base mb-2">
                  <span className="font-bold text-slate-900">Estimated Total:</span>
                  <span className="font-mono font-black text-slate-900">{formatNeurons(costEstimate.totalEstimatedCostNeurons)} Neurons</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-black text-indigo-600">Reservation Amount:</span>
                  <span className="font-mono font-black text-indigo-600">{formatNeurons(costEstimate.reservationAmount)} Neurons</span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <Info size={12} />
                  <span>Includes {costEstimate.bufferMultiplier}% buffer. Unused tokens will be refunded.</span>
                </div>
              </div>
            </div>

            {/* Wallet Connection Step */}
            {step === 'connect' && (
              <div className="space-y-4">
                {!wallet.isConnected ? (
                  <button
                    onClick={wallet.connect}
                    disabled={wallet.isConnecting}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-base hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wallet size={20} />
                    {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                ) : (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Wallet Connected</p>
                      <p className="text-xs text-emerald-700">{formatAddress(wallet.address!)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Review & Pay Step */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="bg-white border-2 border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Wallet:</span>
                    <span className="font-mono font-semibold">{formatAddress(wallet.address!)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Network:</span>
                    <span className="font-semibold">{getNetworkName(wallet.chainId)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Your Balance:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {balance.isLoading ? (
                        <span className="text-slate-400">Loading...</span>
                      ) : (
                        `${balance.balanceFormatted} Neurons`
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={balance.isLoading || !hasSufficientBalance(balance.balance, costEstimate.reservationAmount)}
                  className="w-full px-6 py-4 bg-indigo-600 text-white rounded-xl font-black text-base hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pay {formatNeurons(costEstimate.reservationAmount)} Neurons
                </button>
              </div>
            )}

            {/* Paying Step */}
            {step === 'paying' && (
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6 text-center space-y-3">
                <RefreshCw size={32} className="text-indigo-600 animate-spin mx-auto" />
                <p className="font-bold text-indigo-900">Processing Payment...</p>
                <p className="text-sm text-indigo-700">Please confirm the transaction in your wallet</p>
              </div>
            )}

            {/* Confirming Step */}
            {step === 'confirming' && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center space-y-3">
                <RefreshCw size={32} className="text-blue-600 animate-spin mx-auto" />
                <p className="font-bold text-blue-900">Confirming Transaction...</p>
                {txHash && (
                  <a
                    href={`https://etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2"
                  >
                    View on Etherscan
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )}

            {/* Complete Step */}
            {step === 'complete' && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6 text-center space-y-3">
                <CheckCircle2 size={48} className="text-emerald-600 mx-auto" />
                <p className="font-black text-2xl text-emerald-900">Payment Complete!</p>
                <p className="text-sm text-emerald-700">Your audit is being queued...</p>
              </div>
            )}

            {/* Error Step */}
            {step === 'error' && error && (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={24} className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-900 mb-1">Payment Failed</p>
                    <p className="text-sm text-rose-700">{error}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setStep('review');
                    setError(null);
                  }}
                  className="w-full px-4 py-2 bg-rose-600 text-white rounded-lg font-bold text-sm hover:bg-rose-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
