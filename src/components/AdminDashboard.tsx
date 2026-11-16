import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, CheckCircle2, Copy, Download, ExternalLink, Loader2, Plus, RefreshCw, Shield, Smartphone, Trash2 } from 'lucide-react';
import { apiFetch, getStoredToken } from '../lib/api';
import { AuthUser, CURATED_VISUALS, PRESENTATION_THEMES } from '../shared/types';

interface AdminDashboardProps {
  user: AuthUser;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'analytics' | 'users' | 'payments' | 'templates' | 'promos' | 'ai' | 'settings'>(
    'analytics'
  );
  const [userSearch, setUserSearch] = useState('');

  // New template state
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('Business');
  const [tplDesc, setTplDesc] = useState('');
  const [tplTheme, setTplTheme] = useState('navy-indigo');
  const [tplPremium, setTplPremium] = useState(false);

  // New promo state
  const [promoCode, setPromoCode] = useState('');
  const [promoPct, setPromoPct] = useState(20);
  const [promoDesc, setPromoDesc] = useState('');

  // Fair-use & Play Store TWA settings
  const [fairUseLimit, setFairUseLimit] = useState('200');
  const [playPackageName, setPlayPackageName] = useState('com.slidecraft.ai');
  const [playSha256, setPlaySha256] = useState('');
  const [savingPlayConfig, setSavingPlayConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [readinessChecks, setReadinessChecks] = useState<
    { label: string; ok: boolean; detail: string }[] | null
  >(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [downloadingAndroid, setDownloadingAndroid] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/overview');
      setData(res);
      const fu = (res.settings || []).find((s: any) => s.key === 'founder_daily_fair_use_limit');
      if (fu) setFairUseLimit(fu.value);
      const pkg = (res.settings || []).find((s: any) => s.key === 'play_store_package_name');
      if (pkg?.value) setPlayPackageName(pkg.value);
      const sha = (res.settings || []).find((s: any) => s.key === 'play_store_sha256_fingerprints');
      if (sha?.value) setPlaySha256(sha.value);
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateUser = async (id: string, patch: { role?: string; planCode?: string }) => {
    setError('');
    try {
      await apiFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await loadData();
      setStatusMsg('User account updated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update user.');
    }
  };

  const handleRefund = async (paymentId: string) => {
    setError('');
    try {
      await apiFetch('/api/admin/refund', {
        method: 'POST',
        body: JSON.stringify({ paymentId }),
      });
      await loadData();
      setStatusMsg('Refund processed via Razorpay.');
    } catch (err: any) {
      setError(err?.message || 'Refund failed.');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({ code: promoCode, discountPercent: promoPct, description: promoDesc }),
      });
      setPromoCode('');
      setPromoDesc('');
      await loadData();
      setStatusMsg('Promotional offer saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create promo.');
    }
  };

