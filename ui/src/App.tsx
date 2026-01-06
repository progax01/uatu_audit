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

import ProjectDetails from './pages/ProjectDetails';

// Project types matching backend
type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit';
type ComponentType = 'github-repo' | 'deployed-contract' | 'dapp-url' | 'library-source' | 'manual-upload';

export interface ProjectData {
  id?: string;
  name: string;
  description?: string;
  type: ProjectType;
  components: SourceComponentUI[];
  ecosystems?: string[];
  testStyles?: string[];
  selectedFiles?: string[];
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

import QuickScan from './pages/QuickScan';
import PublicAudits from './pages/PublicAudits';
import DashboardLayout from './components/DashboardLayout';

function App() {
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [jobId, setJobId] = useState<number | undefined>();
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    type: 'full',
    components: [],
    testStyles: ['behavioral', 'stride']
  });

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

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout');
      setIsAuthed(false);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed', err);
    }
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

          {/* Standalone Public Tools (Standalone Headers) */}
          <Route path="/quick-scan" element={<QuickScan />} />
          <Route path="/public-audits" element={<PublicAudits />} />
          <Route path="/audit/:jobId" element={
            <AuditDetails
              onHomeClick={() => window.location.href = '/'}
              onBack={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/public-audits';
                }
              }}
            />
          } />

          {/* App Pages - Wrap all with DashboardLayout */}
          <Route element={
            <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
              <DashboardLayout onLogout={handleLogout}>
                <Routes>
                  <Route path="/dashboard" element={
                    <Dashboard
                      onViewAudit={(slug) => window.location.href = `/project/${slug}`}
                      onNewAudit={() => window.location.href = '/create-project'}
                    />
                  } />
                  <Route path="/project/:slug" element={<ProjectDetails />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/project/:slug" element={<ProjectDetails />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/connect" element={
                    <ConnectSource
                      onNext={() => window.location.href = '/configure'}
                      projectData={projectData}
                      setProjectData={setProjectData}
                    />
                  } />
                  <Route path="/configure" element={
                    <ConfigureAudit
                      onNext={() => window.location.href = '/review'}
                      onBack={() => window.location.href = '/connect'}
                      projectData={projectData}
                      setProjectData={setProjectData}
                    />
                  } />
                  <Route path="/review" element={
                    <ReviewAndRun
                      onBack={() => window.location.href = '/configure'}
                      projectData={projectData}
                      initialJobId={jobId}
                    />
                  } />
                  <Route path="/scan" element={
                    <ScanContract
                      onBack={() => window.location.href = '/'}
                      projectData={projectData}
                      setProjectData={setProjectData}
                      onStartAudit={(data) => {
                        setProjectData(prev => ({
                          ...prev,
                          name: data.project,
                          components: [{
                            id: 'temp-scan',
                            type: 'deployed-contract',
                            displayName: data.project,
                            status: 'synced',
                            config: { address: data.project, branch: data.branch }
                          }]
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
                        setProjectData(prev => ({ ...prev, components }));
                        window.location.href = '/configure';
                      }}
                      onBack={() => window.location.href = '/create-project'}
                      onStartAudit={(jId) => {
                        setJobId(jId);
                        window.location.href = `/preaudit-questionnaire/${jId}`;
                      }}
                    />
                  } />
                  <Route path="/preaudit-questionnaire/:jobId" element={
                    <PreAuditQuestionnaire
                      jobId={jobId}
                      projectName={projectData?.name || 'Untitled Project'}
                      onComplete={() => window.location.href = `/audit/${jobId}`}
                      onSkip={() => window.location.href = `/audit/${jobId}`}
                      onBack={() => window.location.href = '/dashboard'}
                      onHomeClick={() => window.location.href = '/'}
                    />
                  } />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }>
            <Route path="/dashboard" />
            <Route path="/project/:slug" />
            <Route path="/settings" />
            <Route path="/project/:slug" />
            <Route path="/settings" />
            <Route path="/connect" />
            <Route path="/configure" />
            <Route path="/review" />
            <Route path="/scan" />
            <Route path="/create-project" />
            <Route path="/add-components" />
            <Route path="/preaudit-questionnaire/:jobId" />
          </Route>

          {/* 404 Page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
