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

// Protected route wrapper - redirects to home with login prompt if not authenticated
function ProtectedRoute({ isAuthed, isLoading, children }: { isAuthed: boolean; isLoading: boolean; children: React.ReactNode }) {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    // Store the intended destination and redirect to home
    localStorage.setItem('oauth_return_url', window.location.pathname);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
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
      } finally {
        setIsAuthLoading(false);
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

          {/* App Pages - Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <Dashboard
                onHomeClick={() => window.location.href = '/'}
                onSettingsClick={() => window.location.href = '/settings'}
                onViewAudit={(id) => window.location.href = `/audit/${id}`}
                onNewAudit={() => window.location.href = '/create-project'}
                onNewLegacyAudit={() => window.location.href = '/connect'}
              />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <Settings
                onHomeClick={() => window.location.href = '/'}
                onBack={() => window.location.href = '/dashboard'}
              />
            </ProtectedRoute>
          } />

          <Route path="/audit/:jobId" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <AuditDetails
                jobId={jobId}
                onHomeClick={() => window.location.href = '/'}
                onBack={() => window.location.href = '/dashboard'}
              />
            </ProtectedRoute>
          } />

          <Route path="/connect" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <ConnectSource
                onNext={() => window.location.href = '/configure'}
                onHomeClick={() => window.location.href = '/'}
                repoData={repoData}
                setRepoData={setRepoData}
              />
            </ProtectedRoute>
          } />

          <Route path="/configure" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <ConfigureAudit
                onNext={() => window.location.href = '/review'}
                onBack={() => window.location.href = '/connect'}
                onHomeClick={() => window.location.href = '/'}
                repoData={repoData}
                setRepoData={setRepoData}
              />
            </ProtectedRoute>
          } />

          <Route path="/review" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <ReviewAndRun
                onBack={() => window.location.href = '/configure'}
                onHomeClick={() => window.location.href = '/'}
                repoData={repoData}
                initialJobId={jobId}
              />
            </ProtectedRoute>
          } />

          <Route path="/scan" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
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
            </ProtectedRoute>
          } />

          <Route path="/create-project" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
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
            </ProtectedRoute>
          } />

          <Route path="/add-components" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
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
            </ProtectedRoute>
          } />

          <Route path="/preaudit-questionnaire/:jobId" element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <PreAuditQuestionnaire
                jobId={jobId}
                projectName={projectData?.name || repoData.project}
                onComplete={() => window.location.href = `/audit/${jobId}`}
                onSkip={() => window.location.href = `/audit/${jobId}`}
                onBack={() => window.location.href = '/dashboard'}
                onHomeClick={() => window.location.href = '/'}
              />
            </ProtectedRoute>
          } />

          {/* 404 Page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
