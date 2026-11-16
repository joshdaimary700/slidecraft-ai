import React from 'react';
import { ArrowLeft, FileText, Lock, ShieldCheck } from 'lucide-react';

interface LegalPageProps {
  mode: 'privacy' | 'terms';
  onBack: () => void;
  onSwitch: (mode: 'privacy' | 'terms') => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ mode, onBack, onSwitch }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to SlideCraft AI</span>
          </button>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => onSwitch('privacy')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                mode === 'privacy'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onSwitch('terms')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                mode === 'terms'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Terms of Service
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {mode === 'privacy' ? (
          <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>SlideCraft AI · Privacy & Data Safety</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                Privacy Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: November 15, 2026 · Applicable to Web & Android App (SlideCraft AI)
              </p>
            </div>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">1. Information We Collect</h2>
              <p>
                SlideCraft AI collects only the information necessary to provide presentation creation, document conversion, and account synchronization:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>
                  <strong>Account Information:</strong> Name, email address, and authentication identifiers when you register with email/password or sign in with Google.
                </li>
                <li>
                  <strong>User Content:</strong> Presentation topics, slides, uploaded documents (PDF, DOCX, TXT, PPTX), and images you voluntarily upload to build your slide decks.
                </li>
                <li>
                  <strong>Billing Records:</strong> Subscription tier and transaction status processed securely via Razorpay. SlideCraft AI does not store raw card numbers or UPI PINs.
                </li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">2. How We Use Your Data</h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Generate, structure, and export your presentations in PowerPoint (.pptx) and PDF formats.</li>
                <li>Save your slide decks across sessions and devices so you can edit and download them anytime.</li>
                <li>Maintain account security, enforce plan quotas, and deliver requested customer support.</li>
              </ul>
            </section>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">3. Third-Party Services</h2>
              <p>
                We rely on trusted infrastructure providers solely to operate SlideCraft AI: Google Firebase Authentication (for optional Google Sign-In), Gemini AI APIs (to generate requested presentation content), and Razorpay (for paid plan checkout). All data transfers use HTTPS encryption in transit.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">4. Data Retention & Account Deletion</h2>
              <p>
                You can delete individual presentations directly inside your SlideCraft AI Dashboard at any time. To request permanent deletion of your account and all associated presentations or uploaded assets, email{' '}
                <a
                  href="mailto:joshdaimary700@gmail.com"
                  className="text-indigo-700 font-medium hover:underline"
                >
                  joshdaimary700@gmail.com
                </a>{' '}
                from your registered email address. Deletion requests are completed within 7 business days.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">5. Children’s Privacy</h2>
              <p>
                SlideCraft AI is designed for educators, students, researchers, ministries, and professionals. We do not knowingly collect personal data from children under 13 without verifiable parental or institutional consent.
              </p>
            </section>
          </article>
        ) : (
          <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>SlideCraft AI · Terms</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                Terms of Service
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: November 15, 2026
              </p>
            </div>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">1. Ownership of Your Presentations</h2>
              <p>
                You retain full ownership and rights to all presentation content, uploaded documents, images, and exported PowerPoint (.pptx) or PDF files created with your account.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">2. Acceptable Use</h2>
              <p>
                You agree not to use SlideCraft AI to generate unlawful, abusive, or infringing content, or attempt to bypass rate limits, authentication safeguards, or service quotas.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <h2 className="text-base font-semibold text-slate-900">3. Plans & Refunds</h2>
              <p>
                Free accounts include monthly presentation generation and PowerPoint export. Paid tiers expand monthly limits, slide counts, PDF export, and chart capabilities. For billing support, contact{' '}
                <a
                  href="mailto:joshdaimary700@gmail.com"
                  className="text-indigo-700 font-medium hover:underline"
                >
                  joshdaimary700@gmail.com
                </a>
                .
              </p>
            </section>

            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5" />
              <span>SlideCraft AI · Hosted securely over HTTPS</span>
            </div>
          </article>
        )}
      </main>
    </div>
  );
};
