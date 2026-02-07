/**
 * Neurons Wallet Widget
 * Displays wallet connection and Neurons token balance
 */

import { useState } from 'react';
import { Wallet, RefreshCw, AlertCircle } from 'lucide-react';
import { useWallet, formatAddress, getNetworkName } from '../hooks/useWallet';
import { useNeuronsBalance } from '../hooks/useNeuronsBalance';

export function NeuronsWalletWidget() {
  const wallet = useWallet();
  const balance = useNeuronsBalance(wallet.address, wallet.provider);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!wallet.isConnected) {
    return (
      <button
        onClick={wallet.connect}
        disabled={wallet.isConnecting}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wallet size={16} />
        {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-slate-200 rounded-lg hover:border-indigo-300 transition-colors"
      >
        <Wallet size={16} className="text-indigo-600" />
        <div className="text-left">
          <div className="text-xs font-bold text-indigo-600">
            {balance.isLoading ? (
              <RefreshCw size={12} className="animate-spin inline" />
            ) : (
              `${balance.balanceFormatted} Neurons`
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {formatAddress(wallet.address!)}
          </div>
        </div>
      </button>

      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-80 bg-white border-2 border-slate-200 rounded-xl shadow-2xl z-50 p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-slate-900">Wallet Details</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Balance */}
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                Neurons Balance
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-black text-indigo-900">
                  {balance.isLoading ? (
                    <RefreshCw size={24} className="animate-spin" />
                  ) : (
                    balance.balanceFormatted
                  )}
                </div>
                <button
                  onClick={balance.refetch}
                  className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                  title="Refresh balance"
                >
                  <RefreshCw size={16} className="text-indigo-600" />
                </button>
              </div>
            </div>

            {/* Wallet Info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Address:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatAddress(wallet.address!)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Network:</span>
                <span className="font-semibold text-slate-900">
                  {getNetworkName(wallet.chainId)}
                </span>
              </div>
            </div>

            {/* Error */}
            {balance.error && (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-rose-700">{balance.error}</div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(wallet.address!);
                  alert('Address copied to clipboard!');
                }}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-200 transition-colors"
              >
                Copy Address
              </button>
              <button
                onClick={() => {
                  wallet.disconnect();
                  setIsExpanded(false);
                }}
                className="w-full px-4 py-2 bg-rose-100 text-rose-700 rounded-lg font-semibold text-sm hover:bg-rose-200 transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
