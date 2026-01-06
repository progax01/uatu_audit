import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Layout
import Layout from './components/Layout';

// Marketing Pages
import HomePage from './pages/HomePage';
import PricingPage from './pages/PricingPage';
import FeaturesPage from './pages/FeaturesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import SupportedChainsPage from './pages/SupportedChainsPage';
import DocumentationPage from './pages/DocumentationPage';
import UseCasesPage from './pages/UseCasesPage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';

// App Pages
import ConnectSource from './pages/ConnectSource';
import ConfigureAudit from './pages/ConfigureAudit';
import ReviewAndRun from './pages/ReviewAndRun';
import ScanContract from './pages/ScanContract';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import AuditDetails from './pages/AuditDetails';
import ProjectCreate from './pages/ProjectCreate';
import AddComponents from './pages/AddComponents';
import PreAuditQuestionnaire from './pages/PreAuditQuestionnaire';

// Project types matching backend
type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit';
type ComponentType = 'github-repo' | 'deployed-contract' | 'dapp-url' | 'library-source' | 'manual-upload';

export interface ProjectData {
  id?: string;
  name: string;
  description?: string;
  type: ProjectType;
  components: SourceComponentUI[];
}

export interface SourceComponentUI {
  id: string;
  type: ComponentType;
  displayName: string;
  status: 'pending' | 'synced' | 'error';
  config: any;
}

function App() {
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [repoData, setRepoData] = useState({
    repo: '',
    branch: '',
    project: '',
    ecosystems: [] as string[],
    testStyles: ['behavioral', 'stride'] as string[],
    selectedFiles: [] as string[],
  });
  const [jobId, setJobId] = useState<number | undefined>();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);

  // Check auth status on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/auth/status');
        const data = await res.json();
        setIsAuthed(!!data.authed);
      } catch {
        setIsAuthed(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = () => {
    localStorage.setItem('oauth_return_url', '/dashboard');
    window.location.href = '/auth/github/login';
  };

  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          {/* Marketing Pages with Layout */}
          <Route element={<Layout isAuthed={isAuthed} onLogin={handleLogin} />}>
            <Route path="/" element={<HomePage isAuthed={isAuthed} onLogin={handleLogin} />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/supported-chains" element={<SupportedChainsPage />} />
            <Route path="/docs" element={<DocumentationPage />} />
            <Route path="/use-cases" element={<UseCasesPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Route>

          {/* App Pages without standard layout */}
          <Route path="/dashboard" element={
            <Dashboard
              onHomeClick={() => window.location.href = '/'}
              onSettingsClick={() => window.location.href = '/settings'}
              onViewAudit={(id) => window.location.href = `/audit/${id}`}
              onNewAudit={() => window.location.href = '/create-project'}
              onNewLegacyAudit={() => window.location.href = '/connect'}
            />
          } />

          <Route path="/settings" element={
            <Settings
              onHomeClick={() => window.location.href = '/'}
              onBack={() => window.location.href = '/dashboard'}
            />
          } />

          <Route path="/audit/:jobId" element={
            <AuditDetails
              jobId={jobId}
              onHomeClick={() => window.location.href = '/'}
              onBack={() => window.location.href = '/dashboard'}
            />
          } />

          <Route path="/connect" element={
            <ConnectSource
              onNext={() => window.location.href = '/configure'}
              onHomeClick={() => window.location.href = '/'}
              repoData={repoData}
              setRepoData={setRepoData}
            />
          } />

          <Route path="/configure" element={
            <ConfigureAudit
              onNext={() => window.location.href = '/review'}
              onBack={() => window.location.href = '/connect'}
              onHomeClick={() => window.location.href = '/'}
              repoData={repoData}
              setRepoData={setRepoData}
            />
          } />

          <Route path="/review" element={
            <ReviewAndRun
              onBack={() => window.location.href = '/configure'}
              onHomeClick={() => window.location.href = '/'}
              repoData={repoData}
              initialJobId={jobId}
            />
          } />

          <Route path="/scan" element={
            <ScanContract
              onBack={() => window.location.href = '/'}
              onHomeClick={() => window.location.href = '/'}
              onStartAudit={(data) => {
                setRepoData(prev => ({
                  ...prev,
                  project: data.project,
                  branch: data.branch,
                  repo: `scan://${data.project}`,
                }));
                setJobId(data.jobId);
                window.location.href = `/audit/${data.jobId}`;
              }}
            />
          } />

          <Route path="/create-project" element={
            <ProjectCreate
              onNext={(project) => {
                setProjectData({
                  id: project.id,
                  name: project.name,
                  description: project.description,
                  type: project.type,
                  components: []
                });
                window.location.href = '/add-components';
              }}
              onBack={() => window.location.href = '/dashboard'}
              onHomeClick={() => window.location.href = '/'}
            />
          } />

          <Route path="/add-components" element={
            <AddComponents
              projectId={projectData?.id || ''}
              projectName={projectData?.name || ''}
              projectType={projectData?.type || 'full'}
              onNext={(components) => {
                if (projectData) {
                  setProjectData({ ...projectData, components });
                }
                window.location.href = '/configure';
              }}
              onBack={() => window.location.href = '/create-project'}
              onHomeClick={() => window.location.href = '/'}
              onStartAudit={(jId) => {
                setJobId(jId);
                window.location.href = `/preaudit-questionnaire/${jId}`;
              }}
            />
          } />

          <Route path="/preaudit-questionnaire/:jobId" element={
            <PreAuditQuestionnaire
              jobId={jobId}
              projectName={projectData?.name || repoData.project}
              onComplete={() => window.location.href = `/audit/${jobId}`}
              onSkip={() => window.location.href = `/audit/${jobId}`}
              onBack={() => window.location.href = '/dashboard'}
              onHomeClick={() => window.location.href = '/'}
            />
          } />

          {/* 404 Page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
