import { CheckCircle, XCircle, AlertCircle, Clock, Loader } from 'lucide-react';

type Status = 'success' | 'error' | 'warning' | 'pending' | 'loading';

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function StatusIndicator({
  status,
  label,
  size = 'md',
  className = '',
}: StatusIndicatorProps) {
  const sizeConfig = {
    sm: { icon: 'w-4 h-4', text: 'text-xs' },
    md: { icon: 'w-5 h-5', text: 'text-sm' },
    lg: { icon: 'w-6 h-6', text: 'text-base' },
  };

  const statusConfig = {
    success: {
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      label: 'Success',
    },
    error: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      label: 'Error',
    },
    warning: {
      icon: AlertCircle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      label: 'Warning',
    },
    pending: {
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      label: 'Pending',
    },
    loading: {
      icon: Loader,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      label: 'Loading',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const sizes = sizeConfig[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Icon className={`${sizes.icon} ${config.color} ${status === 'loading' ? 'animate-spin' : ''}`} />
      {label !== undefined && (
        <span className={`${sizes.text} font-medium ${config.color}`}>
          {label || config.label}
        </span>
      )}
    </div>
  );
}
