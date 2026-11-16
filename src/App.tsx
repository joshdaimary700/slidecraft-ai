import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiFetch, setStoredToken } from './lib/api';
import { AuthUser } from './shared/types';
import { AuthModal } from './components/AuthModal';
import { Dashboard, DashboardTab } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { SharedPresentationView } from './components/SharedPresentationView';
import { SlideEditor } from './components/SlideEditor';
import { OfflineIndicator } from './components/PWAInstallControl';
import { LegalPage } from './components/LegalPages';

type AppView = 'landing' | 'dashboard' | 'editor' | 'shared' | 'privacy' | 'terms';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  const [view, setView] = useState<AppView>('landing');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [activePresentationId, setActivePresentationId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const navigateLegal = (mode: 'privacy' | 'terms') => {
    const targetPath = mode === 'privacy' ? '/privacy' : '/terms';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setView(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    const pathname = window.location.pathname.toLowerCase();
    const createShortcut = params.get('create') === '1';

    if (pathname === '/privacy') {
      setView('privacy');
    } else if (pathname === '/terms') {
      setView('terms');
    } else if (shareParam) {
      setShareSlug(shareParam);
      setView('shared');
    }

    const handlePopState = () => {
      const nextPath = window.location.pathname.toLowerCase();
      if (nextPath === '/privacy') setView('privacy');
      else if (nextPath === '/terms') setView('terms');
      else setView('landing');
    };
    window.addEventListener('popstate', handlePopState);

    Promise.all([
      apiFetch<{ googleClientId: string }>('/api/config/public').catch(() => ({ googleClientId: '' })),
      apiFetch<{ user: AuthUser }>('/api/auth/me').catch(() => null),
    ]).then(([cfg, me]) => {
      if (cfg?.googleClientId) setGoogleClientId(cfg.googleClientId);
      if (me?.user) {
        setUser(me.user);
        if (createShortcut && pathname === '/') {
          setDashboardTab('create');
          setView('dashboard');
        }
      } else if (createShortcut && pathname === '/') {
        setAuthModalMode('register');
        setPendingAction(() => () => {
          setDashboardTab('create');
          setView('dashboard');
        });
        setAuthModalOpen(true);
      }
      setAuthChecked(true);
    });

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const requireAuthThen = (mode: 'login' | 'register', action: () => void) => {
    if (user) {
      action();
    } else {
      setAuthModalMode(mode);
      setPendingAction(() => action);
      setAuthModalOpen(true);
    }
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredToken(null);
    setUser(null);
    setView('landing');
    setActivePresentationId(null);
  };

  const handleUseTemplateFromLanding = async (templateId: string) => {
    requireAuthThen('register', async () => {
      try {
        const res = await apiFetch<{ presentationId: string }>(`/api/templates/${templateId}/use`, {
          method: 'POST',
        });
        setActivePresentationId(res.presentationId);
        setView('editor');
      } catch {
        setDashboardTab('templates');
        setView('dashboard');
      }
    });
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
          <span>Loading SlideCraft AI...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {(view === 'privacy' || view === 'terms') && (
        <LegalPage
          mode={view}
          onBack={() => {
            window.history.pushState({}, '', '/');
            setView('landing');
          }}
          onSwitch={(nextMode) => navigateLegal(nextMode)}
        />
      )}

      {view === 'shared' && shareSlug && (
        <SharedPresentationView
          shareSlug={shareSlug}
          onExit={() => {
            window.history.replaceState({}, '', '/');
            setShareSlug(null);
            setView('landing');
          }}
        />
      )}

      {view === 'landing' && (
        <LandingPage
          user={user}
          onCreatePresentation={() =>
            requireAuthThen('register', () => {
              setDashboardTab('create');
              setView('dashboard');
            })
          }
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setPendingAction(() => () => {
              setDashboardTab('overview');
              setView('dashboard');
            });
            setAuthModalOpen(true);
          }}
          onOpenDashboard={(tab = 'overview') => {
            setDashboardTab(tab);
            setView('dashboard');
          }}
          onUseTemplate={handleUseTemplateFromLanding}
          onOpenLegal={navigateLegal}
        />
      )}

      {view === 'dashboard' && user && (
        <Dashboard
          user={user}
          initialTab={dashboardTab}
          onUserUpdated={(u) => setUser(u)}
          onOpenEditor={(presId) => {
            setActivePresentationId(presId);
            setView('editor');
          }}
          onLogout={handleLogout}
          onGoHome={() => setView('landing')}
        />
      )}

      {view === 'editor' && user && activePresentationId && (
        <SlideEditor
          presentationId={activePresentationId}
          user={user}
          onUserUpdated={(u) => setUser(u)}
          onBack={() => {
            setDashboardTab('presentations');
            setView('dashboard');
          }}
          onRequestUpgrade={() => {
            setDashboardTab('billing');
            setView('dashboard');
          }}
        />
      )}

      {authModalOpen && (
        <AuthModal
          initialMode={authModalMode}
          googleClientId={googleClientId}
          onClose={() => {
            setAuthModalOpen(false);
            setPendingAction(null);
          }}
          onSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setAuthModalOpen(false);
            if (pendingAction) {
              const fn = pendingAction;
              setPendingAction(null);
              fn();
            } else {
              setDashboardTab('overview');
              setView('dashboard');
            }
          }}
        />
      )}

      <OfflineIndicator />
    </>
  );
}
