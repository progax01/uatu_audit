import { ReactNode, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    children: ReactNode;
}

export default function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30',
        secondary: 'bg-white text-slate-900 border-2 border-slate-200 hover:border-indigo-600',
        ghost: 'bg-transparent text-slate-900 hover:bg-slate-100',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/20',
    };

    const sizeStyles = {
        sm: 'px-6 py-2 text-[9px]',
        md: 'px-8 py-3.5 text-[10px]',
        lg: 'px-10 py-5 text-[10px]',
    };

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {children}
        </button>
    );
}
