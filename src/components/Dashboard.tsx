import React, { useEffect, useState } from 'react';
import {
  Copy,
  CreditCard,
  Download,
  FilePlus2,
  FolderOpen,
  Heart,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  LogOut,
  Pencil,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiFetch, downloadPresentationFile } from '../lib/api';
import {
  AuthUser,
  BillingCycle,
  PlanCode,
  PresentationRecord,
  SUBSCRIPTION_PLANS,
  TemplateRecord,
} from '../shared/types';
import { AdminDashboard } from './AdminDashboard';
import { GeneratorWorkspace } from './GeneratorWorkspace';
import { SlideRenderer } from './SlideRenderer';
import { PWAInstallControl } from './PWAInstallControl';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export type DashboardTab =
  | 'overview'
  | 'presentations'
  | 'create'
  | 'templates'
  | 'billing'
  | 'settings'
  | 'admin';

interface DashboardProps {
  user: AuthUser;
  initialTab?: DashboardTab;
  onUserUpdated: (u: AuthUser) => void;
  onOpenEditor: (presentationId: string) => void;
  onLogout: () => void;
  onGoHome: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  initialTab = 'overview',
  onUserUpdated,
  onOpenEditor,
  onLogout,
  onGoHome,
}) => {
  const [tab, setTab] = useState<DashboardTab>(initialTab);
  const [presentations, setPresentations] = useState<PresentationRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('All');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Billing state
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [promoCode, setPromoCode] = useState('');
  const [billingError, setBillingError] = useState('');
  const [billingInfo, setBillingInfo] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Profile form state
  const [profName, setProfName] = useState(user.name);
  const [profOrg, setProfOrg] = useState(user.organization || '');
  const [profJob, setProfJob] = useState(user.jobTitle || '');
  const [profLang, setProfLang] = useState(user.preferredLanguage || 'English');
  const [profSaved, setProfSaved] = useState('');

  const [actionError, setActionError] = useState('');

  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      const [presRes, tplRes, billRes] = await Promise.all([
        apiFetch<{ presentations: PresentationRecord[] }>('/api/presentations'),
        apiFetch<{ templates: TemplateRecord[] }>('/api/templates'),
        apiFetch('/api/billing/status'),
      ]);
      setPresentations(presRes.presentations || []);
      setTemplates(tplRes.templates || []);
      setBillingData(billRes);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to load workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const handleRename = async (id: string) => {
    if (!renameText.trim()) {
      setRenamingId(null);
      return;
    }
    await apiFetch(`/api/presentations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: renameText.trim() }),
    });
    setPresentations((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: renameText.trim() } : p))
    );
    setRenamingId(null);
  };

  const handleDuplicate = async (id: string) => {
    const res = await apiFetch<{ presentationId: string }>(`/api/presentations/${id}/duplicate`, {
      method: 'POST',
    });
    await loadWorkspaceData();
    onOpenEditor(res.presentationId);
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/presentations/${id}`, { method: 'DELETE' });
    setPresentations((prev) => prev.filter((p) => p.id !== id));
  };

  const handleToggleFavorite = async (tplId: string) => {
    const res = await apiFetch<{ favorited: boolean }>(`/api/templates/${tplId}/favorite`, {
      method: 'POST',
    });
    setTemplates((prev) =>
      prev.map((t) => (t.id === tplId ? { ...t, isFavorited: res.favorited } : t))
    );
  };

  const handleUseTemplate = async (tplId: string) => {
    setActionError('');
    try {
      const res = await apiFetch<{ presentationId: string }>(`/api/templates/${tplId}/use`, {
        method: 'POST',
      });
      onOpenEditor(res.presentationId);
    } catch (err: any) {
      setActionError(err?.message || 'Unable to use template.');
      if (err?.data?.upgradeRequired) setTab('billing');
    }
  };

  const handleUpgradeCheckout = async (planCode: PlanCode) => {
    setBillingError('');
    setBillingInfo('');
    if (planCode === 'FREE') {
      try {
        const res = await apiFetch<{ user: AuthUser }>('/api/billing/downgrade-free', {
          method: 'POST',
        });
        onUserUpdated(res.user);
        setBillingInfo('Subscription updated to Free plan.');
      } catch (err: any) {
        setBillingError(err?.message || 'Failed to switch to Free plan.');
      }
      return;
    }

    setCheckoutLoading(planCode);
    try {
      const order = await apiFetch('/api/billing/create-order', {
        method: 'POST',
        body: JSON.stringify({ planCode, billingCycle, promoCode }),
      });

      if (!window.Razorpay) {
        setBillingError(
          'Razorpay Checkout script failed to load. Please refresh the page and ensure internet access is enabled.'
        );
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'SlideCraft AI',
        description: `${order.planName} (${order.billingCycle}) Subscription`,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: '#4F46E5' },
        handler: async (response: any) => {
          try {
            const verify = await apiFetch<{ user: AuthUser }>('/api/billing/verify-payment', {
              method: 'POST',
              body: JSON.stringify(response),
            });
            onUserUpdated(verify.user);
            setBillingInfo(`Subscription activated: ${order.planName}.`);
            loadWorkspaceData();
          } catch (err: any) {
            setBillingError(err?.message || 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(null);
          },
        },
      });
      rzp.open();
    } catch (err: any) {
      setBillingError(err?.message || 'Unable to initiate Razorpay checkout.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    setBillingError('');
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/billing/cancel', { method: 'POST' });
      onUserUpdated(res.user);
      setBillingInfo('Your subscription will remain active until the end of the current billing period and will not auto-renew.');
    } catch (err: any) {
      setBillingError(err?.message || 'Failed to cancel subscription.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfSaved('');
    const res = await apiFetch<{ user: AuthUser }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: profName,
        organization: profOrg,
        jobTitle: profJob,
        preferredLanguage: profLang,
      }),
    });
    onUserUpdated(res.user);
    setProfSaved('Account settings saved.');
  };

  const filteredPresentations = presentations.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const templateCategories = ['All', ...Array.from(new Set(templates.map((t) => t.category)))];
  const filteredTemplates =
    templateCategory === 'All'
      ? templates
      : templates.filter((t) => t.category === templateCategory);

  const favoriteTemplates = templates.filter((t) => t.isFavorited);
  const currentPlanDef = SUBSCRIPTION_PLANS[user.subscription.planCode];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <button
              onClick={onGoHome}
              className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
            >
              SlideCraft AI
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'create', label: 'Create Presentation', icon: Sparkles },
              { id: 'presentations', label: 'My Presentations', icon: FolderOpen },
              { id: 'templates', label: 'Template Library', icon: LayoutTemplate },
              { id: 'billing', label: 'Plans & Billing', icon: CreditCard },
              { id: 'settings', label: 'Account Settings', icon: Settings },
              ...(user.isFounder || user.role === 'ADMIN'
                ? [{ id: 'admin', label: user.isFounder ? 'Founder Console' : 'Admin Console', icon: Shield }]
                : []),
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id as DashboardTab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="text-xs">
            <div className="font-semibold text-slate-900 truncate">{user.name}</div>
            <div className="text-slate-500 truncate">{user.email}</div>
            <div className="text-indigo-700 font-medium mt-1">
              {user.isFounder ? 'Founder · Lifetime Premium' : `${currentPlanDef.name} Plan`}
            </div>
          </div>
          <PWAInstallControl variant="sidebar" />
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-6 md:p-10 overflow-y-auto">
        {actionError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {tab === 'overview' && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Founder or Standard Header */}
            {user.isFounder ? (
              <div className="bg-slate-900 text-white rounded-2xl p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-bold tracking-tight">Welcome, Founder!</h1>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm text-slate-300 pt-2">
                    <div>
                      <span className="text-slate-400">Account Status: </span>
                      <span className="text-white font-medium">Founder – Lifetime Free Access</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Subscription: </span>
                      <span className="text-white font-medium">Lifetime Premium</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Payment Required: </span>
                      <span className="text-white font-medium">No</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setTab('admin')}
                    className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold whitespace-nowrap"
                  >
                    Open Founder Console
                  </button>
                  <button
                    onClick={() => setTab('create')}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    <span>Create New Presentation</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Welcome back, {user.name}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Manage your decks, track monthly credits, and create new AI presentations.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {user.subscription.planCode !== 'BUSINESS' && (
                    <button
                      onClick={() => setTab('billing')}
                      className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 whitespace-nowrap"
                    >
                      Upgrade Plan
                    </button>
                  )}
                  <button
                    onClick={() => setTab('create')}
                    className="px-4 py-2.5 rounded-lg bg-indigo-700 text-white text-xs font-semibold hover:bg-indigo-800 whitespace-nowrap flex items-center gap-1.5"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    <span>Create New Presentation</span>
                  </button>
                </div>
              </div>
            )}

            {/* Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">Total Presentations</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {presentations.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">Monthly Credits Remaining</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {user.isFounder
                    ? 'Unlimited'
                    : `${user.usage.remainingPresentations} / ${user.usage.presentationsLimit}`}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">Current Subscription</div>
                <div className="text-2xl font-bold text-indigo-700 mt-1">
                  {user.isFounder ? 'Lifetime' : currentPlanDef.name}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">
                  {user.isFounder ? 'Account Expiry' : 'Cycle Renewal Date'}
                </div>
                <div className="text-lg font-semibold text-slate-900 mt-1.5 tabular-nums">
                  {user.isFounder
                    ? 'Never'
                    : user.subscription.currentPeriodEnd
                      ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString()
                      : 'Monthly Reset'}
                </div>
              </div>
            </div>

            {/* Recent Presentations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">Recent Presentations</h2>
                <button
                  onClick={() => setTab('presentations')}
                  className="text-xs font-medium text-indigo-700 hover:underline"
                >
                  View all
                </button>
              </div>
              {loading ? (
                <div className="py-10 flex items-center justify-center text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading presentations...</span>
                </div>
              ) : presentations.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <p className="text-sm font-medium text-slate-800">No presentations yet</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Generate your first AI presentation from a topic, document, or outline.
                  </p>
                  <button
                    onClick={() => setTab('create')}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    Create Your First Presentation
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {presentations.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onOpenEditor(p.id)}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors flex flex-col"
                    >
                      <div className="p-2.5 bg-slate-50 border-b border-slate-100 pointer-events-none">
                        {p.thumbnailSlide ? (
                          <SlideRenderer
                            slide={p.thumbnailSlide}
                            themeId={p.themeId}
                            aspectRatio={p.aspectRatio}
                            compact
                          />
                        ) : (
                          <div className="aspect-[16/9] bg-slate-200 rounded" />
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 truncate">{p.title}</h3>
                          <div className="text-xs text-slate-500 mt-1 tabular-nums">
                            {p.slideCount || 0} slides · {p.aspectRatio} · {p.language}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-3">
                          Updated {new Date(p.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Favorite Templates */}
            {favoriteTemplates.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-4">Favorite Templates</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {favoriteTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs text-slate-500 mb-1">
                          {tpl.category} · {tpl.slideCount} slides
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900">{tpl.name}</h3>
                      </div>
                      <button
                        onClick={() => handleUseTemplate(tpl.id)}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 self-start"
                      >
                        Use Template
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'create' && (
          <GeneratorWorkspace
            user={user}
            onGenerated={(id, updatedUser) => {
              onUserUpdated(updatedUser);
              onOpenEditor(id);
            }}
            onRequestUpgrade={() => setTab('billing')}
          />
        )}

        {tab === 'presentations' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Saved Presentations ({filteredPresentations.length})
              </h1>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search presentations..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {filteredPresentations.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <p className="text-sm text-slate-600">No saved presentations match your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPresentations.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div
                      onClick={() => onOpenEditor(p.id)}
                      className="p-2.5 bg-slate-50 border-b border-slate-100 cursor-pointer pointer-events-auto"
                    >
                      <div className="pointer-events-none">
                        {p.thumbnailSlide ? (
                          <SlideRenderer
                            slide={p.thumbnailSlide}
                            themeId={p.themeId}
                            aspectRatio={p.aspectRatio}
                            compact
                          />
                        ) : (
                          <div className="aspect-[16/9] bg-slate-200 rounded" />
                        )}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        {renamingId === p.id ? (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              autoFocus
                              value={renameText}
                              onChange={(e) => setRenameText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRename(p.id)}
                              className="flex-1 text-sm px-2 py-1 border border-indigo-500 rounded"
                            />
                            <button
                              onClick={() => handleRename(p.id)}
                              className="px-2.5 py-1 bg-slate-900 text-white text-xs rounded"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <h3
                            onClick={() => onOpenEditor(p.id)}
                            className="text-sm font-semibold text-slate-900 truncate cursor-pointer hover:text-indigo-700"
                          >
                            {p.title}
                          </h3>
                        )}
                        <div className="text-xs text-slate-500 mt-1 tabular-nums">
                          {p.slideCount || 0} slides · {p.purpose} · {p.language}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => onOpenEditor(p.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            title="Rename"
                            onClick={() => {
                              setRenamingId(p.id);
                              setRenameText(p.title);
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Duplicate"
                            onClick={() => handleDuplicate(p.id)}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Download PPTX"
                            onClick={() => downloadPresentationFile(p.id, 'pptx', p.title)}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'templates' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Presentation Template Library
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Start with curated structures across business, academic research, church ministry, and education.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {templateCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    templateCategory === cat
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map((tpl) => {
                const locked = tpl.isPremium && !user.isFounder && !currentPlanDef.allowsPremiumTemplates;
                return (
                  <div
                    key={tpl.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/9] bg-slate-100 overflow-hidden relative">
                        <img
                          src={tpl.previewImageUrl}
                          alt={tpl.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-5">
                        <div className="text-xs text-slate-500 mb-1 tabular-nums">
                          {tpl.category} · {tpl.slideCount} slides ·{' '}
                          {tpl.isPremium ? 'Premium' : 'Standard'}
                        </div>
                        <h3 className="text-base font-semibold text-slate-900">{tpl.name}</h3>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-5 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleUseTemplate(tpl.id)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          locked
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {locked ? 'Upgrade to Use' : 'Use Template'}
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(tpl.id)}
                        title="Save to favorites"
                        className={`p-2 rounded-lg border transition-colors ${
                          tpl.isFavorited
                            ? 'border-rose-200 bg-rose-50 text-rose-600'
                            : 'border-slate-200 text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        <Heart className="w-4 h-4" fill={tpl.isFavorited ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'billing' && (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Subscription & Billing
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Transparent monthly and annual INR pricing with Razorpay verification.
                </p>
              </div>
              {!user.isFounder && (
                <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
                  <button
                    onClick={() => setBillingCycle('MONTHLY')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                      billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('ANNUAL')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                      billingCycle === 'ANNUAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Annual (Save 20%)
                  </button>
                </div>
              )}
            </div>

            {user.isFounder ? (
              <div className="bg-slate-900 text-white rounded-2xl p-7 space-y-2">
                <div className="text-xs font-medium text-indigo-300">Founder Exemption Active</div>
                <h2 className="text-xl font-bold">Founder – Lifetime Free Access</h2>
                <p className="text-sm text-slate-300">
                  Subscription: Lifetime Premium · Payment Required: No · Never expires.
                </p>
              </div>
            ) : (
              <>
                {billingData && !billingData.razorpayConfigured && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    <strong>Razorpay Configuration Required for Live Payments:</strong> Add{' '}
                    <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_KEY_ID</code> and{' '}
                    <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_KEY_SECRET</code>{' '}
                    to your environment secrets to enable paid INR checkout.
                  </div>
                )}

                {billingError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {billingError}
                  </div>
                )}
                {billingInfo && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    {billingInfo}
                  </div>
                )}

                {/* Promo Code Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    Have a promotional offer code? Available codes:{' '}
                    <span className="font-mono font-semibold text-slate-900">ANNUAL20</span>,{' '}
                    <span className="font-mono font-semibold text-slate-900">SCHOLAR15</span>
                  </div>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg uppercase w-48"
                  />
                </div>

                {/* Plan Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {(['FREE', 'STARTER', 'PRO', 'BUSINESS'] as PlanCode[]).map((code) => {
                    const p = SUBSCRIPTION_PLANS[code];
                    const isCurrent = user.subscription.planCode === code;
                    const price = billingCycle === 'ANNUAL' ? p.annualPriceInr : p.monthlyPriceInr;
                    return (
                      <div
                        key={code}
                        className={`bg-white rounded-xl p-6 border flex flex-col justify-between ${
                          isCurrent ? 'border-indigo-600 ring-2 ring-indigo-600/15' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="text-xs text-slate-500">{p.audienceLabel}</div>
                          <h3 className="text-lg font-bold text-slate-900 mt-1">{p.name}</h3>
                          <div className="mt-3 flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-slate-900 tabular-nums">
                              ₹{price.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-slate-500">
                              /{billingCycle === 'ANNUAL' ? 'year' : 'month'}
                            </span>
                          </div>
                          <ul className="mt-5 space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                            {p.features.map((f) => (
                              <li key={f} className="leading-snug">
                                · {f}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <button
                          type="button"
                          disabled={isCurrent || Boolean(checkoutLoading)}
                          onClick={() => handleUpgradeCheckout(code)}
                          className={`mt-6 w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                            isCurrent
                              ? 'bg-slate-100 text-slate-500 cursor-default'
                              : code === 'PRO'
                                ? 'bg-indigo-700 text-white hover:bg-indigo-800'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {isCurrent
                            ? 'Current Plan'
                            : checkoutLoading === code
                              ? 'Opening Checkout...'
                              : code === 'FREE'
                                ? 'Switch to Free'
                                : `Choose ${p.name}`}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {user.subscription.planCode !== 'FREE' && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
                    <div className="text-xs text-slate-600">
                      Renewal date:{' '}
                      <strong className="text-slate-900">
                        {user.subscription.currentPeriodEnd
                          ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString()
                          : 'N/A'}
                      </strong>
                      {user.subscription.cancelAtPeriodEnd && ' · Scheduled for cancellation'}
                    </div>
                    {!user.subscription.cancelAtPeriodEnd && (
                      <button
                        onClick={handleCancelSubscription}
                        className="px-3.5 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50"
                      >
                        Cancel Auto-Renewal
                      </button>
                    )}
                  </div>
                )}

                {/* Payment History */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-900">Payment History</h3>
                  </div>
                  {(billingData?.payments || []).length === 0 ? (
                    <div className="p-6 text-xs text-slate-500">No payments recorded on this account.</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Plan</th>
                          <th className="py-2.5 px-4 text-right">Amount</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Order ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {billingData.payments.map((pay: any) => (
                          <tr key={pay.id}>
                            <td className="py-2.5 px-4 tabular-nums">
                              {new Date(pay.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-4">
                              {pay.planCode} · {pay.billingCycle}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                              ₹{pay.amountInr}
                            </td>
                            <td className="py-2.5 px-4 font-medium">{pay.status}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-500">
                              {pay.razorpayOrderId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h1 className="text-xl font-bold text-slate-900 mb-1">Account Settings</h1>
              <p className="text-xs text-slate-500 mb-6">
                Update your profile details and default presentation preferences.
              </p>
              {profSaved && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  {profSaved}
                </div>
              )}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Organization</label>
                    <input
                      type="text"
                      value={profOrg}
                      onChange={(e) => setProfOrg(e.target.value)}
                      placeholder="University, Church, Company..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Role / Title</label>
                    <input
                      type="text"
                      value={profJob}
                      onChange={(e) => setProfJob(e.target.value)}
                      placeholder="Educator, Pastor, Analyst..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Default Presentation Language
                  </label>
                  <select
                    value={profLang}
                    onChange={(e) => setProfLang(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Assamese">Assamese</option>
                    <option value="Bodo">Bodo</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Save Changes
                </button>
              </form>
            </div>

            <PWAInstallControl variant="card" />
          </div>
        )}

        {tab === 'admin' && (user.isFounder || user.role === 'ADMIN') && (
          <div className="max-w-6xl mx-auto">
            <AdminDashboard user={user} />
          </div>
        )}
      </main>
    </div>
  );
};
