import { ReactNode } from 'react';

interface BadgeProps {
    children: ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md';
}

export default function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
    const variantStyles = {
        default: 'bg-slate-100 text-slate-700',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        danger: 'bg-red-100 text-red-700',
        info: 'bg-indigo-100 text-indigo-700',
    };

    const sizeStyles = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${variantStyles[variant]} ${sizeStyles[size]}`}>
            {children}
        </span>
    );
}
