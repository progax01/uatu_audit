/**
 * useInteractivePrompts Hook
 *
 * Connects to the SSE endpoint for real-time prompt delivery during interactive audits.
 * Manages prompt state and provides methods for answering/skipping prompts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

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

interface SSEMessage {
  type: 'prompt' | 'status' | 'progress' | 'complete' | 'error';
  payload: any;
}

interface UseInteractivePromptsOptions {
  jobId: string;
  enabled?: boolean;
  onPromptReceived?: (prompt: ActivePrompt) => void;
  onPromptExpired?: (promptId: string) => void;
  onStatusChange?: (status: string) => void;
  onProgress?: (progress: any) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

interface UseInteractivePromptsReturn {
  activePrompt: ActivePrompt | null;
  promptHistory: ActivePrompt[];
  isConnected: boolean;
  isSubmitting: boolean;
  connectionError: string | null;
  submitAnswer: (promptId: string, answer: any) => Promise<void>;
  skipPrompt: (promptId: string) => Promise<void>;
  reconnect: () => void;
  disconnect: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useInteractivePrompts({
  jobId,
  enabled = true,
  onPromptReceived,
  onPromptExpired,
  onStatusChange,
  onProgress,
  onComplete,
  onError,
}: UseInteractivePromptsOptions): UseInteractivePromptsReturn {
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);
  const [promptHistory, setPromptHistory] = useState<ActivePrompt[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Get base URL for API calls
  const getBaseUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!enabled || !jobId) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${getBaseUrl()}/api/audit/${jobId}/prompts/stream`;
    console.log('[SSE] Connecting to:', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connected');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        console.log('[SSE] Message received:', message.type);

        switch (message.type) {
          case 'prompt':
            const prompt = message.payload as ActivePrompt;
            setActivePrompt(prompt);
            setPromptHistory((prev) => [...prev, prompt]);
            onPromptReceived?.(prompt);
            break;

          case 'status':
            onStatusChange?.(message.payload.status);
            break;

          case 'progress':
            onProgress?.(message.payload);
            break;

          case 'complete':
            onComplete?.(message.payload);
            // Clear active prompt on completion
            setActivePrompt(null);
            break;

          case 'error':
            onError?.(message.payload.message || 'Unknown error');
            break;
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      setIsConnected(false);

      // Attempt reconnection with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        setConnectionError('Failed to connect after multiple attempts');
        onError?.('Connection lost');
      }
    };
  }, [jobId, enabled, getBaseUrl, onPromptReceived, onStatusChange, onProgress, onComplete, onError]);

  // Disconnect from SSE endpoint
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  // Reconnect manually
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [disconnect, connect]);

  // Submit answer to prompt
  const submitAnswer = useCallback(
    async (promptId: string, answer: any) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`${getBaseUrl()}/api/audit/${jobId}/prompts/${promptId}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ answer }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to submit answer');
        }

        // Clear active prompt after successful submission
        setActivePrompt(null);
      } catch (err) {
        console.error('[Prompt] Failed to submit answer:', err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [jobId, getBaseUrl]
  );

  // Skip prompt (use default value)
  const skipPrompt = useCallback(
    async (promptId: string) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`${getBaseUrl()}/api/audit/${jobId}/prompts/${promptId}/skip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to skip prompt');
        }

        // Clear active prompt after successful skip
        setActivePrompt(null);
      } catch (err) {
        console.error('[Prompt] Failed to skip prompt:', err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [jobId, getBaseUrl]
  );

  // Handle prompt expiration
  useEffect(() => {
    if (!activePrompt) return;

    const expiresAt = new Date(activePrompt.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry <= 0) {
      // Already expired
      onPromptExpired?.(activePrompt.id);
      return;
    }

    const timeout = setTimeout(() => {
      onPromptExpired?.(activePrompt.id);
    }, timeUntilExpiry);

    return () => clearTimeout(timeout);
  }, [activePrompt, onPromptExpired]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return {
    activePrompt,
    promptHistory,
    isConnected,
    isSubmitting,
    connectionError,
    submitAnswer,
    skipPrompt,
    reconnect,
    disconnect,
  };
}

// ============================================================================
// Polling Alternative (for environments where SSE doesn't work)
// ============================================================================

export function useInteractivePromptsPolling({
  jobId,
  enabled = true,
  pollInterval = 2000,
  onPromptReceived,
  onPromptExpired,
}: Omit<UseInteractivePromptsOptions, 'onStatusChange' | 'onProgress' | 'onComplete' | 'onError'> & {
  pollInterval?: number;
}): Omit<UseInteractivePromptsReturn, 'reconnect' | 'disconnect'> {
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);
  const [promptHistory, setPromptHistory] = useState<ActivePrompt[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const lastPromptIdRef = useRef<string | null>(null);

  const getBaseUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }, []);

  // Poll for active prompts
  useEffect(() => {
    if (!enabled || !jobId) return;

    const poll = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/audit/${jobId}/prompts/pending`);
        if (!response.ok) {
          throw new Error('Failed to fetch prompts');
        }

        const data = await response.json();
        setIsConnected(true);
        setConnectionError(null);

        if (data.prompts && data.prompts.length > 0) {
          const latestPrompt = data.prompts[0];
          if (latestPrompt.id !== lastPromptIdRef.current) {
            lastPromptIdRef.current = latestPrompt.id;
            setActivePrompt(latestPrompt);
            setPromptHistory((prev) => [...prev, latestPrompt]);
            onPromptReceived?.(latestPrompt);
          }
        }
      } catch (err) {
        console.error('[Polling] Error:', err);
        setIsConnected(false);
        setConnectionError(err instanceof Error ? err.message : 'Connection error');
      }
    };

    // Initial poll
    poll();

    // Set up polling interval
    const interval = setInterval(poll, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, jobId, pollInterval, getBaseUrl, onPromptReceived]);

  // Submit answer
  const submitAnswer = useCallback(
    async (promptId: string, answer: any) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`${getBaseUrl()}/api/audit/${jobId}/prompts/${promptId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to submit answer');
        }

        setActivePrompt(null);
        lastPromptIdRef.current = null;
      } catch (err) {
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [jobId, getBaseUrl]
  );

  // Skip prompt
  const skipPrompt = useCallback(
    async (promptId: string) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`${getBaseUrl()}/api/audit/${jobId}/prompts/${promptId}/skip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to skip prompt');
        }

        setActivePrompt(null);
        lastPromptIdRef.current = null;
      } catch (err) {
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [jobId, getBaseUrl]
  );

  // Handle expiration
  useEffect(() => {
    if (!activePrompt) return;

    const expiresAt = new Date(activePrompt.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry <= 0) {
      onPromptExpired?.(activePrompt.id);
      return;
    }

    const timeout = setTimeout(() => {
      onPromptExpired?.(activePrompt.id);
    }, timeUntilExpiry);

    return () => clearTimeout(timeout);
  }, [activePrompt, onPromptExpired]);

  return {
    activePrompt,
    promptHistory,
    isConnected,
    isSubmitting,
    connectionError,
    submitAnswer,
    skipPrompt,
  };
}

export default useInteractivePrompts;
