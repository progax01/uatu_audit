import SeverityBadge from './SeverityBadge';

interface DataRowProps {
  label: string;
  value: string | number | React.ReactNode;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  tooltip?: string;
  copyable?: boolean;
  className?: string;
}

export default function DataRow({
  label,
  value,
  severity,
  tooltip,
  copyable = false,
  className = '',
}: DataRowProps) {
  const handleCopy = () => {
    if (typeof value === 'string' || typeof value === 'number') {
      navigator.clipboard.writeText(String(value));
    }
  };

  return (
    <div className={`flex items-center justify-between py-2 border-b border-gray-100 last:border-0 ${className}`}>
      <span className="text-sm font-medium text-gray-600" title={tooltip}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        {typeof value === 'string' || typeof value === 'number' ? (
          <span className="text-sm text-gray-900 font-medium">{value}</span>
        ) : (
          value
        )}
        {severity && <SeverityBadge severity={severity} size="sm" />}
        {copyable && (
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy to clipboard"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
