import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ClarificationQuestion {
  id: string;
  questionText: string;
  questionType: 'yes-no' | 'select' | 'text' | 'multiselect';
  options?: string[];
  context: {
    file?: string;
    line?: number;
    severity?: string;
    snippet?: string;
    category?: string;
  };
  urgency: 'blocking' | 'important' | 'optional';
}

interface ClarificationModalProps {
  isOpen: boolean;
  questions: ClarificationQuestion[];
  onAnswer: (questionId: string, answer: any) => void;
  onSkip: (questionId: string) => void;
  onClose: () => void;
  jobId: string;
}

export default function ClarificationModal({
  isOpen,
  questions,
  onAnswer,
  onSkip,
  onClose,
  jobId,
}: ClarificationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [textInput, setTextInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = Object.keys(answers).length;
  const progress = ((answeredCount / questions.length) * 100).toFixed(0);

  useEffect(() => {
    // Reset input when question changes
    setTextInput('');
    setSelectedOptions([]);
  }, [currentIndex]);

  if (!isOpen || questions.length === 0) return null;

  const handleAnswer = () => {
    let answer: any;

    switch (currentQuestion.questionType) {
      case 'yes-no':
        return; // Handled by option buttons
      case 'select':
        return; // Handled by option buttons
      case 'text':
        answer = textInput.trim();
        if (!answer) return;
        break;
      case 'multiselect':
        answer = selectedOptions;
        if (selectedOptions.length === 0) return;
        break;
    }

    setAnswers({ ...answers, [currentQuestion.id]: answer });
    onAnswer(currentQuestion.id, answer);

    // Move to next question or close
    if (isLastQuestion) {
      onClose();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleOptionClick = (option: string) => {
    if (currentQuestion.questionType === 'multiselect') {
      // Toggle selection for multiselect
      if (selectedOptions.includes(option)) {
        setSelectedOptions(selectedOptions.filter((o) => o !== option));
      } else {
        setSelectedOptions([...selectedOptions, option]);
      }
    } else {
      // Single select or yes-no
      const answer = option;
      setAnswers({ ...answers, [currentQuestion.id]: answer });
      onAnswer(currentQuestion.id, answer);

      // Move to next question or close
      if (isLastQuestion) {
        onClose();
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleSkipQuestion = () => {
    onSkip(currentQuestion.id);

    if (isLastQuestion) {
      onClose();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'blocking':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'important':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'optional':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'blocking':
        return <AlertCircle className="w-4 h-4" />;
      case 'important':
        return <Clock className="w-4 h-4" />;
      case 'optional':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Clarification Needed</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close (you can answer these later)"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span>{answeredCount} answered</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-6 space-y-6">
          {/* Urgency Badge */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getUrgencyColor(currentQuestion.urgency)}`}>
              {getUrgencyIcon(currentQuestion.urgency)}
              <span className="capitalize">{currentQuestion.urgency}</span>
            </div>
            {currentQuestion.context.category && (
              <span className="text-sm text-gray-500 capitalize">
                {currentQuestion.context.category.replace(/-/g, ' ')}
              </span>
            )}
          </div>

          {/* Context Card (if code snippet available) */}
          {currentQuestion.context.snippet && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                {currentQuestion.context.file && (
                  <span className="font-mono">{currentQuestion.context.file}</span>
                )}
                {currentQuestion.context.line && (
                  <span className="text-gray-400">Line {currentQuestion.context.line}</span>
                )}
                {currentQuestion.context.severity && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    currentQuestion.context.severity === 'high' ? 'bg-red-100 text-red-700' :
                    currentQuestion.context.severity === 'medium' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {currentQuestion.context.severity}
                  </span>
                )}
              </div>
              <pre className="text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
                {currentQuestion.context.snippet}
              </pre>
            </div>
          )}

          {/* Question Text */}
          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg">
            <p className="text-lg font-medium text-gray-900">
              {currentQuestion.questionText}
            </p>
          </div>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.questionType === 'text' ? (
              <div>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Enter your answer..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows={4}
                  autoFocus
                />
              </div>
            ) : currentQuestion.questionType === 'multiselect' ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">Select all that apply:</p>
                {currentQuestion.options?.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(option)}
                      onChange={() => handleOptionClick(option)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-900">{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleOptionClick(option)}
                    className="w-full text-left px-4 py-3 border border-gray-300 rounded-xl hover:bg-indigo-50 hover:border-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span className="text-gray-900">{option}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl flex items-center justify-between">
          <button
            onClick={handleSkipQuestion}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {questions.length - currentIndex - 1} remaining
            </span>

            {(currentQuestion.questionType === 'text' || currentQuestion.questionType === 'multiselect') && (
              <button
                onClick={handleAnswer}
                disabled={
                  currentQuestion.questionType === 'text'
                    ? !textInput.trim()
                    : selectedOptions.length === 0
                }
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLastQuestion ? 'Complete' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
