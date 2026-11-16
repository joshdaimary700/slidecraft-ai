import React, { useState } from 'react';
import { X, ArrowRight, Lock, Mail, User, KeyRound } from 'lucide-react';
import { apiFetch, setStoredToken } from '../lib/api';
import { signInWithGooglePopup } from '../lib/firebaseClient';
import { AuthUser } from '../shared/types';

interface AuthModalProps {
  initialMode?: 'login' | 'register' | 'reset';
  googleClientId?: string;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  googleClientId,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [devCodeHint, setDevCodeHint] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setStoredToken(res.token);
        onSuccess(res.user);
      } else if (mode === 'register') {
        const res = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
        setStoredToken(res.token);
        onSuccess(res.user);
      } else if (mode === 'reset') {
        if (!resetRequested) {
          const res = await apiFetch<{ message: string; devResetCode?: string }>(
            '/api/auth/forgot-password',
            {
              method: 'POST',
              body: JSON.stringify({ email }),
            }
          );
          setResetRequested(true);
          setInfo(res.message);
          if (res.devResetCode) setDevCodeHint(res.devResetCode);
        } else {
          const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, code: resetCode, newPassword: password }),
          });
          setInfo(res.message);
          setMode('login');
          setResetRequested(false);
          setPassword('');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication request failed.');
    } finally {
      setLoading(false);
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGooglePopup();
      const res = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      setStoredToken(res.token);
      onSuccess(res.user);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Google sign-in window was closed before completing.');
      } else if (code === 'auth/popup-blocked') {
        setError('Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.');
      } else {
        setError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-7 shadow-xl relative">
        <button
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <div className="text-xs font-medium text-indigo-700 mb-1">SlideCraft AI</div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'login'
              ? 'Sign in to your workspace'
              : mode === 'register'
                ? 'Create your SlideCraft account'
                : 'Reset your password'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {mode === 'login'
              ? 'Access your saved presentations, templates, and AI studio.'
              : mode === 'register'
                ? 'Start with 3 free AI presentations every month.'
                : 'Enter your email to generate a 6-digit verification code.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
            {info}
            {devCodeHint && (
              <div className="mt-1.5 font-mono font-semibold text-emerald-950">
                Verification code: {devCodeHint}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Full name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {mode === 'reset' && resetRequested && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">6-digit reset code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="123456"
                  className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>
            </div>
          )}

          {(mode !== 'reset' || resetRequested) && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {mode === 'reset' ? 'New password' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <span>
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                    ? 'Create Free Account'
                    : resetRequested
                      ? 'Update Password'
                      : 'Send Reset Code'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {mode !== 'reset' && (
          <div className="mt-4">
            <button
              type="button"
              disabled={googleLoading || loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
            </button>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setInfo('');
                }}
                className="text-indigo-700 font-medium hover:underline"
              >
                Create an account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setInfo('');
                }}
                className="text-slate-500 hover:text-slate-900"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setResetRequested(false);
                setError('');
                setInfo('');
              }}
              className="text-indigo-700 font-medium hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
