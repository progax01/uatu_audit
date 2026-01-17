interface RiskDotProps {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'safe' | 'info';
  size?: 'sm' | 'md' | 'lg';
  pulsate?: boolean;
  className?: string;
}

export default function RiskDot({ severity, size = 'md', pulsate = false, className = '' }: RiskDotProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const severityConfig = {
    critical: 'bg-red-600',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    safe: 'bg-green-500',
    info: 'bg-gray-400',
  };

  return (
    <span className={`relative inline-flex ${className}`}>
      <span
        className={`rounded-full ${sizeClasses[size]} ${severityConfig[severity]} ${pulsate ? 'animate-pulse' : ''}`}
      />
      {pulsate && (
        <span
          className={`absolute inline-flex rounded-full opacity-75 ${sizeClasses[size]} ${severityConfig[severity]} animate-ping`}
        />
      )}
    </span>
  );
}
