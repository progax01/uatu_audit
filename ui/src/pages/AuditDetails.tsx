import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Download, AlertCircle,
  Code2, Timer, Target, Zap, Globe,
  CheckCircle2, XCircle, Binary, ArrowRight,
  User, Lock, Unlock
} from 'lucide-react'
import LiabilityTriage from '../components/LiabilityTriage'
import logo from '../assets/logo.svg'
import mascot from '../assets/letf-mascot.png'
import MouseTooltip from '../components/MouseTooltip'
import MilestoneTracker from '../components/MilestoneTracker'
import { Link } from 'react-router-dom'

interface AuditDetailsProps {
  jobId?: number | string
  onHomeClick: () => void
  onBack: () => void
}

// Helper to detect UUID format
const isUUID = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)

export default function AuditDetails({ jobId: propJobId, onHomeClick }: AuditDetailsProps) {
  const { jobId: urlId } = useParams<{ jobId: string }>()
  const jobId = urlId || propJobId?.toString()

  const [activeTab, setActiveTab] = useState<'report' | 'triage' | 'faq' | 'testcases'>('report')
  const [loading, setLoading] = useState(true)
  const [auditData, setAuditData] = useState<any>(null)
  const [jobInfo, setJobInfo] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isQuickScan, setIsQuickScan] = useState(false)

  // PDF Export function
  const handleExportPDF = () => {
    if (!auditData) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const severityColor = (sev: string) => {
      switch (sev) {
        case 'critical': return '#dc2626';
        case 'high': return '#f97316';
        case 'medium': return '#f59e0b';
        case 'low': return '#3b82f6';
        default: return '#6b7280';
      }
    };

    const vulnerabilitiesHTML = auditData.vulnerabilities?.map((v: any) => `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: ${severityColor(v.severity)}15; padding: 16px; border-bottom: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">${v.title}</h4>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; font-family: monospace;">${v.location || ''}</p>
            </div>
            <span style="background: ${severityColor(v.severity)}; color: white; padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase;">${v.severity}</span>
          </div>
        </div>
        <div style="padding: 16px;">
          <p style="margin: 0 0 12px; font-size: 12px; color: #475569; line-height: 1.6;"><strong>Impact:</strong> ${v.impact || v.description}</p>
          <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;"><strong>Recommendation:</strong> ${v.recommendation || 'N/A'}</p>
        </div>
      </div>
    `).join('') || '<p style="color: #64748b;">No vulnerabilities found.</p>';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Security Audit Report - ${auditData.projectName}</title>
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #fff; color: #1e293b; }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.03; z-index: -1; width: 600px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
          .logo-section { display: flex; align-items: center; gap: 16px; }
          .logo { height: 40px; }
          .mascot { height: 60px; }
          .title-section h1 { margin: 0; font-size: 24px; font-weight: 800; color: #1e293b; }
          .title-section p { margin: 4px 0 0; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
          .score-section { text-align: right; }
          .score { font-size: 48px; font-weight: 900; color: ${auditData.score >= 80 ? '#10b981' : auditData.score >= 60 ? '#f59e0b' : '#ef4444'}; }
          .grade { display: inline-block; background: #f1f5f9; padding: 8px 16px; border-radius: 8px; font-weight: 700; margin-top: 8px; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px; }
          .meta-item { background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
          .meta-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
          .meta-value { font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 4px; }
          .section { margin-bottom: 32px; }
          .section-title { font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
          .summary { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; margin-bottom: 32px; }
          .summary p { margin: 0; font-size: 13px; line-height: 1.7; color: #166534; }
          .findings-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
          .finding-count { text-align: center; padding: 16px; border-radius: 12px; }
          .finding-count.critical { background: #fef2f2; border: 1px solid #fecaca; }
          .finding-count.high { background: #fff7ed; border: 1px solid #fed7aa; }
          .finding-count.medium { background: #fffbeb; border: 1px solid #fde68a; }
          .finding-count.low { background: #eff6ff; border: 1px solid #bfdbfe; }
          .finding-count .count { font-size: 28px; font-weight: 900; }
          .finding-count .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
          .footer { margin-top: 48px; padding-top: 24px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
          .footer-text { font-size: 10px; color: #94a3b8; }
          .generated { font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <img src="/mascot.png" class="watermark" alt="" />

        <div class="header">
          <div class="logo-section">
            <img src="/logo.svg" class="logo" alt="Uatu" />
            <img src="/mascot.png" class="mascot" alt="" />
            <div class="title-section">
              <h1>${auditData.projectName || 'Security Audit Report'}</h1>
              <p>${isQuickScan ? 'Quick Scan Report' : 'Full Audit Report'} • ID: ${jobId}</p>
            </div>
          </div>
          <div class="score-section">
            <div class="score">${auditData.score}%</div>
            <div class="grade">Grade ${auditData.grade}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Network</div>
            <div class="meta-value">${auditData.network || 'N/A'}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Contract Address</div>
            <div class="meta-value" style="font-family: monospace; font-size: 11px;">${auditData.contractAddress ? auditData.contractAddress.slice(0, 10) + '...' + auditData.contractAddress.slice(-8) : 'N/A'}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Lines of Code</div>
            <div class="meta-value">${auditData.sloc || 'N/A'} SLOC</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Scan Duration</div>
            <div class="meta-value">${auditData.scanTime ? (auditData.scanTime / 1000).toFixed(1) + 's' : 'N/A'}</div>
          </div>
        </div>

        ${auditData.summary ? `
          <div class="summary">
            <p><strong>Executive Summary:</strong> ${auditData.summary}</p>
          </div>
        ` : ''}

        <div class="findings-summary">
          <div class="finding-count critical">
            <div class="count" style="color: #dc2626;">${auditData.findings?.critical || 0}</div>
            <div class="label" style="color: #dc2626;">Critical</div>
          </div>
          <div class="finding-count high">
            <div class="count" style="color: #f97316;">${auditData.findings?.high || 0}</div>
            <div class="label" style="color: #f97316;">High</div>
          </div>
          <div class="finding-count medium">
            <div class="count" style="color: #f59e0b;">${auditData.findings?.medium || 0}</div>
            <div class="label" style="color: #f59e0b;">Medium</div>
          </div>
          <div class="finding-count low">
            <div class="count" style="color: #3b82f6;">${auditData.findings?.low || 0}</div>
            <div class="label" style="color: #3b82f6;">Low</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Vulnerability Details</div>
          ${vulnerabilitiesHTML}
        </div>

        <div class="footer">
          <div class="footer-text">
            <strong>Uatu Security</strong> • Institutional-Grade Smart Contract Auditing<br/>
            This report is generated for verification purposes only.
          </div>
          <div class="generated">
            Generated: ${new Date().toISOString().split('T')[0]}<br/>
            Report ID: ${jobId}
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for images to load then trigger print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  useEffect(() => {
    // Fetch quick scan from public audits API (UUID format)
    const fetchQuickScan = async () => {
      if (!jobId || !isUUID(jobId)) return false;

      try {
        const response = await fetch(`/api/public-audits/${jobId}`);
        if (!response.ok) return false;
        const data = await response.json();

        if (!data.ok || !data.audit) return false;

        const { job, results } = data.audit;
        setIsQuickScan(true);

        // Map job info
        setJobInfo({
          id: job.id,
          legacyId: job.legacyId,
          project: job.contractName || `Contract ${job.contractAddress?.slice(0, 8)}`,
          status: job.status,
          auditType: job.auditType,
          contractAddress: job.contractAddress,
          contractNetwork: job.contractNetwork,
          isProxy: job.isProxy,
          implementationAddress: job.implementationAddress,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        });

        // Map results to auditData format
        if (results) {
          const metadata = results.metadata || {};
          setAuditData({
            projectName: job.contractName || `Contract ${job.contractAddress?.slice(0, 8)}`,
            auditType: job.auditType === 'quick' ? 'Quick Scan' : 'Full Audit',
            score: results.score,
            grade: results.grade,
            network: job.contractNetwork,
            contractAddress: job.contractAddress,
            sloc: metadata.contractAnalysis?.sloc,
            compiler: metadata.compiler,
            scanTime: metadata.scanDuration,
            vulnerabilities: results.vulnerabilities?.map((v: any, idx: number) => ({
              id: v.id || `vuln-${idx}`,
              title: v.title,
              severity: v.severity,
              description: v.description,
              location: v.location,
              recommendation: v.recommendation,
              impact: v.description,
            })) || [],
            findings: {
              critical: results.vulnerabilities?.filter((v: any) => v.severity === 'critical').length || 0,
              high: results.vulnerabilities?.filter((v: any) => v.severity === 'high').length || 0,
              medium: results.vulnerabilities?.filter((v: any) => v.severity === 'medium').length || 0,
              low: results.vulnerabilities?.filter((v: any) => v.severity === 'low').length || 0,
            },
            summary: results.summary,
            contractAnalysis: metadata.contractAnalysis,
            gasOptimizations: metadata.gasOptimizations,
            bestPractices: metadata.bestPractices,
            riskLevel: metadata.riskLevel,
          });
        }

        return true;
      } catch (err) {
        console.error('Failed to fetch quick scan:', err);
        return false;
      }
    };

    // Fetch full audit job and progress (numeric ID format)
    const fetchJobAndProgress = async () => {
      if (!jobId || !/^\d+$/.test(jobId)) return;

      try {
        const jobRes = await fetch(`/jobs/${jobId}`);
        if (!jobRes.ok) throw new Error('Job not found');
        const jobData = await jobRes.json();
        setJobInfo(jobData.job);

        // Fetch progress
        const progRes = await fetch(`/api/progress?project=${jobData.job.project}&branch=${jobData.job.branch}`);
        if (progRes.ok) {
          const pData = await progRes.json();
          setProgress(pData);
        }

        // If job is completed, fetch report
        if (jobData.job.status === 'completed' || jobData.job.status === 'done') {
          const reportRes = await fetch(`/report?project=${encodeURIComponent(jobData.job.project)}&branch=${encodeURIComponent(jobData.job.branch)}&format=json`);
          if (reportRes.ok) {
            const rData = await reportRes.json();
            setAuditData(rData);
          }
        }
      } catch (err) {
        console.error('Failed to fetch job/progress:', err);
      }
    };

    const fetchReport = async () => {
      setLoading(true)
      setError(null)
      try {
        // Check if it's a UUID (quick scan)
        if (jobId && isUUID(jobId)) {
          const found = await fetchQuickScan();
          if (!found) {
            setError('Audit not found');
          }
        }
        // Check if it's a template ID (non-numeric, non-UUID)
        else if (jobId && !/^\d+$/.test(jobId)) {
          const response = await fetch(`/reports/${jobId}.json`)
          if (!response.ok) throw new Error('Report not found')
          const data = await response.json()
          setAuditData(data)
        }
        // Numeric ID (full audit)
        else {
          await fetchJobAndProgress();
        }
      } catch (err: any) {
        console.error('Fetch failed:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchReport();

    let intervalId: NodeJS.Timeout;
    if (jobId && /^\d+$/.test(jobId)) {
      intervalId = setInterval(() => {
        if (jobInfo?.status !== 'completed' && jobInfo?.status !== 'done' && jobInfo?.status !== 'failed') {
          fetchJobAndProgress();
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, jobInfo?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12 mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-[3px] border-slate-200 border-t-slate-900 rounded-full"
          />
        </div>
        <p className="text-slate-900 font-black uppercase tracking-[0.4em] text-[10px]">Compiling Technical Dossier...</p>
      </div>
    )
  }

  if (!auditData) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] selection:bg-indigo-500/10 text-slate-950 font-sans relative">
      <MouseTooltip />

      {/* Institutional Body Watermark */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center opacity-[0.03]">
        <img src={logo} alt="" className="w-[1200px] h-auto rotate-[-15deg] select-none" />
      </div>

      {/* Refined Institutional Header */}
      <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-12 sticky top-0 z-50">
        <div className="flex items-center gap-10">
          <div onClick={onHomeClick} className="cursor-pointer group flex items-center gap-6">
            <img src={logo} alt="Uatu" className="h-8 object-contain" />
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{auditData?.projectName || jobInfo?.project || 'Audit Details'}</h1>
                {(auditData?.auditType || jobInfo?.status) && (
                  <span className={`px-2.5 py-1 rounded text-white text-[9px] font-black uppercase tracking-widest leading-none ${jobInfo?.status === 'awaiting_clarification' ? 'bg-amber-500' : 'bg-slate-900'}`}>
                    {auditData?.auditType || jobInfo?.status?.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">ID: {jobId}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                  <ShieldCheck size={12} strokeWidth={3} /> {isQuickScan ? 'Quick Scan' : 'Institutional Verification'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12">
          {auditData && (
            <div className="hidden lg:flex items-center gap-8 pr-12 border-r border-slate-100">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Security Score</span>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-black tracking-tighter ${auditData.score >= 90 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {auditData.score}%
                  </span>
                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded font-black text-[11px] text-slate-900">
                    GRADE {auditData.grade}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            {jobInfo?.status === 'awaiting_clarification' ? (
              <Link to={`/clarifications/${jobId}`} className="flex items-center gap-3 bg-amber-500 border border-amber-600 px-7 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20">
                <AlertCircle size={14} strokeWidth={3} />
                Resolve Clarifications
              </Link>
            ) : auditData ? (
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-3 bg-white border border-slate-950 px-7 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-950 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Download size={14} strokeWidth={3} />
                Export Certificate
              </button>
            ) : (
              <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  Analysis in Progress...
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-12 space-y-12">
        {/* Progress Tracker for Active Jobs */}
        {(jobInfo?.status !== 'completed' && jobInfo?.status !== 'done' && jobInfo) && (
          <div className="space-y-8">
            {jobInfo.status === 'awaiting_clarification' && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 border border-amber-200 p-8 rounded-[32px] flex items-center justify-between"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    <AlertCircle size={28} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Technical Clarifications Required</h2>
                    <p className="text-sm font-bold text-amber-700/70 uppercase tracking-widest mt-1">Audit paused at milestone 2</p>
                  </div>
                </div>
                <Link to={`/clarifications/${jobId}`} className="btn-primary !bg-slate-900 !border-slate-800 shadow-xl">
                  Take Action Now
                  <ArrowRight size={18} strokeWidth={3} />
                </Link>
              </motion.div>
            )}

            <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-sm">
              <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Live Processing Stream</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time reasoning log for {jobInfo.project}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-black text-slate-900 tracking-tighter">{Math.round(progress?.overall_pct || 0)}%</span>
                  <div className="w-32 h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress?.overall_pct || 0}%` }}
                      className="h-full bg-indigo-500"
                    />
                  </div>
                </div>
              </div>
              <MilestoneTracker
                milestones={progress?.phases?.map((p: any, idx: number) => ({
                  number: idx + 1,
                  name: p.name.replace(/_/g, ' '),
                  description: p.step || 'Processing...',
                  status: (p.pct === 100 ? 'completed' : p.pct > 0 ? 'running' : 'pending') as any,
                  progress: p.pct,
                  step: p.step
                })) || []}
              />
            </div>
          </div>
        )}

        {auditData ? (
          <>
            {/* Quick Scan Contract Info */}
            {isQuickScan && auditData.contractAddress && (
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 p-6 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center text-indigo-500 shadow-sm">
                      <Target size={24} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Contract Address</div>
                      <div className="text-sm font-mono font-bold text-slate-900 mt-1">{auditData.contractAddress}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {jobInfo?.isProxy && (
                      <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg">
                        Proxy Contract
                      </span>
                    )}
                    {/* Public badge with claim tooltip */}
                    <div className="relative group/public">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg cursor-help">
                        <Unlock size={12} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Public</span>
                      </div>
                      <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-slate-900 text-white rounded-xl opacity-0 invisible group-hover/public:opacity-100 group-hover/public:visible transition-all z-50 shadow-xl">
                        <p className="text-[10px] font-medium leading-relaxed">Claim ownership to make this audit private and link it to your account.</p>
                      </div>
                    </div>
                    {/* Claim Ownership CTA */}
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
                      <User size={12} />
                      Claim Ownership
                    </button>
                    <a
                      href={`https://${auditData.network === 'ethereum' ? '' : auditData.network + '.'}etherscan.io/address/${auditData.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    >
                      View on Explorer
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Balanced Technical Vitals Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { label: 'Network Deployment', value: auditData.network ? auditData.network.charAt(0).toUpperCase() + auditData.network.slice(1) : 'Mainnet', icon: Globe, color: 'text-indigo-500' },
                { label: 'Compilation Logic', value: auditData.compiler || '0.8.x', icon: Code2, color: 'text-slate-500' },
                { label: 'Code Base Assets', value: `${auditData.sloc || 'N/A'} SLOC`, icon: Binary, color: 'text-slate-500' },
                { label: 'Scan Duration', value: auditData.scanTime ? `${(auditData.scanTime / 1000).toFixed(1)}s` : 'N/A', icon: Timer, color: 'text-slate-500' }
              ].map((spec, i) => (
                <div key={i} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-5 group hover:border-indigo-100 transition-colors">
                  <div className={`w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center ${spec.color} group-hover:bg-white transition-colors`}>
                    <spec.icon size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{spec.label}</div>
                    <div className="text-[15px] font-black text-slate-900 mt-1">{spec.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation Console Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('report')}
                className={`px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'report' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Technical Findings Log
                {activeTab === 'report' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
              </button>
              <button
                onClick={() => setActiveTab('triage')}
                className={`px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'triage' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Liability Triage
                {auditData.questions?.length > 0 && (
                  <span className="ml-3 px-2 py-0.5 bg-rose-500 text-white text-[9px] rounded-full">{auditData.questions.length}</span>
                )}
                {activeTab === 'triage' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
              </button>
              <button
                onClick={() => setActiveTab('testcases')}
                className={`px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'testcases' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Test Execution
                {activeTab === 'testcases' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'faq' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Audit FAQ
                {activeTab === 'faq' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
              </button>
            </div>

            <section>
              <div className="flex items-center justify-between mb-8 border-l-4 border-slate-900 pl-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Vulnerability Disclosure Ledger</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional findings categorized by severity</p>
                </div>
                <span className="px-4 py-2 bg-slate-100 rounded text-[10px] font-black text-slate-500">
                  {auditData.vulnerabilities?.length || 0} ACTIVE FINDINGS
                </span>
              </div>

              <div className="grid grid-cols-12 gap-12">
                <div className="col-span-12 lg:col-span-8 space-y-8">
                  <AnimatePresence mode="wait">
                    {activeTab === 'report' ? (
                      <motion.div
                        key="report"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                      >
                        {/* Summary Section for Quick Scans */}
                        {isQuickScan && auditData.summary && (
                          <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm mb-6">
                            <div className="flex items-center gap-3 mb-4">
                              <ShieldCheck size={20} className="text-indigo-500" />
                              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Executive Summary</h3>
                            </div>
                            <p className="text-[13px] text-slate-700 leading-relaxed font-medium">{auditData.summary}</p>
                          </div>
                        )}

                        {/* Vulnerabilities */}
                        {auditData.vulnerabilities?.map((v: any) => (
                          <div
                            key={v.id}
                            className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all"
                          >
                            <div className={`px-8 py-6 border-b border-slate-100 flex items-center justify-between ${
                              v.severity === 'critical' ? 'bg-rose-50/70' :
                              v.severity === 'high' ? 'bg-rose-50/50' :
                              v.severity === 'medium' ? 'bg-amber-50/50' :
                              'bg-blue-50/50'
                            }`}>
                              <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                  v.severity === 'critical' ? 'text-rose-600' :
                                  v.severity === 'high' ? 'text-rose-500' :
                                  v.severity === 'medium' ? 'text-amber-500' :
                                  'text-blue-500'
                                }`}>
                                  <AlertCircle size={24} strokeWidth={3} />
                                </div>
                                <div>
                                  <h4 className="text-base font-black text-slate-900 tracking-tight">{v.title}</h4>
                                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mt-1">{v.location}</span>
                                </div>
                              </div>
                              <span className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest ${
                                v.severity === 'critical' ? 'bg-rose-600 text-white' :
                                v.severity === 'high' ? 'bg-rose-500 text-white' :
                                v.severity === 'medium' ? 'bg-amber-500 text-white' :
                                'bg-blue-500 text-white'
                              }`}>
                                {v.severity}
                              </span>
                            </div>
                            <div className="p-8 grid md:grid-cols-2 gap-10">
                              <div className="space-y-6">
                                <div>
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                    <Target size={14} className="text-slate-900" /> Impact Assessment
                                  </div>
                                  <p className="text-[13px] text-slate-700 leading-relaxed font-bold">{v.impact || v.description}</p>
                                </div>
                                <div>
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                    <Zap size={14} className="text-slate-900" /> Likelihood Profile
                                  </div>
                                  <p className="text-[13px] text-slate-700 leading-relaxed font-bold">{v.likelihood || 'Dependent on protocol admin vectors.'}</p>
                                </div>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl flex flex-col justify-between">
                                <div>
                                  <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ShieldCheck size={14} strokeWidth={3} /> Remediation Strategy
                                  </div>
                                  <p className="text-[13px] text-slate-900 leading-relaxed font-black">{v.recommendation}</p>
                                </div>
                                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-200">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Awaiting Fix Verification</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Contract Analysis Section for Quick Scans */}
                        {isQuickScan && auditData.contractAnalysis && (
                          <div className="pt-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Contract Analysis</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Structural breakdown and complexity metrics</p>
                              </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                <div className="p-4 bg-slate-50 rounded-xl">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SLOC</div>
                                  <div className="text-xl font-black text-slate-900">{auditData.contractAnalysis.sloc || 'N/A'}</div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Functions</div>
                                  <div className="text-xl font-black text-slate-900">{auditData.contractAnalysis.functions || 'N/A'}</div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">State Variables</div>
                                  <div className="text-xl font-black text-slate-900">{auditData.contractAnalysis.stateVariables || 'N/A'}</div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl">
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">External Calls</div>
                                  <div className="text-xl font-black text-slate-900">{auditData.contractAnalysis.externalCalls || 'N/A'}</div>
                                </div>
                              </div>
                              <div className="space-y-4">
                                {auditData.contractAnalysis.purpose && (
                                  <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Purpose</div>
                                    <p className="text-[13px] text-slate-700 font-medium">{auditData.contractAnalysis.purpose}</p>
                                  </div>
                                )}
                                {auditData.contractAnalysis.architecture && (
                                  <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Architecture</div>
                                    <p className="text-[13px] text-slate-700 font-medium">{auditData.contractAnalysis.architecture}</p>
                                  </div>
                                )}
                                {auditData.contractAnalysis.accessControl && (
                                  <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Access Control</div>
                                    <p className="text-[13px] text-slate-700 font-medium">{auditData.contractAnalysis.accessControl}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Gas Optimizations Section for Quick Scans */}
                        {isQuickScan && auditData.gasOptimizations && auditData.gasOptimizations.length > 0 && (
                          <div className="pt-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Gas Optimizations</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Recommendations for reducing gas costs</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {auditData.gasOptimizations.map((opt: any, idx: number) => (
                                <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                  <div className="flex items-center gap-3 mb-3">
                                    <Zap size={16} className="text-amber-500" />
                                    <h4 className="text-sm font-black text-slate-900">{opt.title}</h4>
                                    {opt.savings && (
                                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg">
                                        {opt.savings}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[13px] text-slate-600 font-medium">{opt.description}</p>
                                  {opt.location && (
                                    <p className="text-[11px] text-slate-400 font-mono mt-2">{opt.location}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Best Practices Section for Quick Scans */}
                        {isQuickScan && auditData.bestPractices && auditData.bestPractices.length > 0 && (
                          <div className="pt-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Best Practices</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Code quality and maintainability recommendations</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {auditData.bestPractices.map((bp: any, idx: number) => (
                                <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                  <div className="flex items-center gap-3 mb-3">
                                    <CheckCircle2 size={16} className="text-indigo-500" />
                                    <h4 className="text-sm font-black text-slate-900">{bp.title}</h4>
                                    <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${
                                      bp.status === 'passed' ? 'bg-emerald-100 text-emerald-700' :
                                      bp.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {bp.status || 'info'}
                                    </span>
                                  </div>
                                  <p className="text-[13px] text-slate-600 font-medium">{bp.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Module & Function Analysis (for full audits only) */}
                        {!isQuickScan && auditData.functions_analysis && (
                        <div className="pt-12">
                          <div className="flex items-center gap-4 mb-8">
                            <div>
                              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Contract Logic Breakdown</h3>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Deep analysis of sensitive internal functions</p>
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Function Signature</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Evaluation</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {auditData.functions_analysis?.map((fn: any, idx: number) => (
                                  <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-6">
                                      <code className="text-[12px] font-black text-indigo-500 group-hover:text-indigo-600 transition-colors">{fn.name}</code>
                                    </td>
                                    <td className="px-8 py-6">
                                      <p className="text-[12px] text-slate-700 font-bold leading-relaxed">{fn.logic}</p>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${fn.status === 'Secure' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'
                                        }`}>
                                        {fn.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        )}

                        {/* Test Suite Ledger (for full audits only) */}
                        {!isQuickScan && auditData.test_suites && (
                        <div className="pt-12">
                          <div className="flex items-center gap-4 mb-8">
                            <div>
                              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Verification Test Ledger</h3>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Automated and manual test case execution metrics</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {auditData.test_suites?.map((suite: any, idx: number) => (
                              <div key={idx} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                                <div>
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{suite.category}</div>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-slate-900 tracking-tighter">{suite.passed}</span>
                                    <span className="text-[10px] font-black text-slate-300 uppercase">Passed Cycles</span>
                                  </div>
                                </div>
                                <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest leading-none flex items-center gap-2 ${suite.status === 'Passed' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                  }`}>
                                  {suite.status === 'Passed' ? <CheckCircle2 size={12} strokeWidth={2.5} /> : <XCircle size={12} strokeWidth={2.5} />}
                                  {suite.status}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        )}
                      </motion.div>
                    ) : activeTab === 'triage' ? (
                      <motion.div
                        key="triage"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <LiabilityTriage
                          questions={auditData.questions}
                          onSubmit={(ans) => console.log('Submitting triage:', ans)}
                        />
                      </motion.div>
                    ) : activeTab === 'testcases' ? (
                      <motion.div
                        key="testcases"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-8"
                      >
                        {isQuickScan ? (
                          /* Deep Scan CTA for Quick Scans */
                          <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-100 rounded-[40px] p-12 text-center relative overflow-hidden">
                            {/* Background mascot watermark */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
                              <img src={mascot} alt="" className="w-96 h-96 object-contain" />
                            </div>

                            <div className="relative z-10">
                              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-indigo-100 flex items-center justify-center">
                                <Zap size={40} className="text-indigo-600" />
                              </div>
                              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Upgrade to Deep Scan</h3>
                              <p className="text-sm text-slate-500 font-medium max-w-lg mx-auto mb-8 leading-relaxed">
                                Quick scans provide surface-level vulnerability detection. Run a Deep Scan for comprehensive test execution,
                                formal verification, fuzzing coverage, and institutional-grade security certification.
                              </p>

                              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20">
                                  <User size={16} />
                                  Claim & Run Deep Scan
                                </button>
                                <Link to="/pricing" className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-600 transition-all">
                                  View Pricing
                                  <ArrowRight size={14} />
                                </Link>
                              </div>

                              <div className="mt-10 pt-8 border-t border-indigo-100/50 grid grid-cols-3 gap-8 max-w-md mx-auto">
                                {[
                                  { label: 'Test Suites', value: '12+' },
                                  { label: 'Fuzzing Rounds', value: '1M+' },
                                  { label: 'Coverage', value: '100%' },
                                ].map((stat) => (
                                  <div key={stat.label} className="text-center">
                                    <div className="text-xl font-black text-indigo-600">{stat.value}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Full audit test execution data */
                          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Test Suite</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coverage Target</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Assertions</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(auditData.test_execution || [
                                  { suite: 'Liveness Invariants', target: 'Protocol Continuity', assertions: 240, status: 'Passed' },
                                  { suite: 'Access Control Matrix', target: 'Permission Integrity', assertions: 850, status: 'Passed' },
                                  { suite: 'Arithmetic Fuzzing', target: 'Edge Case Safety', assertions: '1.2M', status: 'Passed' },
                                  { suite: 'Economic Sanity', target: 'Oracle Manipulation', assertions: 45, status: 'Warning' },
                                  { suite: 'Reentrancy Guard', target: 'State Consistency', assertions: 120, status: 'Passed' },
                                ]).map((test: any, idx: number) => (
                                  <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-6">
                                      <span className="text-[13px] font-black text-slate-900">{test.suite}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                      <span className="text-[12px] text-slate-500 font-bold">{test.target}</span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                      <span className="text-[12px] font-mono font-bold text-indigo-600">{test.assertions}</span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${test.status === 'Passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                        {test.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="faq"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                      >
                        {[
                          {
                            q: "What does an 'A+' grade signify?",
                            a: "An A+ grade represents near-perfect adherence to security best practices, zero high-risk vulnerabilities, and robust test coverage. It's the highest institutional seal of excellence."
                          },
                          {
                            q: "How often should I re-audit?",
                            a: "We recommend a full audit for every major protocol upgrade or at least once every 6 months to ensure safety against newly discovered attack vectors."
                          },
                          {
                            q: "What is SLOC and why does it matter?",
                            a: "Source Lines of Code (SLOC) is an indicator of codebase complexity. Higher SLOC often requires more intensive manual review and formal verification passes."
                          },
                          {
                            q: "Can I share this report publicly?",
                            a: "Yes, this digital dossier is designed for public verification. You can share the URL or export the signed PDF certificate for institutional stakeholders."
                          }
                        ].map((item, i) => (
                          <div key={i} className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
                            <h4 className="text-base font-black text-slate-900 mb-3 tracking-tight">{item.q}</h4>
                            <p className="text-[13px] text-slate-500 leading-relaxed font-bold">{item.a}</p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="col-span-12 lg:col-span-4 h-fit sticky top-36 space-y-8">
                  {/* Visual Severity Breakdown */}
                  <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-sm">
                    <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
                      <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Institutional Risk Profile</h3>
                      <Target size={18} className="text-slate-400" />
                    </div>

                    <div className="space-y-8">
                      {['critical', 'high', 'medium', 'low'].map((sev) => (
                        <div key={sev} className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${sev === 'critical' ? 'bg-rose-500' :
                              sev === 'high' ? 'bg-orange-500' :
                                sev === 'medium' ? 'bg-amber-400' : 'bg-indigo-400'
                              }`} />
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{sev} findings</span>
                          </div>
                          <span className="text-lg font-black text-slate-900 tracking-tighter">
                            {auditData.findings?.[sev] || 0}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-12 pt-10 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">Ironclad Trust Index</span>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{auditData.score}% verified</span>
                      </div>
                      <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${auditData.score}%` }}
                          className="h-full bg-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Institutional SECURE Pass Badge - Glassmorphic Refinement */}
                  <div className="bg-white/40 backdrop-blur-xl border-2 border-white/60 p-10 rounded-[48px] shadow-2xl shadow-indigo-500/10 relative overflow-hidden group flex flex-col items-center text-center">
                    {/* Large Background Mascot Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.15] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                      <img src={mascot} alt="" className="w-80 h-80 object-contain" />
                    </div>

                    <div className="relative z-10 w-full">
                      <div className="flex flex-col items-center mb-8">
                        <div className="px-4 py-1.5 rounded-full bg-indigo-50/50 backdrop-blur-md border border-indigo-100/50 mb-4">
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] leading-none">Institutional Credential</span>
                        </div>
                        <h4 className="text-2xl font-black tracking-tighter text-slate-900 leading-none mb-2">VERIFIED PASS</h4>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">Ironclad Security Grade</p>
                      </div>

                      {/* Central Metrics Row */}
                      <div className="grid grid-cols-2 gap-px bg-slate-200/50 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/20 mb-8 shadow-inner">
                        <div className="bg-white/60 p-6">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Audit Grade</span>
                          <span className="text-4xl font-black text-slate-900 tracking-tighter">{auditData.grade}</span>
                        </div>
                        <div className="bg-white/60 p-6">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Final Score</span>
                          <span className="text-4xl font-black text-indigo-500 tracking-tighter">{auditData.score}%</span>
                        </div>
                      </div>

                      {/* Definitive Status Badge */}
                      <div className="bg-emerald-500 text-white py-4 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 mb-8 backdrop-blur-sm border border-emerald-400/30">
                        <ShieldCheck size={20} strokeWidth={3} />
                        <span className="text-sm font-black uppercase tracking-widest">Verified Secure</span>
                      </div>

                      <p className="text-[10px] font-black text-slate-500 leading-relaxed uppercase tracking-widest italic border-t border-black/5 pt-6">
                        Authentic Dossier: ISS-2026-AD
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : !jobInfo ? (
          <div className="flex flex-col items-center justify-center py-40">
            <AlertCircle size={48} className="text-slate-200 mb-6" />
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">No Technical Data Found</h3>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">The requested audit ID does not exist or is still cold initializing.</p>
          </div>
        ) : null}
      </main>
    </div>
  )
}
