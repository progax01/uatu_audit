import {
    SiEthereum,
    SiPolygon,
    SiBinance,
    SiOptimism
} from 'react-icons/si';
import { IconType } from 'react-icons';

export interface ChainIconProps {
    className?: string;
    size?: number;
}

export const EthereumIcon = ({ className, size = 24 }: ChainIconProps) => (
    <SiEthereum className={className} size={size} />
);

export const PolygonIcon = ({ className, size = 24 }: ChainIconProps) => (
    <SiPolygon className={className} size={size} />
);

export const BSCIcon = ({ className, size = 24 }: ChainIconProps) => (
    <SiBinance className={className} size={size} />
);

export const OptimismIcon = ({ className, size = 24 }: ChainIconProps) => (
    <SiOptimism className={className} size={size} />
);

// Arbitrum doesn't have a simple-icons entry, so we'll use a custom SVG
export const ArbitrumIcon = ({ className, size = 24 }: ChainIconProps) => (
    <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm0 2.115l8.892 5.135v10.3L12 22.885l-8.892-5.135v-10.3L12 2.115z" />
        <path d="M12 6.5l-5.5 3.175v6.35L12 19.5l5.5-3.175v-6.35L12 6.5z" />
    </svg>
);

// Base chain (Coinbase)
export const BaseIcon = ({ className, size = 24 }: ChainIconProps) => (
    <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 111 111"
        fill="none"
    >
        <path
            d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H3.9565e-07C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"
            fill="currentColor"
        />
    </svg>
);

// Avalanche
export const AvalancheIcon = ({ className, size = 24 }: ChainIconProps) => (
    <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <path d="M6.25 17.5h3.5L12 13l2.25 4.5h3.5L12 6.5l-5.75 11z" />
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
);

export interface ChainInfo {
    name: string;
    icon: IconType | ((props: ChainIconProps) => JSX.Element);
    color: string;
    status: 'supported' | 'beta' | 'coming-soon';
}

export const supportedChains: ChainInfo[] = [
    { name: 'Ethereum', icon: EthereumIcon, color: '#627EEA', status: 'supported' },
    { name: 'Polygon', icon: PolygonIcon, color: '#8247E5', status: 'supported' },
    { name: 'BSC', icon: BSCIcon, color: '#F3BA2F', status: 'supported' },
    { name: 'Arbitrum', icon: ArbitrumIcon, color: '#28A0F0', status: 'supported' },
    { name: 'Optimism', icon: OptimismIcon, color: '#FF0420', status: 'supported' },
    { name: 'Base', icon: BaseIcon, color: '#0052FF', status: 'supported' },
    { name: 'Avalanche', icon: AvalancheIcon, color: '#E84142', status: 'beta' },
];
