/**
 * ChainMultiselect Component
 *
 * Displays blockchain network options with icons for multi-selection
 */

import {
  EthereumIcon,
  PolygonIcon,
  BSCIcon,
  ArbitrumIcon,
  OptimismIcon,
  BaseIcon,
  AvalancheIcon,
  SolanaIcon,
  StellarIcon
} from '../icons/CryptoIcons';
import { Check } from 'lucide-react';

interface ChainOption {
  value: string;
  label: string;
  icon?: string;
}

interface ChainMultiselectProps {
  options: ChainOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'ethereum': EthereumIcon,
  'polygon': PolygonIcon,
  'bsc': BSCIcon,
  'binance': BSCIcon,
  'arbitrum': ArbitrumIcon,
  'optimism': OptimismIcon,
  'base': BaseIcon,
  'avalanche': AvalancheIcon,
  'solana': SolanaIcon,
  'stellar': StellarIcon,
};

export function ChainMultiselect({ options, value, onChange }: ChainMultiselectProps) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map(option => {
        const isSelected = value.includes(option.value);
        const IconComponent = option.icon ? ICON_MAP[option.icon.toLowerCase()] : null;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleOption(option.value)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              isSelected
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            {/* Chain Icon */}
            {IconComponent && (
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                <IconComponent size={28} className="text-slate-700" />
              </div>
            )}

            {/* Label */}
            <span className={`font-medium flex-1 ${
              isSelected ? 'text-indigo-900' : 'text-slate-700'
            }`}>
              {option.label}
            </span>

            {/* Checkbox Indicator */}
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
              isSelected
                ? 'bg-indigo-500 border-indigo-500'
                : 'border-slate-300 bg-white'
            }`}>
              {isSelected && (
                <Check size={14} className="text-white" strokeWidth={3} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
