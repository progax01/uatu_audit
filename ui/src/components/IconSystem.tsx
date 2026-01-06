import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    className?: string;
}

export const PremiumShield: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path
            d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-20"
        />
        <path
            d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
            stroke="url(#shield_grad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M12 7V12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        <defs>
            <linearGradient id="shield_grad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="currentColor" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.3" />
            </linearGradient>
        </defs>
    </svg>
);

export const PremiumRadar: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
        <path
            d="M12 3V12L18.5 18.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-[spin_4s_linear_infinite]"
            style={{ transformOrigin: '12px 12px' }}
        />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
);

export const PremiumCode: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path
            d="M16 18L22 12L16 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M8 6L2 12L8 18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M14 4L10 20"
            stroke="url(#code_grad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <defs>
            <linearGradient id="code_grad" x1="12" y1="4" x2="12" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="currentColor" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.2" />
            </linearGradient>
        </defs>
    </svg>
);

export const PremiumAnalytics: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path
            d="M21 21H3V3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M7 14L11 10L15 14L21 8"
            stroke="url(#anal_grad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M21 8H17V12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-50"
        />
        <defs>
            <linearGradient id="anal_grad" x1="14" y1="8" x2="14" y2="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="currentColor" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.3" />
            </linearGradient>
        </defs>
    </svg>
);

export const PremiumBlocks: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="opacity-50" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="opacity-50" />
        <path d="M10 6.5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-30" />
        <path d="M6.5 10V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-30" />
        <path d="M17.5 10V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-30" />
        <path d="M10 17.5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-30" />
    </svg>
);
