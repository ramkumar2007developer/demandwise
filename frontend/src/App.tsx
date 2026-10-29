import { useState, useEffect, lazy, Suspense } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { HowItWorks } from './components/HowItWorks';
import { AnalyticsPreview } from './components/AnalyticsPreview';
import type { Language } from './data/translations';
import { api } from './services/api';
import { X, Play } from 'lucide-react';

const DashboardModal = lazy(() =>
  import('./components/DashboardModal').then((m) => ({ default: m.DashboardModal }))
);

export function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [backendVersion, setBackendVersion] = useState<string>('');

  useEffect(() => {
    // Check backend health on mount
    api
      .getHealth()
      .then((health) => {
        setBackendStatus('connected');
        setBackendVersion(health.version || '1.0.0');
      })
      .catch(() => {
        setBackendStatus('disconnected');
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#050607] text-[#F5F5F5] font-sans selection:bg-[#FF2638] selection:text-white">
      {/* Backend Connectivity Status Indicator Banner (Subtle floating pill) */}
      <div className="fixed bottom-4 right-4 z-40 hidden sm:flex items-center gap-2 bg-[#111418]/90 backdrop-blur-md border border-[#262B33] px-3.5 py-1.5 rounded-full text-xs shadow-xl">
        {backendStatus === 'connected' ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#A5ABB4]">
              Backend Active: <strong className="text-white">v{backendVersion}</strong>
            </span>
          </>
        ) : backendStatus === 'checking' ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[#A5ABB4]">Checking backend connection...</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-rose-300">Backend offline (port 8000)</span>
          </>
        )}
      </div>

      {/* Navigation */}
      <Navbar
        language={language}
        onLanguageChange={setLanguage}
        onOpenDashboard={() => setDashboardOpen(true)}
      />

      {/* Main Sections */}
      <main>
        {/* Hero */}
        <Hero
          language={language}
          onOpenDashboard={() => setDashboardOpen(true)}
          onWatchDemo={() => setDemoModalOpen(true)}
        />

        {/* Features */}
        <Features
          language={language}
          onExploreClick={() => setDashboardOpen(true)}
        />

        {/* How It Works */}
        <HowItWorks language={language} />

        {/* Analytics Preview & Journey CTA */}
        <AnalyticsPreview
          language={language}
          onGetStarted={() => setDashboardOpen(true)}
        />
      </main>

      {/* Interactive Business Analysis Dashboard Modal */}
      {dashboardOpen && (
        <Suspense fallback={null}>
          <DashboardModal
            isOpen={dashboardOpen}
            onClose={() => setDashboardOpen(false)}
            language={language}
            onLanguageChange={setLanguage}
          />
        </Suspense>
      )}

      {/* Watch Demo Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111418] border border-[#262B33] rounded-2xl max-w-lg w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#1B1F24] text-[#A5ABB4] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-full bg-[#FF2638]/20 text-[#FF2638] flex items-center justify-center mx-auto shadow-glowSm">
              <Play className="w-7 h-7 fill-current ml-0.5" />
            </div>

            <h3 className="text-xl font-bold text-white">DemandWise Product Overview</h3>
            <p className="text-sm text-[#A5ABB4] leading-relaxed">
              DemandWise integrates real-time OpenStreetMap competitor discovery, independent startup budget
              feasibility analysis, synthetic machine learning demand estimation, and Groq-powered AI explanations for
              Coimbatore.
            </p>

            <div className="pt-2">
              <button
                onClick={() => {
                  setDemoModalOpen(false);
                  setDashboardOpen(true);
                }}
                className="w-full py-3 rounded-full bg-[#FF2638] hover:bg-[#ff3b4b] text-white font-semibold text-sm shadow-glow transition-all"
              >
                Launch Interactive Analysis Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
