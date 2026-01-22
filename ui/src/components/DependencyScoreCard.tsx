import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Shield, Package } from 'lucide-react';

export interface DependencyScore {
  library: string;           // "OpenZeppelin Contracts"
  version?: string;          // "4.8.0"
  score: number;             // 0-100
  grade: string;             // "A", "B", "C", etc.
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface DependencyScoreCardProps {
  dependencies: DependencyScore[];
}

const getRiskColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'critical':
      return 'bg-rose-500 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-amber-500 text-white';
    case 'low':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
};

const getGradeColor = (grade: string) => {
  if (grade.startsWith('A')) return 'text-emerald-600';
  if (grade.startsWith('B')) return 'text-blue-600';
  if (grade.startsWith('C')) return 'text-amber-600';
  if (grade.startsWith('D')) return 'text-orange-600';
  return 'text-rose-600'; // F
};

const getRiskIcon = (riskLevel: string) => {
  switch (riskLevel) {
    case 'critical':
    case 'high':
      return <AlertTriangle className="w-5 h-5" />;
    case 'medium':
      return <Shield className="w-5 h-5" />;
    case 'low':
      return <CheckCircle2 className="w-5 h-5" />;
    default:
      return <Package className="w-5 h-5" />;
  }
};

export function DependencyScoreCard({ dependencies }: DependencyScoreCardProps) {
  if (!dependencies || dependencies.length === 0) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-12 text-center">
        <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={48} />
        <h3 className="text-xl font-black text-emerald-900 tracking-tight mb-2">
          No Dependency Issues
        </h3>
        <p className="text-sm text-emerald-700 font-medium">
          All third-party libraries passed security checks with flying colors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-indigo-600 pl-6 mb-8">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
          Dependency Audit Scores
        </h3>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          Individual security grades for each third-party library
        </p>
      </div>

      <div className="grid gap-6">
        {dependencies.map((dep, index) => (
          <motion.div
            key={dep.library}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white border-2 border-slate-200 rounded-3xl p-8 hover:border-indigo-300 transition-all duration-300 shadow-sm hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-6">
              {/* Left: Library Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-5 h-5 text-slate-400" />
                  <h4 className="text-lg font-black text-slate-900 tracking-tight">
                    {dep.library}
                  </h4>
                </div>
                {dep.version && (
                  <p className="text-sm text-slate-500 font-mono font-medium ml-8">
                    v{dep.version}
                  </p>
                )}

                {/* Findings Breakdown */}
                <div className="flex flex-wrap gap-4 mt-6 ml-8">
                  {dep.findingsCount.critical > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="text-sm font-bold text-rose-700">
                        {dep.findingsCount.critical} Critical
                      </span>
                    </div>
                  )}
                  {dep.findingsCount.high > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm font-bold text-orange-700">
                        {dep.findingsCount.high} High
                      </span>
                    </div>
                  )}
                  {dep.findingsCount.medium > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm font-bold text-amber-700">
                        {dep.findingsCount.medium} Medium
                      </span>
                    </div>
                  )}
                  {dep.findingsCount.low > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm font-bold text-blue-700">
                        {dep.findingsCount.low} Low
                      </span>
                    </div>
                  )}
                  {dep.findingsCount.critical === 0 && dep.findingsCount.high === 0 &&
                   dep.findingsCount.medium === 0 && dep.findingsCount.low === 0 && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-bold text-emerald-700">
                        Informational only
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Score & Grade */}
              <div className="flex items-center gap-8">
                {/* Risk Badge */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${getRiskColor(dep.riskLevel)} flex items-center gap-2`}>
                    {getRiskIcon(dep.riskLevel)}
                    {dep.riskLevel}
                  </div>
                </div>

                {/* Score & Grade */}
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-5xl font-black text-slate-900 tracking-tight">
                      {dep.score}
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Score
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-5xl font-black tracking-tight ${getGradeColor(dep.grade)}`}>
                      {dep.grade}
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Grade
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6 h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dep.score}%` }}
                transition={{ delay: index * 0.1 + 0.2, duration: 0.8, ease: 'easeOut' }}
                className={`h-full ${
                  dep.score >= 90 ? 'bg-emerald-500' :
                  dep.score >= 75 ? 'bg-blue-500' :
                  dep.score >= 60 ? 'bg-amber-500' :
                  dep.score >= 50 ? 'bg-orange-500' :
                  'bg-rose-500'
                }`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t-2 border-slate-200">
        <div className="text-center p-4 bg-slate-50 rounded-2xl">
          <div className="text-2xl font-black text-slate-900">{dependencies.length}</div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            Dependencies Analyzed
          </div>
        </div>
        <div className="text-center p-4 bg-rose-50 rounded-2xl">
          <div className="text-2xl font-black text-rose-600">
            {dependencies.filter(d => d.riskLevel === 'critical' || d.riskLevel === 'high').length}
          </div>
          <div className="text-xs font-bold text-rose-700 uppercase tracking-widest mt-1">
            High Risk Libraries
          </div>
        </div>
        <div className="text-center p-4 bg-emerald-50 rounded-2xl">
          <div className="text-2xl font-black text-emerald-600">
            {dependencies.filter(d => d.riskLevel === 'low').length}
          </div>
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-widest mt-1">
            Low Risk Libraries
          </div>
        </div>
      </div>
    </div>
  );
}
