/**
 * Audit Questionnaire Component
 *
 * Contract-type aware pre-audit questionnaire for the unified audit system.
 * Automatically shows relevant questions based on detected contract type.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Coins,
  Image,
  TrendingUp,
  Vote,
  Layers,
  Loader2,
  CheckCircle,
  Info,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type QuestionPriority = 'HIGH' | 'MEDIUM' | 'LOW';
type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'confirm';
type ContractCategory =
  | 'erc20-token'
  | 'erc721-nft'
  | 'erc1155-multi'
  | 'defi-amm'
  | 'defi-lending'
  | 'defi-staking'
  | 'governance'
  | 'bridge'
  | 'proxy-upgradeable'
  | 'multisig-wallet'
  | 'generic';

interface PreAuditQuestion {
  key: string;
  text: string;
  type: QuestionType;
  options?: string[];
  priority: QuestionPriority;
  category: string;
  helpText?: string;
  defaultValue?: any;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

interface ContractClassification {
  category: ContractCategory;
  subCategory?: string;
  interfaces: string[];
  patterns: string[];
  confidence: number;
}

interface QuestionnaireResponse {
  success: boolean;
  jobId: string;
  contractCategory: ContractCategory;
  auditDepth: 'quick' | 'standard' | 'deep';
  classification: ContractClassification | null;
  questions: PreAuditQuestion[];
  groupedQuestions: Record<string, PreAuditQuestion[]>;
  metadata: {
    totalQuestions: number;
    requiredQuestions: number;
    optionalQuestions: number;
    contractCategory: ContractCategory;
    categoriesIncluded: string[];
  };
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_INFO: Record<ContractCategory, { label: string; icon: any; color: string; description: string }> = {
  'erc20-token': {
    label: 'ERC20 Token',
    icon: Coins,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Fungible token contract following the ERC20 standard',
  },
  'erc721-nft': {
    label: 'ERC721 NFT',
    icon: Image,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Non-fungible token (NFT) contract following the ERC721 standard',
  },
  'erc1155-multi': {
    label: 'ERC1155 Multi-Token',
    icon: Layers,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Multi-token contract supporting both fungible and non-fungible tokens',
  },
  'defi-amm': {
    label: 'DeFi AMM',
    icon: TrendingUp,
    color: 'bg-green-50 text-green-700 border-green-200',
    description: 'Automated Market Maker for decentralized trading',
  },
  'defi-lending': {
    label: 'DeFi Lending',
    icon: TrendingUp,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Lending protocol for borrowing and lending assets',
  },
  'defi-staking': {
    label: 'DeFi Staking',
    icon: TrendingUp,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'Staking protocol for earning rewards',
  },
  'governance': {
    label: 'Governance',
    icon: Vote,
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    description: 'Governance contract for decentralized decision making',
  },
  'bridge': {
    label: 'Bridge',
    icon: Layers,
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: 'Cross-chain bridge contract',
  },
  'proxy-upgradeable': {
    label: 'Upgradeable Proxy',
    icon: Shield,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Upgradeable contract using proxy pattern',
  },
  'multisig-wallet': {
    label: 'Multisig Wallet',
    icon: Shield,
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Multi-signature wallet contract',
  },
  'generic': {
    label: 'Generic Contract',
    icon: Shield,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    description: 'Smart contract (type not detected)',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Information',
  'token-economics': 'Token Economics',
  'nft-characteristics': 'NFT Characteristics',
  'defi-security': 'DeFi Security',
  governance: 'Governance',
  proxy: 'Proxy & Upgradeability',
};

// ============================================================================
// Main Component
// ============================================================================

export default function AuditQuestionnaire() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'success' | 'error'>('loading');
  const [data, setData] = useState<QuestionnaireResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']));

  // Load questionnaire on mount
  useEffect(() => {
    if (jobId) {
      loadQuestionnaire();
    }
  }, [jobId]);

  const loadQuestionnaire = async () => {
    setStatus('loading');
    try {
      const response = await fetch(`/api/audit/${jobId}/questionnaire`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load questionnaire');
      }

      const result: QuestionnaireResponse = await response.json();
      setData(result);

      // Auto-expand first category
      if (result.metadata.categoriesIncluded.length > 0) {
        setExpandedCategories(new Set([result.metadata.categoriesIncluded[0]]));
      }

      setStatus('ready');
    } catch (error: any) {
      console.error('Failed to load questionnaire:', error);
      setErrors([error.message || 'Failed to load questionnaire']);
      setStatus('error');
    }
  };

  const handleSubmit = async () => {
    if (!data) return;

    // Validate required questions
    const validationErrors: string[] = [];
    for (const question of data.questions) {
      if (question.priority === 'HIGH' && !answers[question.key]) {
        validationErrors.push(`"${question.text}" is required`);
      }
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setStatus('submitting');
    setErrors([]);

    try {
      const response = await fetch(`/api/audit/${jobId}/questionnaire/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answers');
      }

      setStatus('success');

      // Navigate to audit details after a short delay
      setTimeout(() => {
        navigate(`/audits/${jobId}`);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to submit answers:', error);
      setErrors([error.message || 'Failed to submit answers']);
      setStatus('ready');
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getAnsweredCount = (categoryQuestions: PreAuditQuestion[]) => {
    return categoryQuestions.filter((q) => answers[q.key] !== undefined).length;
  };

  // Render loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading questionnaire...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error' || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-8">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Unable to Load Questionnaire</h3>
          <p className="text-slate-600 text-center mb-4">
            {errors[0] || 'An error occurred while loading the questionnaire'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Answers Submitted!</h3>
          <p className="text-slate-600 mb-4">Thank you for providing context. The audit will continue with your inputs.</p>
          <p className="text-sm text-slate-400">Redirecting to audit details...</p>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_INFO[data.contractCategory];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </button>

          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${categoryInfo.color}`}>
              <categoryInfo.icon size={28} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 mb-1">Pre-Audit Questionnaire</h1>
              <p className="text-slate-600">Help us understand your contract better for a more accurate audit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Classification Banner */}
      {data.classification && (
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className={`rounded-2xl border-2 p-6 ${categoryInfo.color}`}>
            <div className="flex items-start gap-4">
              <categoryInfo.icon size={32} />
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">{categoryInfo.label}</h3>
                <p className="text-sm mb-3">{categoryInfo.description}</p>
                <div className="flex flex-wrap gap-2">
                  {data.classification.interfaces.slice(0, 4).map((iface) => (
                    <span key={iface} className="px-2 py-1 bg-white/60 rounded-lg text-xs font-mono font-bold">
                      {iface}
                    </span>
                  ))}
                  {data.classification.patterns.slice(0, 3).map((pattern) => (
                    <span key={pattern} className="px-2 py-1 bg-white/40 rounded-lg text-xs font-medium">
                      {pattern}
                    </span>
                  ))}
                </div>
                <p className="text-xs mt-2 opacity-75">
                  Confidence: {data.classification.confidence}% • {data.metadata.requiredQuestions} required questions
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Progress */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900">Progress</span>
              <span className="text-sm text-slate-600">
                {Object.keys(answers).length} / {data.metadata.totalQuestions} answered
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${(Object.keys(answers).length / data.metadata.totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-200">
              <p className="text-sm font-bold text-red-900 mb-2">Please fix the following errors:</p>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Grouped Questions */}
          {Object.entries(data.groupedQuestions).map(([category, categoryQuestions]) => (
            <div key={category} className="border-b border-slate-200 last:border-b-0">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{CATEGORY_LABELS[category] || category}</h3>
                  <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600">
                    {getAnsweredCount(categoryQuestions)} / {categoryQuestions.length}
                  </span>
                </div>
                {expandedCategories.has(category) ? <Info size={20} className="text-slate-400" /> : <Info size={20} className="text-slate-400 rotate-180" />}
              </button>

              {/* Category Questions */}
              {expandedCategories.has(category) && (
                <div className="px-6 pb-6 space-y-6">
                  {categoryQuestions.map((question) => (
                    <QuestionCard
                      key={question.key}
                      question={question}
                      value={answers[question.key]}
                      onChange={(value) => setAnswers({ ...answers, [question.key]: value })}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={status === 'submitting'}
            className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Submitting...
              </>
            ) : (
              'Submit & Continue Audit'
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          Required questions are marked with <span className="text-red-500">*</span>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Question Card Component
// ============================================================================

interface QuestionCardProps {
  question: PreAuditQuestion;
  value: any;
  onChange: (value: any) => void;
}

function QuestionCard({ question, value, onChange }: QuestionCardProps) {
  const isRequired = question.priority === 'HIGH' || question.validation?.required;

  return (
    <div className="space-y-3">
      {/* Question Text */}
      <label className="block">
        <span className="text-sm font-bold text-slate-900">
          {question.text}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </span>
        {question.helpText && (
          <span className="block text-xs text-slate-500 mt-1">{question.helpText}</span>
        )}
      </label>

      {/* Input Field */}
      {question.type === 'text' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter your answer..."
        />
      )}

      {question.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter your answer..."
        />
      )}

      {question.type === 'select' && question.options && (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Select an option...</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {question.type === 'multiselect' && question.options && (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label key={option} className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={(value || []).includes(option)}
                onChange={(e) => {
                  const currentValue = value || [];
                  if (e.target.checked) {
                    onChange([...currentValue, option]);
                  } else {
                    onChange(currentValue.filter((v: string) => v !== option));
                  }
                }}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-900">{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'confirm' && (
        <label className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-900">Yes, I confirm</span>
        </label>
      )}

      {/* Priority Badge */}
      <div className="flex gap-2">
        {question.priority === 'HIGH' && (
          <span className="px-2 py-1 bg-red-50 text-red-700 text-xs font-bold rounded">Required</span>
        )}
        {question.priority === 'MEDIUM' && (
          <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs font-bold rounded">Recommended</span>
        )}
        {question.priority === 'LOW' && (
          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">Optional</span>
        )}
      </div>
    </div>
  );
}
