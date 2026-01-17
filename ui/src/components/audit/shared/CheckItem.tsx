import RiskDot from './RiskDot';

interface CheckItemProps {
  label: string;
  value: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'safe' | 'info';
  location?: string;
  description?: string;
  className?: string;
}

export default function CheckItem({
  label,
  value,
  severity = 'safe',
  location,
  description,
  className = '',
}: CheckItemProps) {
  const getDisplayIcon = (val: string) => {
    if (val.startsWith('✅')) return null;
    if (val.startsWith('⚠️')) return null;
    if (val.startsWith('🔴')) return null;
    return <RiskDot severity={severity} size="sm" />;
  };

  return (
    <div className={`flex items-start gap-3 py-2 ${className}`}>
      <div className="flex-shrink-0 mt-1">
        {getDisplayIcon(value) || <RiskDot severity={severity} size="sm" />}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {location && (
            <span className="text-xs text-gray-500 font-mono whitespace-nowrap">{location}</span>
          )}
        </div>
        <div className="text-sm text-gray-900 mt-0.5">{value}</div>
        {description && (
          <div className="text-xs text-gray-600 mt-1">{description}</div>
        )}
      </div>
    </div>
  );
}
