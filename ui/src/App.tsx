import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import ConnectSource from './pages/ConnectSource'
import ConfigureAudit from './pages/ConfigureAudit'
import ReviewAndRun from './pages/ReviewAndRun'
import ScanContract from './pages/ScanContract'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import AuditDetails from './pages/AuditDetails'

type Step = 'home' | 'connect' | 'configure' | 'review' | 'scan' | 'dashboard' | 'settings' | 'audit-details'

function App() {
  const [currentStep, setCurrentStep] = useState<Step>('home')
  const [repoData, setRepoData] = useState({
    repo: '',
    branch: '',
    project: '',
    ecosystems: [] as string[],
    testStyles: ['behavioral', 'stride'] as string[],
    selectedFiles: [] as string[],
  })
  const [jobId, setJobId] = useState<number | undefined>()
  const [isAuthed, setIsAuthed] = useState<boolean>(false)

  // Check auth status on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/auth/status')
        const data = await res.json()
        setIsAuthed(!!data.authed)
      } catch {
        setIsAuthed(false)
      }
    }
    checkAuth()
  }, [])

  // Handle URL parameters for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const project = params.get('project')
    const branch = params.get('branch')
    const jid = params.get('jobId')
    const page = params.get('page')

    if (page === 'dashboard') {
      setCurrentStep('dashboard')
    } else if (page === 'settings') {
      setCurrentStep('settings')
    } else if (project && branch) {
      setRepoData(prev => ({ ...prev, project, branch }))
      if (jid) {
        setJobId(parseInt(jid))
        setCurrentStep('audit-details')
      } else {
        setCurrentStep('review')
      }
    }
  }, [])

  const navigate = (step: Step, params?: any) => {
    if (params?.jobId) setJobId(params.jobId)
    setCurrentStep(step)
  }

  // HomePage - Landing page
  if (currentStep === 'home') {
    return (
      <HomePage
        isAuthed={isAuthed}
        onGetStarted={() => navigate(isAuthed ? 'dashboard' : 'connect')}
        onEnterApp={() => navigate('dashboard')}
        onScanContract={() => navigate('scan')}
        onStartAudit={(data) => {
          setRepoData(prev => ({
            ...prev,
            project: data.project,
            branch: data.branch,
            repo: `scan://${data.project}`,
          }))
          setJobId(data.jobId)
          navigate('audit-details')
        }}
      />
    )
  }

  // Dashboard
  if (currentStep === 'dashboard') {
    return (
      <Dashboard
        onHomeClick={() => navigate('home')}
        onSettingsClick={() => navigate('settings')}
        onViewAudit={(id) => navigate('audit-details', { jobId: id })}
        onNewAudit={() => navigate('connect')}
      />
    )
  }

  // Settings
  if (currentStep === 'settings') {
    return (
      <Settings
        onHomeClick={() => navigate('home')}
        onBack={() => navigate('dashboard')}
      />
    )
  }

  // AuditDetails
  if (currentStep === 'audit-details') {
    return (
      <AuditDetails
        jobId={jobId}
        onHomeClick={() => navigate('home')}
        onBack={() => navigate('dashboard')}
      />
    )
  }

  // ConnectSource
  if (currentStep === 'connect') {
    return (
      <ConnectSource
        onNext={() => navigate('configure')}
        onHomeClick={() => navigate('home')}
        repoData={repoData}
        setRepoData={setRepoData}
      />
    )
  }

  // ConfigureAudit
  if (currentStep === 'configure') {
    return (
      <ConfigureAudit
        onNext={() => navigate('review')}
        onBack={() => navigate('connect')}
        onHomeClick={() => navigate('home')}
        repoData={repoData}
        setRepoData={setRepoData}
      />
    )
  }

  // ReviewAndRun
  if (currentStep === 'review') {
    return (
      <ReviewAndRun
        onBack={() => navigate('configure')}
        onHomeClick={() => navigate('home')}
        repoData={repoData}
        initialJobId={jobId}
      />
    )
  }

  // ScanContract
  if (currentStep === 'scan') {
    return (
      <ScanContract
        onBack={() => navigate('home')}
        onHomeClick={() => navigate('home')}
        onStartAudit={(data) => {
          setRepoData(prev => ({
            ...prev,
            project: data.project,
            branch: data.branch,
            repo: `scan://${data.project}`,
          }))
          setJobId(data.jobId)
          navigate('audit-details')
        }}
      />
    )
  }

  return null
}

export default App
