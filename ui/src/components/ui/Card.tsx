import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({ children, className = '', hover = false, padding = 'md' }: CardProps) {
    const paddingStyles = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-10',
    };

    return (
        <div
            className={`
        bg-white rounded-2xl border border-black/[0.04] shadow-sm
        ${hover ? 'hover:shadow-xl transition-all duration-500' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
        >
            {children}
        </div>
    );
}
