import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './config/wagmi';
import { initAuth, logout as authLogout, type AuthUser } from './services/authService';

// Create a client for React Query (required by wagmi)
const queryClient = new QueryClient();

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
import AuditClarifications from './pages/AuditClarifications';

import ProjectDetails from './pages/ProjectDetails';
import Onboarding from './pages/Onboarding';
import Management from './pages/Management';
import Nodes from './pages/Nodes';
import Credentials from './pages/Credentials';
import Subscription from './pages/Subscription';

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
import AuthModal from './components/AuthModal';

function App() {
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [jobId, setJobId] = useState<number | undefined>();
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    type: 'full',
    components: [],
    testStyles: ['behavioral', 'stride']
  });

  // Check auth status on load - supports both JWT and cookie auth
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { authed, user } = await initAuth();
        setIsAuthed(authed);
        setCurrentUser(user);
      } catch {
        setIsAuthed(false);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleGitHubLogin = () => {
    localStorage.setItem('oauth_return_url', '/dashboard');
    window.location.href = '/auth/github/login';
  };

  const handleLogout = async () => {
    try {
      await authLogout();
      setIsAuthed(false);
      setCurrentUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleWalletSuccess = (tokens: { accessToken: string; refreshToken: string; user: any }) => {
    setIsAuthed(true);
    setCurrentUser(tokens.user);
    setShowAuthModal(false);
  };

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <BrowserRouter>
            <AuthModal
              isOpen={showAuthModal}
              onClose={() => setShowAuthModal(false)}
              onGitHubLogin={handleGitHubLogin}
              onWalletSuccess={handleWalletSuccess}
            />
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

              {/* Onboarding - Protected but standalone (no dashboard layout) */}
              <Route path="/onboarding" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <Onboarding />
                </ProtectedRoute>
              } />

              {/* Protected App Pages with DashboardLayout */}
              <Route path="/dashboard" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <Dashboard
                      onViewAudit={(slug) => window.location.href = `/project/${slug}`}
                      onNewAudit={() => window.location.href = '/create-project'}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/project/:slug" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <ProjectDetails />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/management" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <Management />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/nodes" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <Nodes />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/credentials" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <Credentials />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/subscription" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <Subscription />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <Settings />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/connect" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <ConnectSource
                      onNext={() => window.location.href = '/configure'}
                      projectData={projectData}
                      setProjectData={setProjectData}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/configure" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <ConfigureAudit
                      onNext={() => window.location.href = '/review'}
                      onBack={() => window.location.href = '/connect'}
                      projectData={projectData}
                      setProjectData={setProjectData}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/review" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <ReviewAndRun
                      onBack={() => window.location.href = '/configure'}
                      projectData={projectData}
                      initialJobId={jobId}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/scan" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <ScanContract
                      onBack={() => window.location.href = '/dashboard'}
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
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/create-project" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
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
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/add-components" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
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
                  </DashboardLayout>
                </ProtectedRoute>
              } />
              <Route path="/preaudit-questionnaire/:jobId" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <DashboardLayout onLogout={handleLogout}>
                    <PreAuditQuestionnaire
                      jobId={jobId}
                      projectName={projectData?.name || 'Untitled Project'}
                      onComplete={() => window.location.href = `/audit/${jobId}`}
                      onSkip={() => window.location.href = `/audit/${jobId}`}
                      onBack={() => window.location.href = '/dashboard'}
                      onHomeClick={() => window.location.href = '/'}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              } />

              <Route path="/clarifications/:jobId" element={
                <ProtectedRoute isAuthed={isAuthed} isLoading={isAuthLoading}>
                  <AuditClarifications
                    jobId={window.location.pathname.split('/').pop() || ''}
                    projectName={projectData?.name || 'Untitled Project'}
                    phase="pre_audit"
                    onComplete={() => window.location.href = `/audit/${window.location.pathname.split('/').pop()}`}
                    onBack={() => window.history.back()}
                    onHomeClick={() => window.location.href = '/'}
                  />
                </ProtectedRoute>
              } />

              {/* 404 Page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </HelmetProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
