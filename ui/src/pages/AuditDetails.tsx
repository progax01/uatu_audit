import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Download, AlertCircle, AlertTriangle,
  Code2, Timer, Target, Zap, Globe,
  CheckCircle2, XCircle, Binary, ArrowRight, ArrowLeft,
  User, Lock, Unlock, ChevronDown, RefreshCw, Package
} from 'lucide-react'
import { useAccount } from 'wagmi'
import LiabilityTriage from '../components/LiabilityTriage'
import logo from '../assets/logo.svg'
import mascot from '../assets/letf-mascot.png'
import MouseTooltip from '../components/MouseTooltip'
import MilestoneTracker from '../components/MilestoneTracker'
import { Link } from 'react-router-dom'
import AuthModal from '../components/AuthModal'
import { authFetch } from '../services/authService'
import { TestExecutionReport } from '../components/TestExecutionReport'
import { GroupedDependencyFindings } from '../components/DependencyFindingCard'
import { organizeFindings } from '../services/findingSorter'
import SEO from '../components/SEO'

interface AuditDetailsProps {
  jobId?: number | string
  onHomeClick: () => void
  onBack: () => void
}

// Helper to detect UUID format
const isUUID = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)

// Network explorer URLs
const EXPLORER_URLS: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  arbitrum: 'https://arbiscan.io',
  polygon: 'https://polygonscan.com',
  base: 'https://basescan.org',
  bnb: 'https://bscscan.com',
  optimism: 'https://optimistic.etherscan.io',
}

// Helper to get explorer URL for a contract
const getExplorerUrl = (address: string, network?: string): string => {
  const baseUrl = EXPLORER_URLS[network?.toLowerCase() || ''] || EXPLORER_URLS.ethereum
  return `${baseUrl}/address/${address}`
}

