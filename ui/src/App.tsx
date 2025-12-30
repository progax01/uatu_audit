import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import ConnectSource from './pages/ConnectSource'
import ConfigureAudit from './pages/ConfigureAudit'
import ReviewAndRun from './pages/ReviewAndRun'
import ScanContract from './pages/ScanContract'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import AuditDetails from './pages/AuditDetails'
import ProjectCreate from './pages/ProjectCreate'
import AddComponents from './pages/AddComponents'
import PreAuditQuestionnaire from './pages/PreAuditQuestionnaire'

// Project types matching backend
type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit'
type ComponentType = 'github-repo' | 'deployed-contract' | 'dapp-url' | 'library-source' | 'manual-upload'

export interface ProjectData {
  id?: string
  name: string
  description?: string
  type: ProjectType
  components: SourceComponentUI[]
}

export interface SourceComponentUI {
  id: string
  type: ComponentType
  displayName: string
  status: 'pending' | 'synced' | 'error'
  config: any
}

type Step = 'home' | 'connect' | 'configure' | 'review' | 'scan' | 'dashboard' | 'settings' | 'audit-details' | 'create-project' | 'add-components' | 'preaudit-questionnaire'

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

  // New project flow state
  const [projectData, setProjectData] = useState<ProjectData | null>(null)

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
    const projectId = params.get('projectId')

    if (page === 'dashboard') {
      setCurrentStep('dashboard')
    } else if (page === 'settings') {
      setCurrentStep('settings')
    } else if (page === 'create-project') {
      setCurrentStep('create-project')
    } else if (page === 'add-components' && projectId) {
      // Load project data for add-components page
      loadProjectData(projectId).then(data => {
        if (data) {
          setProjectData(data)
          setCurrentStep('add-components')
        }
      })
    } else if (page === 'preaudit-questionnaire' && jid) {
      setJobId(parseInt(jid))
      setCurrentStep('preaudit-questionnaire')
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

  // Helper to load project data
  const loadProjectData = async (projectId: string): Promise<ProjectData | null> => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) return null
      const data = await res.json()
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        type: data.type,
        components: data.components || []
      }
    } catch {
      return null
    }
  }

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
        onNewAudit={() => navigate('create-project')}
        onNewLegacyAudit={() => navigate('connect')}
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

  // ProjectCreate - New project creation page
  if (currentStep === 'create-project') {
    return (
      <ProjectCreate
        onNext={(project) => {
          setProjectData({
            id: project.id,
            name: project.name,
            description: project.description,
            type: project.type,
            components: []
          })
          navigate('add-components')
        }}
        onBack={() => navigate('dashboard')}
        onHomeClick={() => navigate('home')}
      />
    )
  }

  // AddComponents - Add sources to project
  if (currentStep === 'add-components') {
    return (
      <AddComponents
        projectId={projectData?.id || ''}
        projectName={projectData?.name || ''}
        projectType={projectData?.type || 'full'}
        onNext={(components) => {
          if (projectData) {
            setProjectData({ ...projectData, components })
          }
          // Start audit which will trigger pre-audit questionnaire
          navigate('configure')
        }}
        onBack={() => navigate('create-project')}
        onHomeClick={() => navigate('home')}
        onStartAudit={(jId) => {
          setJobId(jId)
          navigate('preaudit-questionnaire')
        }}
      />
    )
  }

  // PreAuditQuestionnaire - Answer pre-audit questions
  if (currentStep === 'preaudit-questionnaire') {
    return (
      <PreAuditQuestionnaire
        jobId={jobId}
        projectName={projectData?.name || repoData.project}
        onComplete={() => navigate('audit-details', { jobId })}
        onSkip={() => navigate('audit-details', { jobId })}
        onBack={() => navigate('dashboard')}
        onHomeClick={() => navigate('home')}
      />
    )
  }

  return null
}

export default App
