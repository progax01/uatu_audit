import { Target, TrendingUp, TrendingDown } from 'lucide-react';

interface ScoreBreakdown {
  category: string;
  score: number;
  weight: number;
  description?: string;
}

interface ScoreCardData {
  overallScore: number;
  previousScore?: number;
  breakdown?: ScoreBreakdown[];
  grade?: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation?: string;
}

interface ScoreCardProps {
  data: ScoreCardData;
}

export default function ScoreCard({ data }: ScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50' };
    if (score >= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' };
    if (score >= 50) return { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' };
    return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' };
  };

  const getGrade = (score: number): string => {
    if (data.grade) return data.grade;
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getGradeDescription = (score: number): string => {
    if (score >= 90) return 'Excellent Security';
    if (score >= 70) return 'Good Security';
    if (score >= 50) return 'Fair Security';
    return 'Poor Security';
  };

  const scoreColor = getScoreColor(data.overallScore);
  const grade = getGrade(data.overallScore);
  const gradeDescription = getGradeDescription(data.overallScore);

  // Calculate score change if previous score exists
  const scoreDelta = data.previousScore !== undefined
    ? data.overallScore - data.previousScore
    : null;

  // Circle progress calculation
  const circumference = 2 * Math.PI * 54; // radius = 54
  const progress = (data.overallScore / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">SECURITY SCORE</h3>
            <p className="text-sm text-gray-600">Overall security assessment and grade</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Score Circle */}
          <div className="flex-shrink-0 relative">
            <svg className="transform -rotate-90" width="140" height="140">
              {/* Background circle */}
              <circle
                cx="70"
                cy="70"
                r="54"
                stroke="#e5e7eb"
                strokeWidth="12"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="70"
                cy="70"
                r="54"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                strokeLinecap="round"
                className={scoreColor.text}
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-4xl font-bold ${scoreColor.text}`}>
                {data.overallScore}
              </div>
              <div className="text-xs text-gray-500">/ 100</div>
            </div>
          </div>

          {/* Score Details */}
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-4">
              <div className={`px-4 py-2 rounded-lg ${scoreColor.light}`}>
                <div className={`text-3xl font-bold ${scoreColor.text}`}>{grade}</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{gradeDescription}</div>
                {scoreDelta !== null && (
                  <div className="flex items-center gap-1 text-sm">
                    {scoreDelta > 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-green-600 font-medium">
                          +{scoreDelta} from previous audit
                        </span>
                      </>
                    ) : scoreDelta < 0 ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <span className="text-red-600 font-medium">
                          {scoreDelta} from previous audit
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-600">No change from previous audit</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {data.recommendation && (
              <div className={`p-3 rounded-lg ${scoreColor.light} border ${scoreColor.text.replace('text-', 'border-')}`}>
                <div className="text-xs font-semibold text-gray-700 uppercase mb-1">
                  Recommendation
                </div>
                <div className="text-sm text-gray-700">{data.recommendation}</div>
              </div>
            )}
          </div>
        </div>

        {/* Score Breakdown */}
        {data.breakdown && data.breakdown.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">SCORE BREAKDOWN</h4>
            <div className="space-y-3">
              {data.breakdown.map((item, index) => {
                const itemColor = getScoreColor(item.score);
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{item.category}</span>
                        {item.description && (
                          <span className="text-xs text-gray-500">({item.description})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${itemColor.text}`}>
                          {item.score}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({item.weight}% weight)
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${itemColor.bg} transition-all duration-500`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