export default function AuditDetails({ jobId: propJobId, onHomeClick }: AuditDetailsProps) {
  const { jobId: urlId } = useParams<{ jobId: string }>()
  const jobId = urlId || propJobId?.toString()
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'report' | 'dependencies' | 'tests' | 'triage' | 'faq' | 'testcases'>('report')
  const [loading, setLoading] = useState(true)
  const [auditData, setAuditData] = useState<any>(null)
  const [jobInfo, setJobInfo] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isQuickScan, setIsQuickScan] = useState(false)
  const [expandedVulns, setExpandedVulns] = useState<Set<string>>(new Set())
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [isClaimed, setIsClaimed] = useState(false)
  const [addressMismatchError, setAddressMismatchError] = useState<string | null>(null)
  const [clarifications, setClarifications] = useState<any[]>([])
  const [clarificationsLoading, setClarificationsLoading] = useState(false)
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<any[]>([])
  const [triageAnswers, setTriageAnswers] = useState<any[]>([])
  const [faqLoading, setFaqLoading] = useState(false)

  const toggleVuln = (id: string) => {
    setExpandedVulns(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Handle Claim Ownership button click
  const handleClaimOwnership = () => {
    // Reset any previous error
    setAddressMismatchError(null)

    // If wallet is not connected, show modal to connect
    if (!isConnected || !address) {
      setShowClaimModal(true)
      return
    }

    // If wallet is connected, check if address matches deployer
    const deployerAddress = jobInfo?.deployerAddress
    if (!deployerAddress) {
      setShowClaimModal(true)
      return
    }

    // Check if addresses match (case-insensitive)
    const addressesMatch = address.toLowerCase() === deployerAddress.toLowerCase()

    if (addressesMatch) {
      // Address matches, proceed with claim
      setShowClaimModal(true)
    } else {
      // Address doesn't match, show error
      setAddressMismatchError(
        `Connected wallet (${address.slice(0, 6)}...${address.slice(-4)}) is not the deployer. ` +
        `Please connect the deployer wallet: ${deployerAddress.slice(0, 6)}...${deployerAddress.slice(-4)}`
      )
    }
  }

  // Clear error when wallet changes
  useEffect(() => {
    if (addressMismatchError && address) {
      setAddressMismatchError(null)
    }
  }, [address])

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

    const formatLocation = (loc: any) => {
      if (!loc) return '';
      if (typeof loc === 'string') return loc;
      if (typeof loc === 'object') {
        const parts = [];
        if (loc.file) parts.push(loc.file);
        if (loc.line) parts.push(`L${loc.line}`);
        if (loc.column) parts.push(`C${loc.column}`);
        return parts.join(':');
      }
      return '';
    };

    const vulnerabilitiesHTML = auditData.vulnerabilities?.map((v: any) => `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: ${severityColor(v.severity)}15; padding: 16px; border-bottom: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">${v.title}</h4>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; font-family: monospace;">${formatLocation(v.location)}</p>
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

    // Technical Quick Stats Table HTML
    const technicalChecksHTML = auditData.technicalChecks?.length > 0 ? `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Technical Quick Stats</h3>
          <span style="background: #ecfdf5; color: #059669; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700;">
            ${auditData.technicalChecks.filter((c: any) => c.result === 'Passed').length}/${auditData.technicalChecks.length} Passed
          </span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 12px 16px; text-align: left; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Category</th>
              <th style="padding: 12px 16px; text-align: left; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Check</th>
              <th style="padding: 12px 16px; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Result</th>
            </tr>
          </thead>
          <tbody>
            ${auditData.technicalChecks.map((check: any) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 16px; font-size: 11px; font-weight: 600; color: #64748b;">${check.category}</td>
                <td style="padding: 10px 16px; font-size: 11px; color: #475569;">${check.check}${check.details ? `<br/><span style="font-size: 9px; color: #94a3b8;">${check.details}</span>` : ''}</td>
                <td style="padding: 10px 16px; text-align: center;">
                  <span style="padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; background: ${check.result === 'Passed' ? '#ecfdf5' : check.result === 'Warning' ? '#fffbeb' : check.result === 'Failed' ? '#fef2f2' : '#f8fafc'}; color: ${check.result === 'Passed' ? '#059669' : check.result === 'Warning' ? '#d97706' : check.result === 'Failed' ? '#dc2626' : '#64748b'};">${check.result}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    // Business Risk Analysis Grid HTML
    const businessRiskHTML = auditData.businessRiskChecks?.length > 0 ? `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Business Risk Analysis</h3>
          <span style="background: #ecfdf5; color: #059669; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700;">
            ${auditData.businessRiskChecks.filter((c: any) => c.severity === 'safe').length}/${auditData.businessRiskChecks.length} Safe
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e2e8f0;">
          ${auditData.businessRiskChecks.map((check: any) => `
            <div style="background: white; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${check.severity === 'safe' ? '#10b981' : check.severity === 'warning' ? '#f59e0b' : '#ef4444'};"></div>
                <span style="font-size: 11px; color: #475569;">${check.category}</span>
              </div>
              <span style="font-size: 11px; font-weight: 700; color: ${check.severity === 'safe' ? '#1e293b' : check.severity === 'warning' ? '#d97706' : '#dc2626'};">${check.result}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    // Function Overview Table HTML
    const functionOverviewHTML = auditData.functionOverview?.length > 0 ? `
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden; page-break-inside: avoid;">
        <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Function Overview</h3>
          <span style="font-size: 10px; font-weight: 600; color: #64748b;">${auditData.functionOverview.length} Functions Analyzed</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 12px 16px; text-align: left; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Function</th>
              <th style="padding: 12px 16px; text-align: left; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Visibility</th>
              <th style="padding: 12px 16px; text-align: left; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Observation</th>
              <th style="padding: 12px 16px; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${auditData.functionOverview.map((fn: any) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #6366f1; font-family: monospace;">${fn.name}</td>
                <td style="padding: 10px 16px;">
                  <span style="padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; background: ${fn.visibility === 'external' ? '#ede9fe' : fn.visibility === 'public' ? '#dbeafe' : '#f1f5f9'}; color: ${fn.visibility === 'external' ? '#7c3aed' : fn.visibility === 'public' ? '#2563eb' : '#64748b'};">${fn.visibility}</span>
                </td>
                <td style="padding: 10px 16px; font-size: 10px; color: #475569;">${fn.observation}</td>
                <td style="padding: 10px 16px; text-align: center;">
                  <span style="padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 700; white-space: nowrap; background: ${fn.conclusion === 'No Issue' ? '#ecfdf5' : fn.conclusion === 'Warning' ? '#fffbeb' : '#fef2f2'}; color: ${fn.conclusion === 'No Issue' ? '#059669' : fn.conclusion === 'Warning' ? '#d97706' : '#dc2626'};">${fn.conclusion}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const scoreLabel = auditData.score >= 90 ? 'EXCELLENT' : auditData.score >= 70 ? 'GOOD' : auditData.score >= 50 ? 'NEEDS WORK' : 'AT RISK';
    const scoreColor = auditData.score >= 90 ? '#10b981' : auditData.score >= 70 ? '#6366f1' : auditData.score >= 50 ? '#f59e0b' : '#ef4444';
    const badgeColor = auditData.score >= 70 ? '#10b981' : '#f59e0b';

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
          .logo-section { display: flex; align-items: center; gap: 32px; }
          .logo { height: 36px; }
          .separator { width: 2px; height: 48px; background: #e2e8f0; }
          .title-section h1 { margin: 0; font-size: 24px; font-weight: 800; color: #1e293b; }
          .title-section p { margin: 6px 0 0; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
          .score-section { text-align: right; }
          .score { font-size: 48px; font-weight: 900; color: ${scoreColor}; line-height: 1; }
          .grade { display: inline-block; background: #f1f5f9; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 8px; border: 1px solid #e2e8f0; }
          .status-badge { display: inline-block; background: ${badgeColor}; color: white; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; margin-left: 8px; }
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
            <div class="separator"></div>
            <div class="title-section">
              <h1>${auditData.projectName || 'Security Audit Report'}</h1>
              <p>${isQuickScan ? 'Quick Scan Report' : 'Full Audit Report'} • ID: ${jobId}</p>
            </div>
          </div>
          <div class="score-section">
            <div class="score">${auditData.score}%</div>
            <div>
              <span class="grade">Grade ${auditData.grade}</span>
              <span class="status-badge">${scoreLabel}</span>
            </div>
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

        ${technicalChecksHTML}
        ${businessRiskHTML}
        ${functionOverviewHTML}

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

  // Fetch post-audit clarification questions
  const fetchClarifications = async (auditJobId: string) => {
    setClarificationsLoading(true);
    try {
      const response = await authFetch(`/api/audit/${auditJobId}/clarifications`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched clarifications:', data.clarifications);
        setClarifications(data.clarifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch clarifications:', err);
    } finally {
      setClarificationsLoading(false);
    }
  };

  // Fetch pre-audit questionnaire answers
  const fetchQuestionnaireAnswers = async () => {
    if (!jobId) return;
    setFaqLoading(true);
    try {
      const response = await authFetch(`/api/audit/${jobId}/questionnaire`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched questionnaire answers:', data.answers);
        setQuestionnaireAnswers(data.answers || []);
      }
    } catch (err) {
      console.error('Failed to fetch questionnaire answers:', err);
    } finally {
      setFaqLoading(false);
    }
  };

  // Fetch triage answers
  const fetchTriageAnswers = async () => {
    if (!jobId) return;
    try {
      const response = await authFetch(`/api/audit/${jobId}/clarifications`);
      if (response.ok) {
        const data = await response.json();
        const answeredTriage = data.clarifications?.filter((c: any) => c.phase === 'post_audit' && c.status === 'answered') || [];
        console.log('Fetched triage answers:', answeredTriage);
        setTriageAnswers(answeredTriage);
      }
    } catch (err) {
      console.error('Failed to fetch triage answers:', err);
    }
  };

  // Fetch FAQ data when FAQ tab is active
  useEffect(() => {
    if (activeTab === 'faq' && jobId) {
      fetchQuestionnaireAnswers();
      fetchTriageAnswers();
    }
  }, [activeTab, jobId]);

  // Handle triage submission
  const handleTriageSubmit = async (answers: any) => {
    if (!jobId) return;

    try {
      const response = await authFetch(`/api/audit/${jobId}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit triage answers');
      }

      const data = await response.json();
      console.log('Triage submission successful:', data);

      // Reload clarifications to update status
      await fetchClarifications(jobId);

      // Reload audit data to get re-scored findings
      window.location.reload();

      alert('✅ Triage answers saved! Report has been re-scored based on your disclosures.');
    } catch (err) {
      console.error('Triage submission failed:', err);
      alert('❌ Failed to save triage answers. Please try again.');
    }
  };

  useEffect(() => {
    // Fetch from new unified audit API (UUID format)
    const fetchUnifiedAudit = async () => {
      if (!jobId || !isUUID(jobId)) return false;

      try {
        // Fetch from unified audit endpoint (includes job + results)
        const response = await authFetch(`/api/audit/${jobId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.audit) {
            console.log('Unified audit data:', data);

            // Determine project name - prioritize project data from backend
            let projectName = 'Unknown Project';
            let projectDescription = '';
            let projectLogoUrl = '';
            let projectGithubUrl = '';
            let projectWebsiteUrl = '';

            // First check if we have project data from backend
            if (data.project) {
              projectName = data.project.name;
              projectDescription = data.project.description || '';
              projectLogoUrl = data.project.logoUrl || '';
              projectGithubUrl = data.project.githubUrl || '';
              projectWebsiteUrl = data.project.websiteUrl || '';
            }
            // Fallback to extracting from audit data
            else if (data.audit.contractName) {
              projectName = data.audit.contractName;
            } else if (data.audit.contractAddress) {
              projectName = `Contract ${data.audit.contractAddress.slice(0, 8)}`;
            } else if (data.audit.repo) {
              // Extract repo name from GitHub URL
              const repoMatch = data.audit.repo.match(/github\.com\/([^\/]+\/[^\/\.]+)/);
              projectName = repoMatch ? repoMatch[1] : data.audit.repo;
              projectGithubUrl = data.audit.repo;
            }

            // Set job info
            setJobInfo({
              id: data.audit.id,
              legacyId: data.audit.legacyId,
              project: projectName,
              status: data.audit.status,
              auditType: data.audit.auditType,
              contractAddress: data.audit.contractAddress,
              contractNetwork: data.audit.contractNetwork,
              isProxy: data.audit.isProxy,
              implementationAddress: data.audit.implementationAddress,
              deployerAddress: data.audit.deployerAddress,
              createdAt: data.audit.createdAt,
              completedAt: data.audit.completedAt,
              detectedFramework: data.audit.detectedFramework,
            });

            // Set quick scan flag based on audit type
            if (data.audit.auditType === 'quick') {
              setIsQuickScan(true);
            }

            // Fetch post-audit clarifications if audit is completed
            if (data.audit.status === 'completed') {
              fetchClarifications(jobId);
            }

            // If audit has results, map them to component state
            if (data.results) {
              const metadata = data.results.metadata || {};
              setAuditData({
                projectName,
                projectDescription,
                projectLogoUrl,
                projectGithubUrl,
                projectWebsiteUrl,
                auditType: data.audit.auditType === 'quick' ? 'Quick Scan' : 'Full Audit',
                score: data.results.score,
                grade: data.results.grade,
                network: data.audit.contractNetwork,
                contractAddress: data.audit.contractAddress,
                sloc: data.results.contractAnalysis?.sloc || metadata.contractAnalysis?.sloc || metadata.sloc,
                fileCount: data.results.contractAnalysis?.fileCount || metadata.contractAnalysis?.fileCount || metadata.fileCount,
                compiler: metadata.compiler || data.results.contractAnalysis?.compiler,
                scanTime: data.results.scanDuration || metadata.scanDuration,
                vulnerabilities: (data.results.vulnerabilities || []).map((v: any, idx: number) => ({
                  id: v.id || `vuln-${idx}`,
                  title: v.title,
                  severity: v.severity,
                  description: v.description,
                  location: v.location,
                  recommendation: v.recommendation,
                  impact: v.impact || v.description,
                })),
                findings: {
                  critical: (data.results.vulnerabilities || []).filter((v: any) => v.severity === 'critical').length,
                  high: (data.results.vulnerabilities || []).filter((v: any) => v.severity === 'high').length,
                  medium: (data.results.vulnerabilities || []).filter((v: any) => v.severity === 'medium').length,
                  low: (data.results.vulnerabilities || []).filter((v: any) => v.severity === 'low').length,
                },
                summary: data.results.summary,
                contractAnalysis: data.results.contractAnalysis || metadata.contractAnalysis,
                gasOptimizations: data.results.gasOptimizations || metadata.gasOptimizations,
                bestPractices: data.results.bestPractices || metadata.bestPractices,
                riskLevel: data.results.riskLevel || metadata.riskLevel,
                // Comprehensive report fields
                technicalChecks: data.results.technicalChecks || [],
                businessRiskChecks: data.results.businessRiskChecks || [],
                functionOverview: data.results.functionOverview || [],
              });
            } else {
              // No results yet, show progress
              setProgress({
                status: data.audit.status,
                pct: data.audit.progressPct,
                currentStep: data.audit.currentStepName,
              });
            }

            return true;
          }
        }
        return false;
      } catch (err) {
        console.error('Failed to fetch unified audit:', err);
        return false;
      }
    };

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
            // New comprehensive report fields
            technicalChecks: results.technicalChecks || [],
            businessRiskChecks: results.businessRiskChecks || [],
            functionOverview: results.functionOverview || [],
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
        // Check both status and completedAt to handle race condition where completedAt is set but status wasn't updated
        const isJobComplete = jobData.job.status === 'completed' || jobData.job.status === 'done' || jobData.job.completedAt;
        if (isJobComplete) {
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
        // Check if it's a UUID (try unified audit endpoint)
        if (jobId && isUUID(jobId)) {
          // Try unified audit endpoint (includes both in-progress and completed audits)
          const foundUnified = await fetchUnifiedAudit();
          if (!foundUnified) {
            // Fallback to old quick scan endpoint for backwards compatibility
            const foundQuickScan = await fetchQuickScan();
            if (!foundQuickScan) {
              setError('Audit not found');
            }
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

    let intervalId: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;

    // Legacy numeric job ID - use polling
    if (jobId && /^\d+$/.test(jobId)) {
      intervalId = setInterval(() => {
        // Check both status and completedAt to determine if job is done
        const isComplete = jobInfo?.status === 'completed' || jobInfo?.status === 'done' || jobInfo?.status === 'failed' || jobInfo?.completedAt;
        if (!isComplete) {
          fetchJobAndProgress();
        }
      }, 5000);
    }
    // UUID job ID - use SSE streaming for real-time progress (only if not completed)
    else if (jobId && isUUID(jobId)) {
      // Skip SSE if audit is already completed
      const isComplete = jobInfo?.status === 'completed' || jobInfo?.status === 'failed' || jobInfo?.completedAt;

      if (!isComplete) {
        const sseUrl = `/api/audit/${jobId}/progress/stream`;
        console.log('Connecting to SSE:', sseUrl);

        eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE progress update:', data);

          // Update progress state
          if (data.status === 'running') {
            setProgress({
              status: data.status,
              pct: data.overallPct || 0,
              currentStep: data.currentStep?.name || data.currentStepName,
              stepsCompleted: data.stepsCompleted,
              stepsTotal: data.stepsTotal,
            });

            // Also update job info if audit completes
            if (data.status === 'completed' || data.status === 'failed') {
              setJobInfo(prev => ({
                ...prev,
                status: data.status,
                completedAt: new Date().toISOString()
              }));

              // Fetch final results
              fetchUnifiedAudit();

              // Close SSE
              if (eventSource) {
                eventSource.close();
              }
            }
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        eventSource?.close();

        // Fallback to polling if SSE fails
        intervalId = setInterval(async () => {
          const response = await authFetch(`/api/audit/${jobId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.audit) {
              setProgress({
                status: data.audit.status,
                pct: data.audit.progressPct || 0,
                currentStep: data.audit.currentStepName,
                stepsCompleted: data.audit.stepsCompleted,
                stepsTotal: data.audit.stepsTotal,
              });

              if (data.audit.status === 'completed' || data.audit.status === 'failed') {
                fetchUnifiedAudit();
                if (intervalId) clearInterval(intervalId);
              }
            }
          }
        }, 2000);
      };
      }  // Close if (!isComplete)
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (eventSource) eventSource.close();
    };
  }, [jobId]);

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

  // Show failed audit with error details
  if (auditData?.status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50/30 relative overflow-hidden">
        {/* Large mascot watermark */}
        <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.04]">
          <img src={mascot} alt="" className="w-[600px] h-auto" />
        </div>

        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 relative z-10">
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer flex items-center gap-3 group">
            <img src={logo} alt="Uatu" className="h-6" />
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
        </header>

        {/* Content */}
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6 relative z-10">
          <div className="text-center max-w-2xl">
            {/* Error Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle size={40} className="text-rose-600" />
              </div>
            </div>

            {/* Message */}
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
              Audit Failed
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              The audit encountered an error and could not complete.
            </p>

            {/* Error Details Box */}
            <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-6 mb-8 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-rose-900 mb-2">Error Details</h3>
                  <pre className="text-xs text-rose-800 font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {auditData.errorMessage || 'No error details available'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center mb-8">
              <button
                onClick={() => navigate('/dashboard')}
                className="group px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-[13px] hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                Back to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="group px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-[13px] hover:bg-rose-700 transition-all flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Retry Audit
              </button>
            </div>

            {/* ID Reference */}
            <p className="text-[11px] text-slate-300 font-mono">
              Job ID: {auditData.jobId || jobId}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show running/progress page for audits in progress
  if (!auditData && jobInfo && (jobInfo.status === 'running' || jobInfo.status === 'pending' || jobInfo.status === 'queued')) {
    return (
      <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 flex-shrink-0">
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer flex items-center gap-3 group">
            <img src={logo} alt="Uatu" className="h-6" />
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
        </header>

        {/* Two Column Layout */}
        <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
          {/* Left Column - Progress Info */}
          <div className="flex flex-col justify-center items-center px-12 bg-white border-r border-slate-200">
            <div className="w-full max-w-md">
              {/* Status Icon */}
              <div className="mb-8 flex justify-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl">
                  <Timer size={48} className="text-white animate-pulse" />
                </div>
              </div>

              {/* Message */}
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4 text-center">
                Audit In Progress
              </h1>
              <p className="text-slate-500 text-base leading-relaxed mb-10 text-center">
                Your audit is currently running. This page will automatically update when complete.
              </p>

              {/* Progress Info */}
              {progress && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-black text-slate-700 uppercase tracking-wider">Status</span>
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        {progress.status}
                      </span>
                    </div>
                  </div>

                  {progress.currentStep && (
                    <div>
                      <div className="text-sm font-black text-slate-700 uppercase tracking-wider mb-3">Current Step</div>
                      <div className="text-base text-slate-900 font-medium bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                        {progress.currentStep}
                      </div>
                    </div>
                  )}

                  {typeof progress.pct === 'number' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-black text-slate-700 uppercase tracking-wider">Progress</span>
                        <span className="text-2xl font-black text-indigo-600">{progress.pct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full"
                          style={{ width: `${progress.pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Project Info */}
              {jobInfo && (
                <div className="mt-10 pt-6 border-t border-slate-200 text-sm text-slate-500">
                  <div className="font-mono mb-2"><span className="font-bold text-slate-700">Project:</span> {jobInfo.project}</div>
                  {jobInfo.detectedFramework && (
                    <div className="font-mono"><span className="font-bold text-slate-700">Framework:</span> {jobInfo.detectedFramework}</div>
                  )}
                </div>
              )}

            {/* ID Reference */}
            <p className="text-[10px] text-slate-400 font-mono text-center mt-10">
              Job ID: {jobId}
            </p>
          </div>
        </div>

        {/* Right Column - Terminal Output */}
        <div className="flex flex-col justify-center items-center px-12 bg-slate-900">
          {progress && progress.currentStep && (
            <div className="w-full max-w-3xl">
              <div className="bg-slate-800 rounded-2xl p-8 font-mono text-sm shadow-2xl border border-slate-700">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-slate-400 ml-2">uatu-audit — {jobId?.toString().slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-emerald-400 text-[10px] font-bold">LIVE</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-slate-500">
                    <span className="text-indigo-400">$</span> uatu audit start --depth {jobInfo?.depth || 'standard'} --project "{jobInfo?.project || 'project'}"
                  </div>
                  <div className="text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    Framework detected: {jobInfo?.detectedFramework || 'analyzing...'}
                  </div>
                  <div className="text-slate-400">
                    → Loading audit pipeline...
                  </div>
                  <div className="text-yellow-400 flex items-center gap-2 font-bold">
                    <Zap size={14} className="animate-pulse" />
                    Running: {progress.currentStep}
                  </div>
                  <div className="flex items-center gap-2 text-indigo-400 mt-4">
                    <div className="flex gap-1">
                      <div className="w-1 h-4 bg-indigo-500 animate-pulse rounded"></div>
                      <div className="w-1 h-4 bg-indigo-500 animate-pulse rounded" style={{ animationDelay: '100ms' }}></div>
                      <div className="w-1 h-4 bg-indigo-500 animate-pulse rounded" style={{ animationDelay: '200ms' }}></div>
                    </div>
                    <span>Processing... {progress.pct}%</span>
                  </div>
                  <div className="text-slate-700 my-3">
                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  </div>
                  <div className="text-slate-500 italic text-xs">
                    Page auto-updates when complete. No refresh needed.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  }

  // Show branded 404 page when audit not found
  if (error || !auditData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 relative overflow-hidden">
        {/* Large mascot watermark */}
        <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.04]">
          <img src={mascot} alt="" className="w-[600px] h-auto" />
        </div>

        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 relative z-10">
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer flex items-center gap-3 group">
            <img src={logo} alt="Uatu" className="h-6" />
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowRight size={14} className="rotate-180" />
            Back to Dashboard
          </button>
        </header>

        {/* Content */}
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6 relative z-10">
          <div className="text-center max-w-md">
            {/* Error code */}
            <div className="mb-6">
              <span className="text-[100px] font-black text-slate-100 leading-none select-none">404</span>
            </div>

            {/* Message */}
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              Audit Not Found
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              This report doesn't exist or the link may be incorrect.
            </p>

            {/* Actions */}
            <div className="flex gap-3 justify-center mb-8">
              <button
                onClick={() => navigate('/dashboard')}
                className="group px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-[13px] hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                Dashboard
                <ArrowRight size={14} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <Link
                to="/quick-scan"
                className="group px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-[13px] hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <Zap size={14} />
                New Scan
              </Link>
            </div>

            {/* ID Reference */}
            <p className="text-[11px] text-slate-300 font-mono">
              {jobId}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Generate dynamic SEO metadata
  const projectName = auditData?.projectName || jobInfo?.project || 'Smart Contract'
  const auditScore = auditData?.score || 0
  const grade = auditData?.grade || 'N/A'
  const severityCounts = auditData?.severity || {}
  const totalIssues = Object.values(severityCounts).reduce((sum: number, count: any) => sum + (count || 0), 0) as number

  const seoTitle = `${projectName} Security Audit Report | Uatu Protocol Intelligence`
  const seoDescription = `Comprehensive smart contract security audit for ${projectName} by Uatu. Security Score: ${auditScore}/100 (${grade}). ${totalIssues} findings analyzed including ${severityCounts.critical || 0} critical and ${severityCounts.high || 0} high severity issues. View detailed blockchain audit results.`
  const seoKeywords = `${projectName} audit, ${projectName} security, smart contract audit, blockchain security, Uatu audit, ${projectName} vulnerabilities, DeFi security, contract analysis, security score ${auditScore}, ${auditData?.network || 'ethereum'} audit`
  const ogImageUrl = `${window.location.origin}/og-images/${jobId}.png`

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        url={`https://uatu.xyz/audit/${jobId}`}
        image={ogImageUrl}
      />
      <div className="min-h-screen bg-[#F8FAFC] selection:bg-indigo-500/10 text-slate-950 font-sans relative">
        <MouseTooltip />

      {/* Institutional Body Watermark */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center opacity-[0.03]">
        <img src={logo} alt="" className="w-[1200px] h-auto rotate-[-15deg] select-none" />
      </div>

      {/* Refined Institutional Header */}
      <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-12 sticky top-0 z-50">
        <div className="flex items-center gap-10">
          <div onClick={() => navigate('/dashboard')} className="cursor-pointer group flex items-center gap-6">
            <img src={logo} alt="Uatu" className="h-8 object-contain" />
            <div className="h-8 w-px bg-slate-200" />
            {auditData?.projectLogoUrl && (
              <>
                <img src={auditData.projectLogoUrl} alt={auditData.projectName} className="h-10 w-10 object-contain rounded-lg" />
                <div className="h-8 w-px bg-slate-200" />
              </>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{auditData?.projectName || jobInfo?.project || 'Audit Details'}</h1>
                {(auditData?.auditType || jobInfo?.status) && (
                  <span className={`px-2.5 py-1 rounded text-white text-[9px] font-black uppercase tracking-widest leading-none ${jobInfo?.status === 'awaiting_clarification' ? 'bg-amber-500' : 'bg-slate-900'}`}>
                    {auditData?.auditType || jobInfo?.status?.replace(/_/g, ' ')}
                  </span>
                )}
                {auditData?.projectGithubUrl && (
                  <a
                    href={auditData.projectGithubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                    title="Verified on GitHub"
                  >
                    <CheckCircle2 size={10} />
                    VERIFIED
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2.5 mt-1.5">
                {auditData?.projectDescription && (
                  <>
                    <span className="text-xs text-slate-600">{auditData.projectDescription}</span>
                    <span className="text-slate-300">•</span>
                  </>
                )}
                <span className="text-[10px] font-mono text-slate-400 tracking-tight leading-none">ID: {jobId?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12">
          {auditData && (
            <div className="hidden lg:flex items-center gap-4 pr-12 border-r border-slate-100">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Security Score</span>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-black tracking-tighter ${
                    auditData.score >= 90 ? 'text-emerald-500' :
                    auditData.score >= 70 ? 'text-indigo-600' :
                    auditData.score >= 50 ? 'text-amber-500' : 'text-rose-500'
                  }`}>
                    {auditData.score}%
                  </span>
                  <div className={`px-3 py-1.5 rounded font-black text-[11px] ${
                    auditData.score >= 90 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
                    auditData.score >= 70 ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' :
                    auditData.score >= 50 ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                    'bg-rose-50 border border-rose-200 text-rose-700'
                  }`}>
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
        {/* Progress Tracker for Active Jobs - hide if completed (by status OR completedAt) */}
        {(jobInfo && !jobInfo.completedAt && jobInfo.status !== 'completed' && jobInfo.status !== 'done') && (
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
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    {progress?.phases ? 'Live Processing Stream' : 'Audit Progress'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {progress?.phases
                      ? `Real-time reasoning log for ${jobInfo.project}`
                      : progress?.stepsCompleted !== undefined
                        ? `Step ${progress.stepsCompleted} of ${progress.stepsTotal}: ${progress.currentStep || 'Processing...'}`
                        : `Analyzing ${jobInfo.project}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-black text-slate-900 tracking-tighter">
                    {Math.round(progress?.pct || progress?.overall_pct || 0)}%
                  </span>
                  <div className="w-32 h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress?.pct || progress?.overall_pct || 0}%` }}
                      className="h-full bg-indigo-500"
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>
              {progress?.phases ? (
                <MilestoneTracker
                  milestones={progress.phases.map((p: any, idx: number) => ({
                    number: idx + 1,
                    name: p.name.replace(/_/g, ' '),
                    description: p.step || 'Processing...',
                    status: (p.pct === 100 ? 'completed' : p.pct > 0 ? 'running' : 'pending') as any,
                    progress: p.pct,
                    step: p.step
                  }))}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">
                      {progress?.currentStep || 'Initializing audit...'}
                    </span>
                    <span className="font-bold text-indigo-600">
                      {progress?.stepsCompleted || 0} / {progress?.stepsTotal || '?'} steps
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress?.pct || 0}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 italic">
                    {progress?.status === 'running' ? 'Audit in progress... This may take several minutes.' : 'Preparing audit...'}
                  </p>
                </div>
              )}
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
                  <div className="flex items-center gap-3 relative">
                    {jobInfo?.isProxy && (
                      <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg">
                        Proxy Contract
                      </span>
                    )}
                    {/* Public/Claimed badge */}
                    {isClaimed ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <Lock size={12} className="text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Claimed</span>
                      </div>
                    ) : (
                      <div className="relative group/public">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg cursor-help">
                          <Unlock size={12} className="text-emerald-600" />
                          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Public</span>
                        </div>
                        <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-slate-900 text-white rounded-xl opacity-0 invisible group-hover/public:opacity-100 group-hover/public:visible transition-all z-50 shadow-xl">
                          <p className="text-[10px] font-medium leading-relaxed">Claim ownership to make this audit private and link it to your account.</p>
                        </div>
                      </div>
                    )}
                    {/* Claim Ownership CTA - only show if not claimed */}
                    {!isClaimed && jobInfo?.deployerAddress && (
                      <>
                        <button
                          onClick={handleClaimOwnership}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                          <User size={12} />
                          Claim Ownership
                        </button>
                        {/* Address Mismatch Error */}
                        {addressMismatchError && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-full right-0 mt-2 w-80 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-lg z-50"
                          >
                            <div className="flex items-start gap-3">
                              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                                  Not the Deployer
                                </p>
                                <p className="text-[10px] text-red-700 dark:text-red-300 leading-relaxed">
                                  {addressMismatchError}
                                </p>
                                <button
                                  onClick={() => setAddressMismatchError(null)}
                                  className="mt-2 text-[10px] font-black text-red-600 dark:text-red-400 hover:text-red-700 uppercase tracking-wider"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                    <a
                      href={getExplorerUrl(auditData.contractAddress, auditData.network)}
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
                { label: 'Network Deployment', value: jobInfo?.contractAddress ? (auditData.network ? auditData.network.charAt(0).toUpperCase() + auditData.network.slice(1) : 'Mainnet') : 'GitHub Repository', icon: Globe, color: 'text-indigo-500' },
                { label: 'Compilation Logic', value: auditData.compiler || 'Solidity', icon: Code2, color: 'text-slate-500' },
                { label: 'Code Base Assets', value: (() => {
                  if (auditData.sloc && auditData.fileCount) return `${auditData.sloc.toLocaleString()} SLOC • ${auditData.fileCount} files`;
                  if (auditData.sloc) return `${auditData.sloc.toLocaleString()} SLOC`;
                  if (auditData.fileCount) return `${auditData.fileCount} files`;
                  return jobInfo?.status === 'completed' ? 'N/A' : 'Analyzing...';
                })(), icon: Binary, color: 'text-slate-500' },
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
                Project Findings
                {activeTab === 'report' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
              </button>
              <button
                onClick={() => setActiveTab('dependencies')}
                className={`px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'dependencies' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Dependencies
                {auditData?.dependencyFindings && auditData.dependencyFindings.length > 0 && (
                  <span className="ml-3 px-2 py-0.5 bg-amber-500 text-white text-[9px] rounded-full">{auditData.dependencyFindings.length}</span>
                )}
                {activeTab === 'dependencies' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                className={`px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'tests' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Test Execution
                {activeTab === 'tests' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
              </button>
              {/* Hide LIABILITY TRIAGE tab for Quick Scans */}
              {!isQuickScan && (
                <button
                  onClick={() => setActiveTab('triage')}
                  className={`px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'triage' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Liability Triage
                  {clarifications?.length > 0 && (
                    <span className="ml-3 px-2 py-0.5 bg-rose-500 text-white text-[9px] rounded-full">{clarifications.length}</span>
                  )}
                  {activeTab === 'triage' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
                </button>
              )}
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

                        {/* Technical Quick Stats Table */}
                        {auditData.technicalChecks && auditData.technicalChecks.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-6">
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CheckCircle2 size={20} className="text-emerald-500" />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Technical Quick Stats</h3>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-lg">
                                {auditData.technicalChecks.filter((c: any) => c.result === 'Passed').length}/{auditData.technicalChecks.length} Passed
                              </span>
                            </div>
                            <table className="w-full text-left">
                              <thead className="bg-slate-50/50">
                                <tr>
                                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Check</th>
                                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Result</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {auditData.technicalChecks.map((check: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-3">
                                      <span className="text-[11px] font-bold text-slate-500">{check.category}</span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className="text-[12px] font-medium text-slate-700">{check.check}</span>
                                      {check.details && <p className="text-[10px] text-slate-400 mt-0.5">{check.details}</p>}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                        check.result === 'Passed' ? 'bg-emerald-50 text-emerald-600' :
                                        check.result === 'Warning' ? 'bg-amber-50 text-amber-600' :
                                        check.result === 'Failed' ? 'bg-rose-50 text-rose-600' :
                                        'bg-slate-50 text-slate-400'
                                      }`}>
                                        {check.result}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Business Risk Analysis Table */}
                        {auditData.businessRiskChecks && auditData.businessRiskChecks.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-6">
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Lock size={20} className="text-indigo-500" />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Business Risk Analysis</h3>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-lg">
                                {auditData.businessRiskChecks.filter((c: any) => c.severity === 'safe').length}/{auditData.businessRiskChecks.length} Safe
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-slate-100">
                              {auditData.businessRiskChecks.map((check: any, idx: number) => (
                                <div key={idx} className="bg-white p-4 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${
                                      check.severity === 'safe' ? 'bg-emerald-500' :
                                      check.severity === 'warning' ? 'bg-amber-500' :
                                      'bg-rose-500'
                                    }`} />
                                    <span className="text-[11px] font-medium text-slate-600">{check.category}</span>
                                  </div>
                                  <span className={`text-[11px] font-bold ${
                                    check.severity === 'safe' ? 'text-slate-700' :
                                    check.severity === 'warning' ? 'text-amber-600' :
                                    'text-rose-600'
                                  }`}>{check.result}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Function Overview Table (AS-IS) */}
                        {isQuickScan && auditData.functionOverview && auditData.functionOverview.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-6">
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Code2 size={20} className="text-violet-500" />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Function Overview</h3>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {auditData.functionOverview.length} Functions
                              </span>
                            </div>
                            <table className="w-full text-left">
                              <thead className="bg-slate-50/50">
                                <tr>
                                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Function</th>
                                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Observation</th>
                                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {auditData.functionOverview.map((fn: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-3">
                                      <code className="text-[12px] font-bold text-indigo-600">{fn.name}</code>
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        fn.visibility === 'external' ? 'bg-violet-50 text-violet-600' :
                                        fn.visibility === 'public' ? 'bg-blue-50 text-blue-600' :
                                        fn.visibility === 'internal' ? 'bg-slate-100 text-slate-500' :
                                        'bg-slate-50 text-slate-400'
                                      }`}>{fn.visibility}</span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className="text-[11px] text-slate-600">{fn.observation}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${
                                        fn.conclusion === 'No Issue' ? 'bg-emerald-50 text-emerald-600' :
                                        fn.conclusion === 'Warning' ? 'bg-amber-50 text-amber-600' :
                                        'bg-rose-50 text-rose-600'
                                      }`}>
                                        {fn.conclusion}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Vulnerabilities - Accordion Style */}
                        {auditData.vulnerabilities?.map((v: any) => {
                          const isExpanded = expandedVulns.has(v.id)
                          const wasDisclosureAdjusted = v.description?.includes('[Note: Severity reduced because')
                          return (
                            <div
                              key={v.id}
                              className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all"
                            >
                              {/* Disclosure Marker */}
                              {wasDisclosureAdjusted && (
                                <div className="px-8 py-4 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
                                  <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-xs font-black text-emerald-900">Severity Adjusted for Transparency</p>
                                    <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                      Severity reduced because this control was disclosed in the pre-audit questionnaire
                                    </p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveTab('faq');
                                    }}
                                    className="text-[9px] font-black text-emerald-600 underline uppercase hover:text-emerald-700 transition-colors"
                                  >
                                    View FAQ
                                  </button>
                                </div>
                              )}

                              {/* Accordion Header - Always visible */}
                              <button
                                onClick={() => toggleVuln(v.id)}
                                className={`w-full px-8 py-6 flex items-center justify-between cursor-pointer transition-colors ${
                                  v.severity === 'critical' ? 'bg-rose-50/70 hover:bg-rose-50' :
                                  v.severity === 'high' ? 'bg-rose-50/50 hover:bg-rose-50/70' :
                                  v.severity === 'medium' ? 'bg-amber-50/50 hover:bg-amber-50/70' :
                                  'bg-blue-50/50 hover:bg-blue-50/70'
                                }`}
                              >
                                <div className="flex items-center gap-5">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    v.severity === 'critical' ? 'text-rose-600' :
                                    v.severity === 'high' ? 'text-rose-500' :
                                    v.severity === 'medium' ? 'text-amber-500' :
                                    'text-blue-500'
                                  }`}>
                                    <AlertCircle size={24} strokeWidth={3} />
                                  </div>
                                  <div className="text-left">
                                    <h4 className="text-base font-black text-slate-900 tracking-tight">{v.title}</h4>
                                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mt-1">
                                      {typeof v.location === 'object' && v.location ?
                                        `${v.location.file || ''}${v.location.line ? `:L${v.location.line}` : ''}${v.location.column ? `:C${v.location.column}` : ''}` :
                                        v.location || ''}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest ${
                                    v.severity === 'critical' ? 'bg-rose-600 text-white' :
                                    v.severity === 'high' ? 'bg-rose-500 text-white' :
                                    v.severity === 'medium' ? 'bg-amber-500 text-white' :
                                    'bg-blue-500 text-white'
                                  }`}>
                                    {v.severity}
                                  </span>
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ChevronDown size={20} className="text-slate-400" />
                                  </motion.div>
                                </div>
                              </button>

                              {/* Accordion Content - Expandable */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="overflow-hidden border-t border-slate-100"
                                  >
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
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}

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
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <Zap size={16} className="text-amber-500" />
                                      <span className="text-[11px] font-mono font-bold text-slate-500">
                                        {typeof opt.location === 'object' && opt.location ?
                                          `${opt.location.file || ''}${opt.location.line ? `:L${opt.location.line}` : ''}` :
                                          opt.location || ''}
                                      </span>
                                    </div>
                                    {opt.estimatedSavings && (
                                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg">
                                        {opt.estimatedSavings}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[13px] text-slate-900 font-bold mb-2">{opt.issue}</p>
                                  <p className="text-[12px] text-slate-500 font-medium">{opt.suggestion}</p>
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
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Code quality and security patterns</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {auditData.bestPractices.map((bp: any, idx: number) => (
                                <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <CheckCircle2 size={16} className={bp.status === 'pass' ? 'text-emerald-500' : bp.status === 'warning' ? 'text-amber-500' : 'text-indigo-500'} />
                                      <h4 className="text-sm font-black text-slate-900">{bp.category}</h4>
                                    </div>
                                    <span className={`px-2 py-1 text-[10px] font-bold rounded-lg uppercase ${
                                      bp.status === 'pass' ? 'bg-emerald-100 text-emerald-700' :
                                      bp.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {bp.status || 'info'}
                                    </span>
                                  </div>
                                  <p className="text-[13px] text-slate-600 font-medium">{bp.details}</p>
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
                          questions={clarifications.filter(c => c.status === 'pending').map(c => ({
                            id: c.id,
                            component_id: c.context?.findingId || 'unknown',
                            component_label: c.context?.category || 'Security',
                            question: c.questionText,
                            suggested_scope: 'INTERNAL'
                          }))}
                          onSubmit={handleTriageSubmit}
                        />
                      </motion.div>
                    ) : activeTab === 'dependencies' ? (
                      <motion.div
                        key="dependencies"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                      >
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 mb-6 rounded-r-xl">
                          <h3 className="font-bold text-amber-900 text-lg mb-2">Third-Party Dependencies</h3>
                          <p className="text-sm text-amber-800">
                            Issues found in external libraries and frameworks (node_modules, OpenZeppelin, Solady, etc.). These require updating dependencies or finding alternatives.
                          </p>
                        </div>

                        {auditData?.dependencyFindings && auditData.dependencyFindings.length > 0 ? (
                          <GroupedDependencyFindings findings={auditData.dependencyFindings} />
                        ) : (
                          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-12 text-center">
                            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={48} />
                            <h3 className="font-bold text-green-900 text-xl mb-2">No Dependency Issues Found</h3>
                            <p className="text-green-700">
                              All third-party libraries passed security checks. Your dependencies are clean.
                            </p>
                          </div>
                        )}

                        {auditData?.filterStats && (
                          <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                            <p className="font-bold mb-2">Filtering Statistics:</p>
                            <p>Total findings analyzed: {auditData.filterStats.total}</p>
                            <p>Project findings: {auditData.filterStats.project}</p>
                            <p>Dependency findings: {auditData.filterStats.dependencies}</p>
                            <p>Filtered (noise): {auditData.filterStats.filtered}</p>
                          </div>
                        )}
                      </motion.div>
                    ) : activeTab === 'tests' ? (
                      <motion.div
                        key="tests"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                      >
                        <TestExecutionReport report={auditData?.testReport} />

                        {auditData?.testReport?.executed && auditData.testReport.stats && (
                          <div className="mt-8">
                            <h3 className="font-bold text-gray-900 text-lg mb-4">Test Results Breakdown</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                                <h4 className="text-sm font-bold text-gray-700 mb-3">Pass Rate</h4>
                                <div className="text-4xl font-black text-green-600">
                                  {((auditData.testReport.stats.passed / auditData.testReport.stats.total) * 100).toFixed(0)}%
                                </div>
                                <p className="text-xs text-gray-600 mt-2">
                                  {auditData.testReport.stats.passed} of {auditData.testReport.stats.total} tests passed
                                </p>
                              </div>

                              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                                <h4 className="text-sm font-bold text-gray-700 mb-3">Framework</h4>
                                <div className="text-2xl font-black text-blue-600 uppercase">
                                  {auditData.testReport.framework || 'Unknown'}
                                </div>
                                <p className="text-xs text-gray-600 mt-2">
                                  Test runner used for execution
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
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
                        ) : auditData.test_execution && auditData.test_execution.length > 0 ? (
                          /* Full audit test execution data - only show if real data exists */
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
                                {auditData.test_execution.map((test: any, idx: number) => (
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
                        ) : (
                          /* No test execution data available */
                          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
                            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                              <Package size={28} className="text-slate-300" />
                            </div>
                            <h3 className="font-black text-slate-900 mb-2">No Test Execution Data</h3>
                            <p className="text-sm text-slate-400">
                              Test results will appear here when available from the audit process.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="faq"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-8"
                      >
                        {faqLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw className="animate-spin text-indigo-600" size={32} />
                          </div>
                        ) : (
                          <>
                            {/* Pre-Audit Questionnaire Section */}
                            <div className="space-y-4">
                              <div className="border-l-4 border-indigo-600 pl-4 mb-5">
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                  Pre-Audit Questionnaire
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold">
                                  Information provided before audit
                                </p>
                              </div>

                              {questionnaireAnswers.length > 0 ? (
                                questionnaireAnswers.map((qa: any, i: number) => (
                                  <div key={i} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:border-slate-300 transition-colors">
                                    <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">{qa.question}</h4>
                                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                      {typeof qa.answer === 'object' ? JSON.stringify(qa.answer, null, 2) : qa.answer}
                                    </p>
                                    {qa.status === 'answered' && qa.answeredAt && (
                                      <p className="text-[10px] text-slate-400 mt-2">
                                        Answered: {new Date(qa.answeredAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center">
                                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                    <Package size={20} className="text-slate-300" />
                                  </div>
                                  <p className="text-sm text-slate-500 font-medium">No questionnaire answers available</p>
                                  <p className="text-xs text-slate-400 mt-1">Pre-audit questions will appear here when answered</p>
                                </div>
                              )}
                            </div>

                            {/* Liability Triage Answers Section */}
                            {triageAnswers.length > 0 && (
                              <div className="space-y-4">
                                <div className="border-l-4 border-amber-600 pl-4 mb-5">
                                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                    Liability Triage Responses
                                  </h3>
                                  <p className="text-[10px] text-slate-400 mt-1 font-bold">
                                    Clarifications provided after audit
                                  </p>
                                </div>

                                {triageAnswers.map((ta: any, i: number) => (
                                  <div key={i} className="bg-white border border-amber-200 p-6 rounded-2xl shadow-sm hover:border-amber-300 transition-colors">
                                    <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">
                                      {ta.questionText}
                                    </h4>
                                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                      {typeof ta.answerValue === 'object' && ta.answerValue?.answer
                                        ? ta.answerValue.answer
                                        : typeof ta.answerValue === 'string'
                                        ? ta.answerValue
                                        : JSON.stringify(ta.answerValue, null, 2)}
                                    </p>
                                    {ta.answerValue?.url && (
                                      <a
                                        href={ta.answerValue.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-indigo-600 hover:underline mt-2 inline-block font-bold"
                                      >
                                        View Evidence →
                                      </a>
                                    )}
                                    {ta.answeredAt && (
                                      <p className="text-[10px] text-slate-400 mt-2">
                                        Answered: {new Date(ta.answeredAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Default FAQ Sections */}
                            <div className="space-y-4 mt-8">
                              <div className="border-l-4 border-slate-600 pl-4 mb-5">
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                  Grading & Scoring
                                </h3>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">How is the security score calculated?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  The security score is calculated using a weighted severity system. Critical findings have the highest impact, followed by high, medium, low, and informational findings. The score ranges from 0-100, where 100 represents perfect security with no findings.
                                </p>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">What do the letter grades mean?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  A+ (95-100): Exceptional security with minimal to no issues. A (85-94): Strong security posture. B (70-84): Good security with minor issues. C (50-69): Moderate security concerns. D (30-49): Significant security issues. F (0-29): Critical security problems requiring immediate attention.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4 mt-8">
                              <div className="border-l-4 border-slate-600 pl-4 mb-5">
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                  Audit Process
                                </h3>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">What tools are used in the audit?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  Uatu uses a combination of industry-standard security tools including Slither for static analysis, Mythril for symbolic execution, Semgrep for pattern matching, and custom AI-powered analysis. Each tool specializes in detecting different types of vulnerabilities.
                                </p>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">How long does an audit take?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  Quick scans typically complete in 2-5 minutes. Deep audits can take 15-30 minutes depending on codebase size and complexity. Real-time progress updates are provided throughout the audit process.
                                </p>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">Can I re-run audits?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  Yes, you can run audits as many times as needed. It's recommended to run a new audit after making significant code changes or fixing identified vulnerabilities to verify the improvements.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4 mt-8">
                              <div className="border-l-4 border-slate-600 pl-4 mb-5">
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                  Technical Details
                                </h3>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">What types of vulnerabilities are detected?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  The audit detects a wide range of vulnerabilities including reentrancy attacks, access control issues, integer overflow/underflow, unchecked external calls, gas optimization issues, and code quality concerns. Each finding includes severity rating, location, and remediation guidance.
                                </p>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">Are false positives possible?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  Yes, automated tools may occasionally flag false positives. Each finding should be reviewed in context. The severity rating and detailed description help you assess whether a finding represents a real security risk in your specific implementation.
                                </p>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">What frameworks are supported?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  Uatu supports Hardhat, Foundry, Truffle, and other popular Solidity development frameworks. The audit automatically detects your project's framework and applies appropriate analysis techniques.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4 mt-8">
                              <div className="border-l-4 border-slate-600 pl-4 mb-5">
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                  Sharing & Reports
                                </h3>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">Can I share audit reports?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  Yes, you can generate shareable audit reports. Reports can be made public or kept private. Public reports are accessible via a unique URL and can be embedded as badges on your project website or documentation.
                                </p>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">What export formats are available?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  Audit reports can be exported as JSON for integration with other tools, or viewed in the browser with a clean, professional layout. Additional export formats may be added based on user needs.
                                </p>
                              </div>

                              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-sm font-black text-slate-900 mb-2 tracking-tight">How do I display my audit badge?</h4>
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                                  After publishing your audit, you'll receive an embeddable badge with your security score. The badge can be placed on your project's README, website, or documentation to showcase your security commitment to users and investors.
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="col-span-12 lg:col-span-4 h-fit sticky top-36 space-y-6">
                  {/* Visual Severity Breakdown - Compact Design */}
                  <div className="bg-white border border-slate-200 p-5 rounded-[24px] shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">Findings</h3>
                      <span className="text-[9px] font-bold text-slate-400">{auditData.vulnerabilities?.length || 0} total</span>
                    </div>

                    {/* Compact severity grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { sev: 'critical', label: 'Crit', color: 'bg-rose-500', bgColor: 'bg-rose-50', textColor: 'text-rose-600' },
                        { sev: 'high', label: 'High', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
                        { sev: 'medium', label: 'Med', color: 'bg-amber-400', bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
                        { sev: 'low', label: 'Low', color: 'bg-blue-400', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
                      ].map((item) => {
                        const count = auditData.findings?.[item.sev] || 0
                        return (
                          <div key={item.sev} className={`${item.bgColor} rounded-xl p-2.5 text-center ${count > 0 ? 'ring-1 ring-inset ring-black/5' : ''}`}>
                            <span className={`text-lg font-black block ${count > 0 ? item.textColor : 'text-slate-300'}`}>{count}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">{item.label}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Info findings inline */}
                    {(auditData.findings?.info || 0) > 0 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Info</span>
                        <span className="text-sm font-black text-slate-500">{auditData.findings?.info || 0}</span>
                      </div>
                    )}
                  </div>

                  {/* Security Badge - Dynamic based on scan type */}
                  <div className={`backdrop-blur-xl border-2 p-8 rounded-[32px] shadow-xl relative overflow-hidden group flex flex-col items-center text-center ${
                    isQuickScan
                      ? 'bg-gradient-to-br from-indigo-50/80 to-violet-50/80 border-indigo-100'
                      : 'bg-white/40 border-white/60 shadow-indigo-500/10'
                  }`}>
                    {/* Background Mascot Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
                      <img src={mascot} alt="" className="w-64 h-64 object-contain" />
                    </div>

                    <div className="relative z-10 w-full">
                      {/* Badge Type */}
                      <div className="flex flex-col items-center mb-6">
                        <div className={`px-4 py-1.5 rounded-full mb-4 ${
                          isQuickScan
                            ? 'bg-indigo-500 text-white'
                            : 'bg-indigo-50/50 border border-indigo-100/50'
                        }`}>
                          <span className={`text-[10px] font-black uppercase tracking-[0.15em] leading-none ${
                            isQuickScan ? '' : 'text-indigo-500'
                          }`}>{isQuickScan ? 'Quick Scan Report' : 'Full Audit Certificate'}</span>
                        </div>
                        <h4 className="text-xl font-black tracking-tight text-slate-900 leading-none mb-1">
                          {auditData.score >= 90 ? 'EXCELLENT' :
                           auditData.score >= 70 ? 'GOOD' :
                           auditData.score >= 50 ? 'NEEDS WORK' : 'AT RISK'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Assessment</p>
                      </div>

                      {/* Metrics Row */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Grade</span>
                          <span className="text-3xl font-black text-slate-900 tracking-tighter">{auditData.grade}</span>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Score</span>
                          <span className={`text-3xl font-black tracking-tighter ${
                            auditData.score >= 90 ? 'text-emerald-500' :
                            auditData.score >= 70 ? 'text-indigo-600' :
                            auditData.score >= 50 ? 'text-amber-500' : 'text-rose-500'
                          }`}>{auditData.score}%</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className={`py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg ${
                        auditData.score >= 70
                          ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                          : 'bg-amber-500 text-white shadow-amber-500/30'
                      }`}>
                        <ShieldCheck size={16} strokeWidth={3} />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          {auditData.score >= 70 ? 'Verified Secure' : 'Review Recommended'}
                        </span>
                      </div>

                      {/* Report ID */}
                      <p className="text-[9px] font-mono text-slate-400 mt-6 pt-4 border-t border-black/5">
                        Report ID: {jobId?.slice(0, 8).toUpperCase()}
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

      {/* Claim Ownership Modal */}
      <AuthModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        onGitHubLogin={() => {
          localStorage.setItem('oauth_return_url', window.location.pathname);
          window.location.href = '/auth/github/login';
        }}
        purpose="claim-ownership"
        contractAddress={auditData?.contractAddress}
        deployerAddress={jobInfo?.deployerAddress}
        onClaimSuccess={() => {
          setIsClaimed(true);
          setShowClaimModal(false);
        }}
      />
    </div>
    </>
  )
}
