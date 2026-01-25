import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, ExternalLink, GitBranch } from 'lucide-react';

interface FindingClarificationModalProps {
  finding: any;
  onSubmit: (clarification: FindingClarification) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
}

export interface FindingClarification {
  findingId: string;
  clarificationType: 'false_positive' | 'mitigated' | 'accepted_risk' | 'already_fixed';
  explanation: string;
  evidenceUrl?: string;
  context?: Record<string, any>;
  resolvedInCommit?: boolean;
  commitSha?: string;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
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

export function FindingClarificationModal({
  finding,
  onSubmit,
  onClose,
  isOpen,
}: FindingClarificationModalProps) {
  const [clarificationType, setClarificationType] = useState<string>('');
  const [explanation, setExplanation] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [resolvedInCommit, setResolvedInCommit] = useState(false);
  const [commitSha, setCommitSha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form if editing existing clarification
  useEffect(() => {
    if (finding?.existingClarification && isOpen) {
      const existing = finding.existingClarification
      setClarificationType(existing.clarificationType || '')
      setExplanation(existing.explanation || '')
      setEvidenceUrl(existing.evidenceUrl || '')
      setResolvedInCommit(existing.resolvedInCommit || false)
      setCommitSha(existing.commitSha || '')
    } else if (isOpen) {
      // Reset form for new clarification
      setClarificationType('')
      setExplanation('')
      setEvidenceUrl('')
      setResolvedInCommit(false)
      setCommitSha('')
    }
  }, [finding, isOpen])

  const handleSubmit = async () => {
    if (!clarificationType || !explanation) {
      setError('Please select a clarification type and provide an explanation');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        findingId: finding.title, // Use title as stable ID, not the temporary vuln-{idx} ID
        clarificationType: clarificationType as any,
        explanation,
        evidenceUrl: evidenceUrl || undefined,
        resolvedInCommit: resolvedInCommit || undefined,
        commitSha: (resolvedInCommit && commitSha) ? commitSha : undefined,
      });

      // Reset form
      setClarificationType('');
      setExplanation('');
      setEvidenceUrl('');
      setResolvedInCommit(false);
      setCommitSha('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit clarification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setClarificationType('');
      setExplanation('');
      setEvidenceUrl('');
      setResolvedInCommit(false);
      setCommitSha('');
      setError(null);
      onClose();
    }
  };

  if (!finding) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal Container - centered on main content area */}
          <div className="fixed inset-y-0 left-72 right-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
            >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Clarify Finding
              </h2>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="px-8 py-6 space-y-6">
              {/* Finding Summary */}
              <div className="bg-slate-50 border-2 border-slate-200 p-6 rounded-2xl">
                <div className="flex items-start gap-4 mb-3">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${getSeverityColor(
                      finding.severity
                    )}`}
                  >
                    {finding.severity}
                  </span>
                  <h3 className="font-black text-slate-900 text-lg flex-1">
                    {finding.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {finding.description}
                </p>
                {finding.location && (
                  <p className="text-xs text-slate-400 font-mono mt-3">
                    📄 {finding.location.file}
                    {finding.location.line && `:${finding.location.line}`}
                  </p>
                )}
              </div>

              {/* Clarification Type */}
              <div>
                <label className="block text-sm font-black text-slate-900 mb-3 uppercase tracking-wider">
                  This finding is:
                </label>
                <select
                  value={clarificationType}
                  onChange={(e) => setClarificationType(e.target.value)}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">Select clarification type...</option>
                  <option value="false_positive">
                    ❌ False Positive - Not actually a vulnerability
                  </option>
                  <option value="mitigated">
                    🛡️ Mitigated - We have safeguards in place
                  </option>
                  <option value="already_fixed">
                    ✅ Already Fixed - Fixed in recent commit
                  </option>
                  <option value="accepted_risk">
                    ⚠️ Accepted Risk - Intentionally designed this way
                  </option>
                </select>
              </div>

              {/* Commit Resolution Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={resolvedInCommit}
                    onChange={(e) => {
                      setResolvedInCommit(e.target.checked);
                      if (!e.target.checked) {
                        setCommitSha('');
                      }
                    }}
                    disabled={submitting}
                    className="w-5 h-5 text-indigo-600 rounded"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <GitBranch size={16} className="text-slate-600" />
                      Resolved in Latest Commit
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      This finding has been fixed in the most recent commit. We'll verify the fix.
                    </div>
                  </div>
                </label>

                {resolvedInCommit && (
                  <div className="ml-8 space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Commit SHA (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., a1b2c3d4e5f6..."
                      value={commitSha}
                      onChange={(e) => setCommitSha(e.target.value)}
                      disabled={submitting}
                      className="w-full h-10 px-3 bg-white border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                    />
                    <p className="text-xs text-slate-500">
                      Leave empty to use the latest commit automatically
                    </p>
                  </div>
                )}
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-sm font-black text-slate-900 mb-3 uppercase tracking-wider">
                  Explanation: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  disabled={submitting}
                  placeholder="Explain why this finding should be reconsidered. Be specific about the context, safeguards, or mitigations in place..."
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[150px] resize-y"
                  required
                />
                <p className="text-xs text-slate-500 mt-2">
                  Provide detailed context to help the audit system understand your perspective.
                </p>
              </div>

              {/* Evidence URL */}
              <div>
                <label className="block text-sm font-black text-slate-900 mb-3 uppercase tracking-wider">
                  Evidence (optional)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    disabled={submitting}
                    placeholder="https://github.com/repo/pull/123 or https://docs.example.com"
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-10"
                  />
                  <ExternalLink className="absolute right-3 top-3.5 w-5 h-5 text-slate-300" />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Link to PR, documentation, or other supporting evidence
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-rose-900">{error}</p>
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900 mb-1">
                    Clarification will be saved
                  </p>
                  <p className="text-xs text-slate-700">
                    Your clarification will be saved and queued. You can submit multiple clarifications,
                    then trigger re-analysis once to process them all together.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-8 py-6 flex gap-3 rounded-b-3xl">
              <button
                onClick={handleSubmit}
                disabled={!clarificationType || !explanation || submitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg disabled:shadow-none"
              >
                {submitting ? 'Submitting...' : 'Submit Clarification'}
              </button>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="px-8 py-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancel
              </button>
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
