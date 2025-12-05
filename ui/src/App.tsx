import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import ConnectSource from './pages/ConnectSource'
import ConfigureAudit from './pages/ConfigureAudit'
import ReviewAndRun from './pages/ReviewAndRun'
import ScanContract from './pages/ScanContract'

type Step = 0 | 1 | 2 | 3 | 4

function App() {
  const [currentStep, setCurrentStep] = useState<Step>(0)
  const [repoData, setRepoData] = useState({
    repo: '',
    branch: '',
    project: '',
    ecosystems: [] as string[],
    testStyles: ['behavioral', 'stride'] as string[],
    selectedFiles: [] as string[],
  })
  const [jobId, setJobId] = useState<number | undefined>()

  // Handle URL parameters for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const project = params.get('project')
    const branch = params.get('branch')
    const jid = params.get('jobId')

    if (project && branch) {
      setRepoData(prev => ({ ...prev, project, branch }))
      if (jid) setJobId(parseInt(jid))
      setCurrentStep(3)
    }
  }, [])

  const handleScanContract = () => {
    setCurrentStep(4)
  }

  // HomePage - Landing page (step 0)
  if (currentStep === 0) {
    return (
      <HomePage
        onGetStarted={() => setCurrentStep(1)}
        onScanContract={handleScanContract}
        onStartAudit={(data) => {
          setRepoData(prev => ({
            ...prev,
            project: data.project,
            branch: data.branch,
            repo: `scan://${data.project}`,
          }))
          setJobId(data.jobId)
          setCurrentStep(3)
        }}
      />
    )
  }

  // ConnectSource has its own full-page layout, render it separately
  if (currentStep === 1) {
    return (
      <ConnectSource
        onNext={() => setCurrentStep(2)}
        onHomeClick={() => setCurrentStep(0)}
        repoData={repoData}
        setRepoData={setRepoData}
      />
    )
  }

  // ConfigureAudit has its own full-page layout
  if (currentStep === 2) {
    return (
      <ConfigureAudit
        onNext={() => setCurrentStep(3)}
        onBack={() => setCurrentStep(1)}
        onHomeClick={() => setCurrentStep(0)}
        repoData={repoData}
        setRepoData={setRepoData}
      />
    )
  }

  // ReviewAndRun has its own full-page layout
  if (currentStep === 3) {
    return (
      <ReviewAndRun
        onBack={() => setCurrentStep(2)}
        onHomeClick={() => setCurrentStep(0)}
        repoData={repoData}
        initialJobId={jobId}
      />
    )
  }

  // ScanContract - Scan deployed contract page (step 4)
  if (currentStep === 4) {
    return (
      <ScanContract
        onBack={() => setCurrentStep(0)}
        onHomeClick={() => setCurrentStep(0)}
        onStartAudit={(data) => {
          setRepoData(prev => ({
            ...prev,
            project: data.project,
            branch: data.branch,
            repo: `scan://${data.project}`,
          }))
          setJobId(data.jobId)
          setCurrentStep(3)
        }}
      />
    )
  }

  return null
}

export default App