  const handleTogglePromo = async (id: string, active: boolean) => {
    await apiFetch(`/api/admin/promotions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
    await loadData();
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: tplName,
          category: tplCategory,
          description: tplDesc,
          themeId: tplTheme,
          previewImageUrl: CURATED_VISUALS[0].url,
          isPremium: tplPremium,
          slideCount: 10,
        }),
      });
      setTplName('');
      setTplDesc('');
      setStatusMsg('Template added to library.');
    } catch (err: any) {
      setError(err?.message || 'Failed to add template.');
    }
  };

  const handleSaveFairUse = async () => {
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: 'founder_daily_fair_use_limit', value: fairUseLimit }),
      });
      setStatusMsg('Founder fair-use safeguard updated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save setting.');
    }
  };

  const handleSavePlayStoreConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlayConfig(true);
    setError('');
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: 'play_store_package_name', value: playPackageName.trim() || 'com.slidecraft.ai' }),
      });
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key: 'play_store_sha256_fingerprints', value: playSha256.trim() }),
      });
      setStatusMsg('Google Play Digital Asset Links configuration saved.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save Play Store configuration.');
    } finally {
      setSavingPlayConfig(false);
    }
  };

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleRunReadinessCheck = async () => {
    setCheckingReadiness(true);
    const results: { label: string; ok: boolean; detail: string }[] = [];
    try {
      const manRes = await fetch('/manifest.webmanifest');
      const manJson = manRes.ok ? await manRes.json().catch(() => null) : null;
      results.push({
        label: 'Web App Manifest (/manifest.webmanifest)',
        ok: Boolean(manRes.ok && manJson?.name && manJson?.icons?.length >= 2),
        detail: manJson
          ? `Valid (${manJson.icons?.length || 0} icons, display: ${manJson.display})`
          : `HTTP ${manRes.status}`,
      });

      const iconRes = await fetch('/pwa-512x512.png');
      const maskRes = await fetch('/pwa-maskable-512x512.png');
      results.push({
        label: 'Play Store Launcher Icons (512px & Maskable)',
        ok: iconRes.ok && maskRes.ok,
        detail: iconRes.ok && maskRes.ok ? 'Both 512x512 standard & maskable PNGs ready' : 'Missing PNG icon',
      });

      const privRes = await fetch('/privacy');
      results.push({
        label: 'Public Privacy Policy URL (/privacy)',
        ok: privRes.ok,
        detail: privRes.ok ? 'Accessible over HTTPS for Play Console' : `HTTP ${privRes.status}`,
      });

      const assetRes = await fetch('/.well-known/assetlinks.json');
      const assetJson = assetRes.ok ? await assetRes.json().catch(() => []) : [];
      const hasFingerprint = Array.isArray(assetJson) && assetJson.length > 0;
      results.push({
        label: 'Digital Asset Links (/.well-known/assetlinks.json)',
        ok: hasFingerprint,
        detail: hasFingerprint
          ? `Linked to ${assetJson[0]?.target?.package_name} (${assetJson[0]?.target?.sha256_cert_fingerprints?.length || 0} key)`
          : 'Waiting for your Play Console SHA-256 fingerprint below',
      });
    } catch (err: any) {
      results.push({
        label: 'Readiness Verification',
        ok: false,
        detail: err?.message || 'Network check failed',
      });
    } finally {
      setReadinessChecks(results);
      setCheckingReadiness(false);
    }
  };

  const handleDownloadAndroidStudioProject = async () => {
    setDownloadingAndroid(true);
    setError('');
    try {
      const publicOrigin = window.location.hostname.startsWith('ais-dev-')
        ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
        : window.location.origin;
      const token = getStoredToken();
      const res = await fetch(
        `/api/admin/android-studio-project?host=${encodeURIComponent(publicOrigin)}`,
        {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        }
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate Android Studio project ZIP.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SlideCraftAI-AndroidStudio.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatusMsg('Downloaded SlideCraftAI-AndroidStudio.zip — extract and open in Android Studio.');
    } catch (err: any) {
      setError(err?.message || 'Failed to download Android Studio project.');
    } finally {
      setDownloadingAndroid(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-sm text-slate-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
        <span>Loading Founder & Admin Analytics...</span>
      </div>
    );
  }

  const m = data?.metrics || {};
  const filteredUsers = (data?.users || []).filter(
    (u: any) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-700" />
            <span>{user.isFounder ? 'Founder Control Center' : 'Admin Analytics Console'}</span>
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Platform revenue, registered accounts, AI cost monitoring, and subscription management.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          {statusMsg}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Registered Users', value: m.totalUsers ?? 0 },
          { label: 'Active Paid Subs', value: m.activePaidSubs ?? 0 },
          { label: 'Total Revenue', value: `₹${(m.totalRevenueInr ?? 0).toLocaleString('en-IN')}` },
          { label: 'Decks Generated', value: m.totalPresentations ?? 0 },
          { label: 'Conversion Rate', value: `${m.conversionRate ?? 0}%` },
          { label: 'AI Cost (USD)', value: `$${Number(m.aiStats?.totalCostUsd || 0).toFixed(4)}` },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">{kpi.label}</div>
            <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
        {[
          { id: 'analytics', label: 'Charts & Growth' },
          { id: 'users', label: 'Users & Plans' },
          { id: 'payments', label: 'Payments' },
          { id: 'promos', label: 'Promotions' },
          { id: 'templates', label: 'Add Template' },
          { id: 'ai', label: 'AI Usage & Errors' },
          ...(user.isFounder ? [{ id: 'settings', label: 'Founder Settings' }] : []),
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly Revenue (INR)</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Bar dataKey="revenueInr" name="Revenue (₹)" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Registrations & Paid Conversions
            </h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.charts || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="registrations" name="New Users" stroke="#0F172A" strokeWidth={2} />
                  <Line type="monotone" dataKey="paidSubscribers" name="Paid Subs" stroke="#6D28D9" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Presentations Generated Monthly
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Bar dataKey="presentations" name="Decks Created" fill="#0F172A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-slate-900">Registered Users ({filteredUsers.length})</h3>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-64"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium">User</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium">Plan</th>
                  <th className="py-2.5 px-4 font-medium text-right">Monthly Decks</th>
                  <th className="py-2.5 px-4 font-medium text-right">AI Edits</th>
                  <th className="py-2.5 px-4 font-medium">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{u.name}</div>
                      <div className="text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">{u.role}</td>
                    <td className="py-2.5 px-4 text-slate-700">{u.planCode || 'FREE'}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{u.monthlyPresentations}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{u.monthlyAiEdits}</td>
                    <td className="py-2.5 px-4">
                      {u.role === 'FOUNDER' ? (
                        <span className="text-indigo-700 font-medium">Protected Founder</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.planCode || 'FREE'}
                            onChange={(e) => handleUpdateUser(u.id, { planCode: e.target.value })}
                            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
                          >
                            <option value="FREE">FREE</option>
                            <option value="STARTER">STARTER</option>
                            <option value="PRO">PRO</option>
                            <option value="BUSINESS">BUSINESS</option>
                          </select>
                          {user.isFounder && (
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                              className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Razorpay Payment Transactions</h3>
          </div>
          {(data?.payments || []).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No payment transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Plan & Cycle</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Order ID</th>
                    <th className="py-2.5 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.payments || []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{p.userName}</div>
                        <div className="text-slate-500">{p.userEmail}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        {p.planCode} · {p.billingCycle}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">₹{p.amountInr}</td>
                      <td className="py-2.5 px-4 font-medium">{p.status}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{p.razorpayOrderId}</td>
                      <td className="py-2.5 px-4">
                        {p.status === 'PAID' && (
                          <button
                            onClick={() => handleRefund(p.id)}
                            className="text-red-600 hover:underline font-medium"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'promos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreatePromo}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-900">Create Promotional Offer</h3>
            <input
              type="text"
              required
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Code (e.g. LAUNCH25)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase"
            />
            <input
              type="number"
              min={1}
              max={90}
              value={promoPct}
              onChange={(e) => setPromoPct(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              value={promoDesc}
              onChange={(e) => setPromoDesc(e.target.value)}
              placeholder="Offer description"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Promo Code</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Active & Inactive Codes</h3>
            <div className="divide-y divide-slate-100">
              {(data?.promotions || []).map((pr: any) => (
                <div key={pr.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-mono font-semibold text-slate-900">
                      {pr.code} · {pr.discountPercent}% off
                    </div>
                    <div className="text-slate-500 mt-0.5">{pr.description}</div>
                  </div>
                  <button
                    onClick={() => handleTogglePromo(pr.id, !pr.active)}
                    className={`px-3 py-1 rounded-md border text-xs font-medium ${
                      pr.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {pr.active ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <form onSubmit={handleCreateTemplate} className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Publish New Presentation Template</h3>
          <input
            type="text"
            required
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            placeholder="Template Title"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {[
                'Business',
                'Education',
                'Academic Research',
                'Technology',
                'Marketing',
                'Medical and Health',
                'Church and Ministry',
                'Bible Study',
                'Training and Workshops',
                'Personal Portfolio',
                'Project Reports',
                'Conference Presentations',
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={tplTheme}
              onChange={(e) => setTplTheme(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {PRESENTATION_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={3}
            value={tplDesc}
            onChange={(e) => setTplDesc(e.target.value)}
            placeholder="Template description..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={tplPremium}
              onChange={(e) => setTplPremium(e.target.checked)}
            />
            <span>Premium template (Pro / Business / Founder only)</span>
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            Publish Template
          </button>
        </form>
      )}

      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Total AI Requests</div>
              <div className="text-lg font-bold tabular-nums mt-1">{m.aiStats?.totalRequests || 0}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Failed Requests</div>
              <div className="text-lg font-bold text-red-600 tabular-nums mt-1">
                {m.aiStats?.failedRequests || 0}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Input Tokens</div>
              <div className="text-lg font-bold tabular-nums mt-1">
                {(m.aiStats?.totalInputTokens || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Output Tokens</div>
              <div className="text-lg font-bold tabular-nums mt-1">
                {(m.aiStats?.totalOutputTokens || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Recent Failed AI Requests</h3>
            </div>
            {(data?.failedAIRequests || []).length === 0 ? (
              <div className="p-6 text-xs text-slate-500">No failed AI requests recorded.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(data?.failedAIRequests || []).map((f: any) => (
                  <div key={f.id} className="p-4 text-xs">
                    <div className="flex items-center justify-between font-medium text-slate-900">
                      <span>
                        {f.requestType} · {f.userEmail}
                      </span>
                      <span className="font-mono text-slate-400">{f.createdAt.slice(0, 19)}</span>
                    </div>
                    <div className="text-red-600 mt-1">{f.errorMessage}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && user.isFounder && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Founder Ownership Settings</h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Founder Daily Fair-Use Safeguard (AI Requests / Day)
              </label>
              <input
                type="number"
                min={10}
                max={10000}
                value={fairUseLimit}
                onChange={(e) => setFairUseLimit(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
              <p className="text-xs text-slate-500 mt-1">
                Technical abuse protection limit for your Founder Lifetime Premium account.
              </p>
            </div>
            <button
              onClick={handleSaveFairUse}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              Save Settings
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-700" />
                  <span>Google Play Store Publishing (Android TWA)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Package SlideCraft AI as an Android App Bundle (.aab) using Trusted Web Activity (PWABuilder or Bubblewrap) and verify ownership via Digital Asset Links.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunReadinessCheck}
                disabled={checkingReadiness}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
              >
                {checkingReadiness ? 'Checking...' : 'Check Readiness'}
              </button>
            </div>

            {readinessChecks && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 divide-y divide-slate-200">
                {readinessChecks.map((item) => (
                  <div key={item.label} className="px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="font-medium text-slate-900">{item.label}</div>
                      <div className="text-slate-500 mt-0.5">{item.detail}</div>
                    </div>
                    <span
                      className={`font-semibold shrink-0 ${
                        item.ok ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {item.ok ? 'Ready' : 'Action Needed'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-slate-800">Play Store Endpoint URLs</div>
              {window.location.hostname.startsWith('ais-dev-') && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
                  <strong>Important for PWABuilder:</strong> You are currently viewing the private <code className="font-mono">ais-dev-...</code> preview URL, which blocks external scanners like PWABuilder (causing “Missing Name / timed out”). First click <strong>Deploy / Share</strong> in AI Studio (or connect a custom domain) so your public URL is live, then paste that <strong>public URL</strong> into PWABuilder.
                </div>
              )}
              {[
                {
                  key: 'origin',
                  label: window.location.hostname.startsWith('ais-dev-')
                    ? 'Public Published App URL (Deploy/Share first, then use in PWABuilder)'
                    : 'App URL (for PWABuilder)',
                  val: window.location.hostname.startsWith('ais-dev-')
                    ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
                    : window.location.origin,
                },
                {
                  key: 'privacy',
                  label: 'Privacy Policy URL (Play Console)',
                  val: `${
                    window.location.hostname.startsWith('ais-dev-')
                      ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
                      : window.location.origin
                  }/privacy`,
                },
                {
                  key: 'assetlinks',
                  label: 'Digital Asset Links JSON',
                  val: `${
                    window.location.hostname.startsWith('ais-dev-')
                      ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
                      : window.location.origin
                  }/.well-known/assetlinks.json`,
                },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500">{row.label}</div>
                    <div className="font-mono text-slate-800 truncate">{row.val}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(row.key, row.val)}
                    className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0"
                  >
                    {copiedKey === row.key ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === row.key ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleSavePlayStoreConfig} className="space-y-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Android Package Name (Application ID)
                </label>
                <input
                  type="text"
                  value={playPackageName}
                  onChange={(e) => setPlayPackageName(e.target.value)}
                  placeholder="com.slidecraft.ai"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Play App Signing SHA-256 Fingerprint(s)
                </label>
                <textarea
                  rows={2}
                  value={playSha256}
                  onChange={(e) => setPlaySha256(e.target.value)}
                  placeholder="AA:BB:CC:... (paste from Google Play Console -> App Integrity -> App Signing)"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Saving updates <code className="font-mono">/.well-known/assetlinks.json</code> live so your Play Store app opens full-screen without the Chrome URL bar.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingPlayConfig}
                className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-xs font-semibold hover:bg-indigo-800 disabled:opacity-50"
              >
                {savingPlayConfig ? 'Saving...' : 'Save Asset Links Config'}
              </button>
            </form>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-slate-700 space-y-2">
              <div className="font-semibold text-indigo-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-700" />
                <span>Steps to Generate Your .aab & Publish</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                <li>Use your public production URL (never a dev preview URL) in PWABuilder (<span className="font-mono">pwabuilder.com</span>) or Bubblewrap CLI to build your signed Android <span className="font-mono">.aab</span> bundle.</li>
                <li>Create a Google Play Developer account at <span className="font-mono">play.google.com/console</span> ($25 one-time fee).</li>
                <li>Copy your App Signing SHA-256 fingerprint from Play Console &rarr; App Integrity and save it above.</li>
                <li>Enter your <span className="font-mono">/privacy</span> URL in Play Console Policy &amp; Store Listing, upload the <span className="font-mono">.aab</span>, and submit for review.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadAndroidStudioProject}
                  disabled={downloadingAndroid}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {downloadingAndroid
                      ? 'Packaging ZIP...'
                      : 'Download Android Studio Project (.zip)'}
                  </span>
                </button>
                <a
                  href="https://www.pwabuilder.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-700 font-semibold hover:underline"
                >
                  <span>Open PWABuilder</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
