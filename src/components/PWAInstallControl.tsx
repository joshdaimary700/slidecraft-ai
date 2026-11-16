import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallControlProps {
  variant?: 'button' | 'sidebar' | 'card';
}

export const PWAInstallControl: React.FC<PWAInstallControlProps> = ({ variant = 'button' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!appUrl) return;
    if (!showGuide && variant !== 'card') return;
    QRCode.toDataURL(appUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [appUrl, showGuide, variant]);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = () => {
    if (!appUrl || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(appUrl)
      .then(() => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      })
      .catch(() => {});
  };

  if (isInstalled && variant !== 'card') {
    return null;
  }

  return (
    <>
      {variant === 'card' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Install SlideCraft on Your Phone</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isInstalled
                  ? 'SlideCraft AI is installed as an app on this device.'
                  : 'No Play Store or App Store needed. Scan the QR code with your phone camera to add SlideCraft to your home screen.'}
              </p>
            </div>
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 self-start"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isInstallable ? 'Install App Now' : 'Open Phone Setup Guide'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-3 border-t border-slate-100">
            {qrDataUrl && (
              <div className="p-2.5 rounded-xl border border-slate-200 bg-white shrink-0 text-center">
                <img
                  src={qrDataUrl}
                  alt="Scan to open SlideCraft AI on your phone"
                  className="w-28 h-28"
                />
                <div className="text-[10px] font-medium text-slate-500 mt-1">Scan with phone camera</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 flex-1">
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-900">On Android Phone</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open the link in <strong>Chrome</strong> (or scan the QR code).</li>
                  <li>Tap the <strong>3 dots (⋮)</strong> at the top-right corner of Chrome.</li>
                  <li>Tap <strong>Install and create shortcut</strong> (or <strong>Add to Home screen</strong> / <strong>Install app</strong>), then tap <strong>Install</strong>.</li>
                </ol>
              </div>
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-900">On iPhone / iPad</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open the link in <strong>Safari</strong> (or scan the QR code).</li>
                  <li>Tap the <strong>Share</strong> icon (square with an arrow pointing up) at the bottom.</li>
                  <li>Scroll down, tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      ) : variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>{isInstallable ? 'Install App' : 'Install on Phone'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4 text-indigo-700" />
          <span>{isInstallable ? 'Install App' : 'Install on Phone'}</span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Put SlideCraft on Your Phone</h3>
                <p className="text-xs text-slate-500 mt-1">
                  No Play Store or App Store download needed. Save SlideCraft straight to your phone&apos;s home screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {appUrl && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                {qrDataUrl && (
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0">
                    <img
                      src={qrDataUrl}
                      alt="Scan QR code with your phone camera"
                      className="w-28 h-28"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2 w-full">
                  <div className="text-xs font-semibold text-slate-900">
                    Step 1: Open SlideCraft on your phone
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Point your phone&apos;s camera at this QR code to open SlideCraft, or copy the link and send it to yourself (e.g., on WhatsApp).
                  </p>
                  <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <code className="text-[11px] font-mono text-slate-700 truncate">{appUrl}</code>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800 flex items-center gap-1 shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              {(!isIOS || isAndroid) && (
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-900">Step 2 (Android Phone · Chrome)</div>
                  <p>1. Open the link in <strong>Google Chrome</strong> on your phone.</p>
                  <p>2. Tap the <strong>3 dots (⋮)</strong> in the top-right corner of Chrome.</p>
                  <p>3. Tap <strong>Install and create shortcut</strong> (or <strong>Add to Home screen</strong> / <strong>Install app</strong>), then tap <strong>Install</strong>.</p>
                </div>
              )}

              {(!isAndroid || isIOS) && (
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-900">Step 2 (iPhone / iPad · Safari)</div>
                  <p>1. Open the link in <strong>Safari</strong> on your iPhone.</p>
                  <p>2. Tap the <strong>Share</strong> button (the square with an arrow pointing up) at the bottom.</p>
                  <p>3. Scroll down, tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setShowGuide(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-xs font-semibold hover:bg-indigo-800"
                >
                  Install on This Device Now
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-lg border border-slate-700">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Offline Mode — Viewing cached interface</span>
    </div>
  );
};
