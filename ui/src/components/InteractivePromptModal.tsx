/**
 * Interactive Prompt Modal
 *
 * Displays during audit execution when the AI needs user input.
 * Handles multiple prompt types: single choice, multi choice, form, and contract linking.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PromptOption {
  value: string;
  label: string;
  description?: string;
  riskLevel?: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

interface FormField {
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  description?: string;
}

export interface ActivePrompt {
  id: string;
  templateId: string;
  type: 'single_choice' | 'multi_choice' | 'form' | 'contract_link' | 'address_input' | 'confirmation';
  question: string;
  description?: string;
  options?: PromptOption[];
  fields?: FormField[];
  defaultValue?: any;
  timeoutSeconds: number;
  createdAt: string;
  expiresAt: string;
  context?: {
    address?: string;
    function?: string;
    location?: string;
    stepId?: string;
    stepName?: string;
    findingId?: string;
  };
}

interface InteractivePromptModalProps {
  prompt: ActivePrompt;
  onSubmit: (promptId: string, answer: any) => Promise<void>;
  onSkip: (promptId: string) => Promise<void>;
  isSubmitting?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    none: 'bg-gray-600 text-gray-100',
    low: 'bg-green-600 text-green-100',
    medium: 'bg-yellow-600 text-yellow-100',
    high: 'bg-orange-600 text-orange-100',
    critical: 'bg-red-600 text-red-100',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level] || colors.medium}`}>
      {level}
    </span>
  );
}

function CountdownTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const calculateRemaining = () => {
      const expires = new Date(expiresAt).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((expires - now) / 1000));
    };

    setRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const newRemaining = calculateRemaining();
      setRemaining(newRemaining);
      if (newRemaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 30;
  const isWarning = remaining <= 60 && remaining > 30;

  return (
    <div
      className={`flex items-center gap-2 text-sm font-mono ${
        isUrgent ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-gray-400'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
      {isUrgent && <span className="text-xs">(Auto-skip soon)</span>}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function InteractivePromptModal({
  prompt,
  onSubmit,
  onSkip,
  isSubmitting = false,
}: InteractivePromptModalProps) {
  const [answer, setAnswer] = useState<any>(prompt.defaultValue ?? null);
  const [formData, setFormData] = useState<Record<string, any>>(
    prompt.type === 'form' ? prompt.defaultValue || {} : {}
  );
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    prompt.type === 'multi_choice' && Array.isArray(prompt.defaultValue) ? prompt.defaultValue : []
  );
  const [hasExpired, setHasExpired] = useState(false);

  // Reset state when prompt changes
  useEffect(() => {
    setAnswer(prompt.defaultValue ?? null);
    setFormData(prompt.type === 'form' ? prompt.defaultValue || {} : {});
    setSelectedOptions(
      prompt.type === 'multi_choice' && Array.isArray(prompt.defaultValue) ? prompt.defaultValue : []
    );
    setHasExpired(false);
  }, [prompt.id, prompt.type, prompt.defaultValue]);

  const handleExpire = useCallback(() => {
    setHasExpired(true);
    // Auto-skip after expiration
    setTimeout(() => {
      onSkip(prompt.id);
    }, 2000);
  }, [prompt.id, onSkip]);

  const handleSubmit = async () => {
    let finalAnswer: any;

    switch (prompt.type) {
      case 'single_choice':
      case 'contract_link':
      case 'confirmation':
        finalAnswer = answer;
        break;
      case 'multi_choice':
        finalAnswer = selectedOptions;
        break;
      case 'form':
        finalAnswer = formData;
        break;
      case 'address_input':
        finalAnswer = answer;
        break;
      default:
        finalAnswer = answer;
    }

    await onSubmit(prompt.id, finalAnswer);
  };

  const handleSkip = async () => {
    await onSkip(prompt.id);
  };

  const isValid = useMemo(() => {
    switch (prompt.type) {
      case 'single_choice':
      case 'contract_link':
        return answer !== null && answer !== undefined;
      case 'multi_choice':
        return selectedOptions.length > 0;
      case 'form':
        // Check required fields
        if (prompt.fields) {
          for (const field of prompt.fields) {
            if (field.required && !formData[field.name]) {
              return false;
            }
          }
        }
        return true;
      case 'address_input':
        return answer && /^0x[a-fA-F0-9]{40}$/.test(answer);
      case 'confirmation':
        return true;
      default:
        return true;
    }
  }, [prompt.type, prompt.fields, answer, selectedOptions, formData]);

  // Render question with markdown-like formatting
  const renderQuestion = () => {
    // Simple markdown parsing for code blocks and bold
    const parts = prompt.question.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return (
      <div className="text-lg font-medium text-white whitespace-pre-line">
        {parts.map((part, i) => {
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code key={i} className="px-1.5 py-0.5 bg-gray-700 rounded text-sm font-mono text-cyan-400">
                {part.slice(1, -1)}
              </code>
            );
          }
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  // Render single choice options
  const renderSingleChoice = () => (
    <div className="space-y-2">
      {prompt.options?.map((option) => (
        <label
          key={option.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            answer === option.value
              ? 'border-cyan-500 bg-cyan-900/20'
              : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
          }`}
        >
          <input
            type="radio"
            name="single-choice"
            value={option.value}
            checked={answer === option.value}
            onChange={(e) => setAnswer(e.target.value)}
            className="mt-1 accent-cyan-500"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{option.label}</span>
              {option.riskLevel && <RiskBadge level={option.riskLevel} />}
            </div>
            {option.description && <p className="text-sm text-gray-400 mt-0.5">{option.description}</p>}
          </div>
        </label>
      ))}
    </div>
  );

  // Render multi choice options
  const renderMultiChoice = () => (
    <div className="space-y-2">
      {prompt.options?.map((option) => (
        <label
          key={option.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedOptions.includes(option.value)
              ? 'border-cyan-500 bg-cyan-900/20'
              : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
          }`}
        >
          <input
            type="checkbox"
            value={option.value}
            checked={selectedOptions.includes(option.value)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedOptions([...selectedOptions, option.value]);
              } else {
                setSelectedOptions(selectedOptions.filter((v) => v !== option.value));
              }
            }}
            className="mt-1 accent-cyan-500"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{option.label}</span>
              {option.riskLevel && <RiskBadge level={option.riskLevel} />}
            </div>
            {option.description && <p className="text-sm text-gray-400 mt-0.5">{option.description}</p>}
          </div>
        </label>
      ))}
    </div>
  );

  // Render form fields
  const renderForm = () => (
    <div className="space-y-4">
      {prompt.fields?.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>

          {field.type === 'text' && (
            <input
              type="text"
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: parseInt(e.target.value) || 0 })}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            />
          )}

          {field.type === 'select' && (
            <select
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {field.type === 'boolean' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData[field.name] || false}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-gray-300">{field.description || 'Yes'}</span>
            </label>
          )}

          {field.description && field.type !== 'boolean' && (
            <p className="text-xs text-gray-500 mt-1">{field.description}</p>
          )}
        </div>
      ))}
    </div>
  );

  // Render contract link options
  const renderContractLink = () => (
    <div className="space-y-2">
      {prompt.options?.map((option) => (
        <button
          key={option.value}
          onClick={() => setAnswer(option.value)}
          className={`w-full text-left p-4 rounded-lg border transition-colors ${
            answer === option.value
              ? 'border-cyan-500 bg-cyan-900/20'
              : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
          }`}
        >
          <div className="font-medium text-white">{option.label}</div>
          {option.description && <p className="text-sm text-gray-400 mt-1">{option.description}</p>}
        </button>
      ))}
    </div>
  );

  // Render address input
  const renderAddressInput = () => (
    <div>
      <input
        type="text"
        value={answer || ''}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="0x..."
        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
      />
      {answer && !/^0x[a-fA-F0-9]{40}$/.test(answer) && (
        <p className="text-sm text-red-400 mt-1">Please enter a valid Ethereum address (0x...)</p>
      )}
    </div>
  );

  // Render confirmation
  const renderConfirmation = () => (
    <div className="flex gap-4">
      <button
        onClick={() => setAnswer(true)}
        className={`flex-1 py-3 rounded-lg border font-medium transition-colors ${
          answer === true ? 'border-green-500 bg-green-900/30 text-green-400' : 'border-gray-600 text-gray-300 hover:border-green-500'
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => setAnswer(false)}
        className={`flex-1 py-3 rounded-lg border font-medium transition-colors ${
          answer === false ? 'border-red-500 bg-red-900/30 text-red-400' : 'border-gray-600 text-gray-300 hover:border-red-500'
        }`}
      >
        No
      </button>
    </div>
  );

  // Show expired overlay
  if (hasExpired) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-900/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Time Expired</h3>
          <p className="text-gray-400">Using default value and continuing audit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">Input Needed</h2>
              {prompt.context?.stepName && (
                <p className="text-xs text-gray-500">{prompt.context.stepName}</p>
              )}
            </div>
          </div>
          <CountdownTimer expiresAt={prompt.expiresAt} onExpire={handleExpire} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Question */}
          <div className="mb-4">{renderQuestion()}</div>

          {/* Description */}
          {prompt.description && (
            <p className="text-sm text-gray-400 mb-6 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {prompt.description}
            </p>
          )}

          {/* Context info */}
          {prompt.context && (prompt.context.address || prompt.context.function || prompt.context.location) && (
            <div className="mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Context</div>
              <div className="space-y-1 text-sm">
                {prompt.context.address && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Address:</span>
                    <code className="text-cyan-400 font-mono text-xs">{prompt.context.address}</code>
                  </div>
                )}
                {prompt.context.function && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Function:</span>
                    <code className="text-yellow-400 font-mono text-xs">{prompt.context.function}</code>
                  </div>
                )}
                {prompt.context.location && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Location:</span>
                    <span className="text-gray-300 text-xs">{prompt.context.location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input area based on type */}
          <div className="mb-4">
            {prompt.type === 'single_choice' && renderSingleChoice()}
            {prompt.type === 'multi_choice' && renderMultiChoice()}
            {prompt.type === 'form' && renderForm()}
            {prompt.type === 'contract_link' && renderContractLink()}
            {prompt.type === 'address_input' && renderAddressInput()}
            {prompt.type === 'confirmation' && renderConfirmation()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Skip (use default)
          </button>
          <div className="flex items-center gap-3">
            {prompt.defaultValue !== undefined && (
              <span className="text-xs text-gray-500">
                Default: {typeof prompt.defaultValue === 'object' ? 'configured' : String(prompt.defaultValue)}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
