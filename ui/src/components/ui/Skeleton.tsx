import { motion } from 'framer-motion';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    lines?: number;
}

export default function Skeleton({
    className = '',
    variant = 'rectangular',
    width,
    height,
    lines = 1
}: SkeletonProps) {
    const baseStyles = 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-shimmer';

    const variantStyles = {
        text: 'h-4 rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-xl',
    };

    const style = {
        width: width || '100%',
        height: height || (variant === 'text' ? '1rem' : '100%'),
    };

    if (variant === 'text' && lines > 1) {
        return (
            <div className="space-y-3">
                {Array.from({ length: lines }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`${baseStyles} ${variantStyles.text} ${className}`}
                        style={{ width: i === lines - 1 ? '80%' : '100%', height: '1rem' }}
                    />
                ))}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            style={style}
        />
    );
}

// Card Skeleton Component
export function CardSkeleton({ count = 1 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card p-8">
                    <Skeleton variant="circular" width={64} height={64} className="mb-6" />
                    <Skeleton variant="text" width="60%" className="mb-3" />
                    <Skeleton variant="text" lines={3} />
                </div>
            ))}
        </>
    );
}

// Page Skeleton Component
export function PageSkeleton() {
    return (
        <div className="min-h-screen bg-base pt-32 pb-20">
            <div className="max-w-7xl mx-auto px-10">
                {/* Hero Skeleton */}
                <div className="text-center mb-20">
                    <Skeleton variant="rectangular" width={200} height={40} className="mx-auto mb-10" />
                    <Skeleton variant="text" width="80%" height={60} className="mx-auto mb-4" />
                    <Skeleton variant="text" width="60%" height={60} className="mx-auto mb-8" />
                    <Skeleton variant="text" width="70%" className="mx-auto mb-12" />
                    <div className="flex gap-4 justify-center">
                        <Skeleton variant="rectangular" width={180} height={60} />
                        <Skeleton variant="rectangular" width={180} height={60} />
                    </div>
                </div>

                {/* Content Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <CardSkeleton count={6} />
                </div>
            </div>
        </div>
    );
}
