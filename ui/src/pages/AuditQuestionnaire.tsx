/**
 * Audit Questionnaire - Wizard Style
 *
 * One question at a time, clean UX
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Shield, AlertCircle } from 'lucide-react';
import { ChainMultiselect } from '../components/questionnaire/ChainMultiselect';

// ============================================================================
// Types
// ============================================================================

type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'confirm';
type QuestionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

interface QuestionOption {
  value: string;
  label: string;
  icon?: string;
}

interface PreAuditQuestion {
  key: string;
  text: string;
  type: QuestionType;
  options?: string[] | QuestionOption[];
  priority: QuestionPriority;
  category: string;
  helpText?: string;
  defaultValue?: any;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  };
}

interface QuestionnaireResponse {
  success: boolean;
  jobId: string;
  questions: PreAuditQuestion[];
  metadata: {
    totalQuestions: number;
    requiredQuestions: number;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function AuditQuestionnaire() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<PreAuditQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [charCounts, setCharCounts] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch questions on mount
  useEffect(() => {
    fetchQuestions();
  }, [jobId]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/audit/${jobId}/questionnaire`);

      if (!res.ok) {
        throw new Error('Failed to load questions');
      }

      const data: QuestionnaireResponse = await res.json();
      setQuestions(data.questions || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load questionnaire');
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isRequired = currentQuestion?.priority === 'HIGH' || currentQuestion?.validation?.required;
  const currentAnswer = answers[currentQuestion?.key];

  const canProceed = () => {
    if (!currentQuestion) return false;
    if (!isRequired) return true; // Optional questions can be skipped

    // Check if required question has an answer
    if (currentQuestion.type === 'multiselect') {
      return currentAnswer && currentAnswer.length > 0;
    }
    if (currentQuestion.type === 'confirm') {
      return currentAnswer === true;
    }
    return currentAnswer && currentAnswer.trim().length > 0;
  };

  const handleNext = () => {
    const currentQ = questions[currentQuestionIndex];
    const answer = answers[currentQ.key];

    // Validate required
    if (currentQ.validation?.required && !answer) {
      setValidationError('This question is required');
      return;
    }

    // Validate text length
    if (currentQ.type === 'text' || currentQ.type === 'textarea') {
      const textAnswer = answer as string;

      if (textAnswer && currentQ.validation?.minLength && textAnswer.length < currentQ.validation.minLength) {
        setValidationError(`Minimum ${currentQ.validation.minLength} characters required`);
        return;
      }

      if (textAnswer && currentQ.validation?.maxLength && textAnswer.length > currentQ.validation.maxLength) {
        setValidationError(`Maximum ${currentQ.validation.maxLength} characters allowed`);
        return;
      }
    }

    setValidationError(null);

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const res = await fetch(`/api/audit/${jobId}/questionnaire/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit answers');
      }

      // Navigate back to audit details page
      navigate(`/audit/${jobId}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to submit answers');
      setSubmitting(false);
    }
  };

  const updateAnswer = (value: any) => {
    const currentQ = questions[currentQuestionIndex];

    // Update character count for text inputs
    if ((currentQ.type === 'text' || currentQ.type === 'textarea') && typeof value === 'string') {
      setCharCounts(prev => ({
        ...prev,
        [currentQ.key]: value.length
      }));
    }

    setAnswers({ ...answers, [currentQuestion.key]: value });
    setValidationError(null); // Clear validation error when user types
  };

  // Helper function for character counter color
  const getCharCountColor = (count: number, max: number) => {
    const percentage = (count / max) * 100;
    if (percentage >= 100) return 'text-rose-600'; // At limit
    if (percentage >= 90) return 'text-amber-600'; // Near limit
    return 'text-slate-400'; // Normal
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <span className="text-sm font-bold text-slate-600">Loading questionnaire...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Error Loading Questionnaire</h2>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // No questions
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">No Questions Required</h2>
          <p className="text-sm text-slate-600 mb-6">This audit doesn't require a pre-audit questionnaire.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Wizard UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-full mb-4">
            <Shield size={16} className="text-indigo-600" />
            <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Pre-Audit Questionnaire</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Help Us Understand Your Contract</h1>
          <p className="text-sm text-slate-600">Answer a few questions for a more accurate audit</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Progress</span>
            <span className="text-xs font-bold text-indigo-600">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          {/* Question */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-900 flex-1">
                {currentQuestion.text}
                {isRequired && <span className="text-red-500 ml-2">*</span>}
              </h2>
              {isRequired && (
                <span className="ml-4 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg whitespace-nowrap">
                  Required
                </span>
              )}
            </div>
            {currentQuestion.helpText && (
              <p className="text-sm text-slate-500">{currentQuestion.helpText}</p>
            )}
          </div>

          {/* Answer Input */}
          <div className="space-y-4">
            {/* Text Input */}
            {currentQuestion.type === 'text' && (
              <input
                type="text"
                value={currentAnswer || ''}
                onChange={(e) => updateAnswer(e.target.value)}
                className="w-full px-6 py-4 text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                placeholder="Type your answer here..."
                autoFocus
              />
            )}

            {/* Textarea */}
            {currentQuestion.type === 'textarea' && (
              <div className="space-y-2">
                <textarea
                  value={currentAnswer || ''}
                  onChange={(e) => updateAnswer(e.target.value)}
                  maxLength={currentQuestion.validation?.maxLength}
                  rows={6}
                  className="w-full px-6 py-4 text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Type your answer here..."
                  autoFocus
                />

                {/* Character Counter */}
                {currentQuestion.validation?.maxLength && (
                  <div className="flex items-center justify-between text-xs px-2">
                    <span className="text-slate-400">
                      {currentQuestion.validation.minLength &&
                        `Minimum ${currentQuestion.validation.minLength} characters`
                      }
                    </span>
                    <span className={`font-mono font-bold ${
                      getCharCountColor(
                        charCounts[currentQuestion.key] || 0,
                        currentQuestion.validation.maxLength
                      )
                    }`}>
                      {charCounts[currentQuestion.key] || 0} / {currentQuestion.validation.maxLength}
                    </span>
                  </div>
                )}

                {/* Warning when approaching limit */}
                {currentQuestion.validation?.maxLength &&
                 charCounts[currentQuestion.key] >= currentQuestion.validation.maxLength * 0.9 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle size={14} />
                    <span>
                      {charCounts[currentQuestion.key] >= currentQuestion.validation.maxLength
                        ? 'Character limit reached'
                        : 'Approaching character limit'
                      }
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Select Dropdown */}
            {currentQuestion.type === 'select' && currentQuestion.options && (
              <select
                value={currentAnswer || ''}
                onChange={(e) => updateAnswer(e.target.value)}
                className="w-full px-6 py-4 text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                autoFocus
              >
                <option value="">Select an option...</option>
                {currentQuestion.options.map((option) => (
                  <option key={option} value={option} className="text-slate-900">
                    {option}
                  </option>
                ))}
              </select>
            )}

            {/* Multi-select Checkboxes */}
            {currentQuestion.type === 'multiselect' && currentQuestion.options && (
              <>
                {/* Use ChainMultiselect for deployment_networks question */}
                {currentQuestion.key === 'deployment_networks' ? (
                  <ChainMultiselect
                    options={currentQuestion.options.map(opt =>
                      typeof opt === 'string'
                        ? { value: opt, label: opt }
                        : opt
                    )}
                    value={(currentAnswer as string[]) || []}
                    onChange={(value) => updateAnswer(value)}
                  />
                ) : (
                  /* Standard multiselect for other questions */
                  <div className="space-y-3">
                    {currentQuestion.options.map((option) => {
                      const optionValue = typeof option === 'string' ? option : option.value;
                      const optionLabel = typeof option === 'string' ? option : option.label;
                      const isChecked = (currentAnswer || []).includes(optionValue);
                      return (
                        <label
                          key={optionValue}
                          className={`flex items-center gap-4 px-6 py-4 border-2 rounded-2xl cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-500'
                              : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentValue = currentAnswer || [];
                              if (e.target.checked) {
                                updateAnswer([...currentValue, optionValue]);
                              } else {
                                updateAnswer(currentValue.filter((v: string) => v !== optionValue));
                              }
                            }}
                            className="w-6 h-6 text-indigo-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-lg font-medium text-slate-900">{optionLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Confirm Checkbox */}
            {currentQuestion.type === 'confirm' && (
              <label
                className={`flex items-center gap-4 px-6 py-4 border-2 rounded-2xl cursor-pointer transition-all ${
                  currentAnswer
                    ? 'bg-indigo-50 border-indigo-500'
                    : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={currentAnswer || false}
                  onChange={(e) => updateAnswer(e.target.checked)}
                  className="w-6 h-6 text-indigo-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-lg font-medium text-slate-900">Yes, I confirm</span>
              </label>
            )}
          </div>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={16} />
            <span className="font-medium">{validationError}</span>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-6 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-bold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ArrowLeft size={20} />
            Previous
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed() || submitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Submitting...
              </>
            ) : isLastQuestion ? (
              <>
                Submit & Continue
                <Check size={20} />
              </>
            ) : (
              <>
                Next Question
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-slate-400 text-center mt-6">
          {isRequired ? 'This question is required to continue' : 'This question is optional - you can skip it'}
        </p>
      </div>
    </div>
  );
}
