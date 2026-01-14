/**
 * Interactive Prompt Overlay
 *
 * A wrapper component that combines the useInteractivePrompts hook with
 * the InteractivePromptModal for easy integration into audit pages.
 */

import { useCallback, useState } from 'react';
import InteractivePromptModal, { type ActivePrompt } from './InteractivePromptModal';
import { useInteractivePrompts } from '../hooks/useInteractivePrompts';

// ============================================================================
// Types
// ============================================================================

interface InteractivePromptOverlayProps {
  jobId: string;
  enabled?: boolean;
  onPromptAnswered?: (promptId: string, answer: any) => void;
  onPromptSkipped?: (promptId: string) => void;
  onStatusChange?: (status: string) => void;
  onProgress?: (progress: any) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function InteractivePromptOverlay({
  jobId,
  enabled = true,
  onPromptAnswered,
  onPromptSkipped,
  onStatusChange,
  onProgress,
  onComplete,
  onError,
}: InteractivePromptOverlayProps) {
  const [error, setError] = useState<string | null>(null);

  const handlePromptReceived = useCallback((prompt: ActivePrompt) => {
    console.log('[Overlay] Prompt received:', prompt.id);
  }, []);

  const handlePromptExpired = useCallback(
    (promptId: string) => {
      console.log('[Overlay] Prompt expired:', promptId);
      // Auto-skip expired prompts
      skipPrompt(promptId);
    },
    []
  );

  const {
    activePrompt,
    isSubmitting,
    connectionError,
    submitAnswer,
    skipPrompt,
    reconnect,
  } = useInteractivePrompts({
    jobId,
    enabled,
    onPromptReceived: handlePromptReceived,
    onPromptExpired: handlePromptExpired,
    onStatusChange,
    onProgress,
    onComplete,
    onError,
  });

  const handleSubmit = useCallback(
    async (promptId: string, answer: any) => {
      try {
        await submitAnswer(promptId, answer);
        onPromptAnswered?.(promptId, answer);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit answer';
        setError(message);
        onError?.(message);
      }
    },
    [submitAnswer, onPromptAnswered, onError]
  );

  const handleSkip = useCallback(
    async (promptId: string) => {
      try {
        await skipPrompt(promptId);
        onPromptSkipped?.(promptId);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to skip prompt';
        setError(message);
        onError?.(message);
      }
    },
    [skipPrompt, onPromptSkipped, onError]
  );

  // Show connection error banner
  if (connectionError && !activePrompt) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-red-900/90 border border-red-700 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-800 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-red-200">Connection Lost</h4>
              <p className="text-sm text-red-300 mt-1">{connectionError}</p>
              <button
                onClick={reconnect}
                className="mt-2 text-sm text-red-200 hover:text-white underline"
              >
                Try reconnecting
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error toast
  if (error) {
    return (
      <>
        {activePrompt && (
          <InteractivePromptModal
            prompt={activePrompt}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            isSubmitting={isSubmitting}
          />
        )}
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-red-900/90 border border-red-700 rounded-lg p-4 shadow-lg max-w-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-200">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show prompt modal when active
  if (activePrompt) {
    return (
      <InteractivePromptModal
        prompt={activePrompt}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
        isSubmitting={isSubmitting}
      />
    );
  }

  // Nothing to show
  return null;
}

// ============================================================================
// Connection Status Indicator (optional helper component)
// ============================================================================

interface ConnectionStatusProps {
  jobId: string;
  enabled?: boolean;
}

export function InteractiveConnectionStatus({ jobId, enabled = true }: ConnectionStatusProps) {
  const { isConnected, connectionError, reconnect } = useInteractivePrompts({
    jobId,
    enabled,
  });

  if (!enabled) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="w-2 h-2 rounded-full bg-gray-500" />
        <span>Interactive mode disabled</span>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span>Connection error</span>
        <button onClick={reconnect} className="underline hover:text-red-300">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}
      />
      <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
        {isConnected ? 'Connected' : 'Connecting...'}
      </span>
    </div>
  );
}

// ============================================================================
// Prompt History Panel (optional helper component)
// ============================================================================

interface PromptHistoryPanelProps {
  jobId: string;
  enabled?: boolean;
}

export function InteractivePromptHistory({ jobId, enabled = true }: PromptHistoryPanelProps) {
  const { promptHistory } = useInteractivePrompts({ jobId, enabled });

  if (promptHistory.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No prompts answered yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {promptHistory.map((prompt, index) => (
        <div key={prompt.id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">#{index + 1}</span>
            <span className="text-xs text-gray-500">
              {new Date(prompt.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm text-white truncate">{prompt.question.split('\n')[0]}</div>
          {prompt.context?.stepName && (
            <div className="text-xs text-gray-500 mt-1">{prompt.context.stepName}</div>
          )}
        </div>
      ))}
    </div>
  );
}
