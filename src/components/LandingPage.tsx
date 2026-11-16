import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  AuthUser,
  BillingCycle,
  CURATED_VISUALS,
  PlanCode,
  SlideData,
  SUBSCRIPTION_PLANS,
  TemplateRecord,
} from '../shared/types';
import { SlideRenderer } from './SlideRenderer';
import { PWAInstallControl } from './PWAInstallControl';

interface LandingPageProps {
  user: AuthUser | null;
  onCreatePresentation: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenDashboard: (tab?: 'overview' | 'templates' | 'billing') => void;
  onUseTemplate: (templateId: string) => void;
  onOpenLegal: (mode: 'privacy' | 'terms') => void;
}

const PREVIEW_DECK_SLIDES: SlideData[] = [
  {
    id: 'preview-1',
    presentationId: 'preview',
    slideOrder: 0,
    layout: 'full-image-title',
    title: 'Global Clean Energy Transition',
    subtitle: 'Solar capacity, grid modernization, and regional investment pathways',
    paragraphs: ['Prepared with SlideCraft AI · Executive Briefing'],
    bullets: [],
    imageUrl: CURATED_VISUALS[3].url,
    imageAlt: 'Aerial view of mountain forest and coastal wind turbines',
  },
  {
    id: 'preview-2',
    presentationId: 'preview',
    slideOrder: 1,
    layout: 'process-diagram',
    title: 'Four-Phase Implementation Roadmap',
    subtitle: 'Coordinating policy, transmission infrastructure, and storage',
    paragraphs: [],
    bullets: [],
    processSteps: [
      { stepNumber: 1, title: 'Grid Audit', description: 'Map regional transmission bottlenecks' },
      { stepNumber: 2, title: 'Solar Scale', description: 'Deploy utility & community microgrids' },
      { stepNumber: 3, title: 'Storage', description: 'Integrate multi-hour battery reserves' },
      { stepNumber: 4, title: 'Resilience', description: 'Automate demand-response balancing' },
    ],
  },
  {
    id: 'preview-3',
    presentationId: 'preview',
    slideOrder: 2,
    layout: 'chart-analysis',
    title: 'Projected Capacity Mix by Region',
    subtitle: 'Illustrative operational allocation across pilot zones',
    paragraphs: ['Balanced investment lowers peak load costs while expanding rural reliability.'],
    bullets: ['Modular microgrids reduce line losses', 'Local maintenance teams sustain uptime'],
    chartData: {
      type: 'bar',
      title: 'Pilot Capacity Allocation (MW)',
      seriesName: 'Capacity',
      data: [
        { label: 'North', value: 140 },
        { label: 'East', value: 210 },
        { label: 'South', value: 185 },
        { label: 'West', value: 260 },
      ],
    },
  },
];

const FAQS = [
  {
    q: 'Are exported PowerPoint (.pptx) files actually editable?',
    a: 'Yes. SlideCraft AI generates native .pptx files server-side using PptxGenJS. Every heading, bullet point, comparison box, image, speaker note, and chart remains fully editable inside Microsoft PowerPoint, Google Slides, and LibreOffice Impress.',
  },
  {
    q: 'Which document formats can I upload to generate slides?',
    a: 'You can upload PDF, DOCX, PPTX, and TXT documents up to 15 MB. Our backend extracts the actual text of your document and transforms it into structured slides without losing key points.',
  },
  {
    q: 'Does SlideCraft AI support regional Indian languages?',
    a: 'Yes. You can generate complete presentations—including slide headings, paragraphs, bullets, and speaker notes—in English, Hindi, Assamese, Bodo, and other languages.',
  },
  {
    q: 'How do monthly presentation credits work?',
    a: 'Each successfully generated presentation uses 1 credit from your monthly quota. Editing, rearranging, improving individual slides, or exporting existing presentations never consumes presentation credits, and failed generations never deduct credits.',
  },
  {
    q: 'How are paid subscriptions billed and verified?',
    a: 'Monthly and annual INR subscriptions (Starter ₹50, Pro ₹120, Business ₹250) are processed via Razorpay with cryptographic signature verification on our backend before activating your plan.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  user,
  onCreatePresentation,
  onOpenAuth,
  onOpenDashboard,
  onUseTemplate,
  onOpenLegal,
}) => {
  const [previewIdx, setPreviewIdx] = useState(0);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    apiFetch<{ templates: TemplateRecord[] }>('/api/templates')
      .then((res) => setTemplates(res.templates || []))
      .catch(() => {});
  }, []);

  const categories = ['All', ...Array.from(new Set(templates.map((t) => t.category))).slice(0, 6)];
  const visibleTemplates =
    selectedCategory === 'All'
      ? templates.slice(0, 6)
      : templates.filter((t) => t.category === selectedCategory).slice(0, 6);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Bar Contract: 3 exact zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SlideCraft AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#templates" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Templates
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
            {user ? (
              <button
                onClick={() => onOpenDashboard('overview')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Sign in
              </button>
            )}
          </nav>

          <div className="shrink-0">
            <button
              onClick={onCreatePresentation}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Create Presentation
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="pt-14 pb-20 border-b border-slate-200 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div className="text-xs font-medium text-indigo-700">
              SlideCraft AI · Turn Your Ideas Into Beautiful Presentations
            </div>
            <h1
              className="font-display font-bold text-slate-900 tracking-tight leading-[1.08]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
            >
              Create Stunning Presentations with AI
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Transform your ideas, documents, and topics into professional PowerPoint presentations in minutes.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={onCreatePresentation}
                className="px-5 py-3 rounded-xl bg-indigo-700 text-white text-sm font-semibold hover:bg-indigo-800 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <span>Create Presentation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#templates"
                className="px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Explore Templates
              </a>
              <PWAInstallControl variant="button" />
            </div>
            <div className="pt-3 text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>Editable .pptx &amp; PDF export</span>
              <span aria-hidden="true">·</span>
              <span>PDF, DOCX, PPTX upload</span>
              <span aria-hidden="true">·</span>
              <span>English, Hindi, Assamese &amp; Bodo</span>
            </div>
          </div>

          {/* Interactive Slide Deck Previewer */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="text-xs font-medium text-slate-600">
                  Interactive Output Preview · Slide {previewIdx + 1} of {PREVIEW_DECK_SLIDES.length}
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                  {PREVIEW_DECK_SLIDES.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => setPreviewIdx(idx)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        previewIdx === idx
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Slide {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
              <SlideRenderer
                slide={PREVIEW_DECK_SLIDES[previewIdx]}
                themeId="navy-indigo"
                aspectRatio="16:9"
                slideIndex={previewIdx}
                totalSlides={PREVIEW_DECK_SLIDES.length}
                deckTitle="Global Clean Energy Transition"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              From raw notes to an executive deck in three steps
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Skip manual slide formatting and focus on clarity, storytelling, and accuracy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: '01. Choose Your Input',
                desc: 'Enter a topic, paste lecture notes, write an outline, or upload a PDF, DOCX, PPTX, or TXT file.',
              },
              {
                num: '02. AI Structures Layouts & Visuals',
                desc: 'SlideCraft AI selects varied layouts—comparisons, timelines, process diagrams, charts, and speaker notes.',
              },
              {
                num: '03. Refine & Export Real Files',
                desc: 'Edit directly on the canvas, run "Improve This Slide", and download editable PowerPoint (.pptx) or PDF files.',
              },
            ].map((step) => (
              <div key={step.num} className="p-6 rounded-xl border border-slate-200 bg-slate-50/50">
                <h3 className="text-base font-semibold text-slate-900">{step.num}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Asymmetric Bento Grid */}
      <section id="features" className="py-20 border-b border-slate-200 bg-slate-50/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Built for educators, researchers, ministries, and business teams
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Every presentation combines structured writing, purposeful layouts, and real file portability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-7 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold mb-2">
                  <FileText className="w-4 h-4" />
                  <span>Four Generation Modes</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Topic, pasted text, document upload, or outline
                </h3>
                <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">
                  Upload a 30-page PDF report or DOCX syllabus and convert its actual content into organized, scannable slides tailored to your audience, tone, and language.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {['PDF Extraction', 'DOCX & TXT', 'PPTX Import', 'Custom Outlines'].map((item) => (
                  <div
                    key={item}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-800"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold mb-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>True File Portability</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Editable .pptx &amp; PDF exports
                </h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Download authentic PowerPoint files with embedded images, native editable charts, shapes, and speaker notes preserved.
                </p>
              </div>
              <div className="pt-5 text-xs text-slate-500">
                16:9 widescreen · 4:3 standard
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-7">
              <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold mb-2">
                <Layers className="w-4 h-4" />
                <span>11 Intelligent Layouts</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">No repetitive walls of bullets</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Automatically alternates between timelines, process diagrams, comparison tables, statistics, quotes, and charts.
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-2 max-w-lg">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Slide Assistant</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Improve any slide with one click
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Rewrite explanations, simplify dense concepts, fix grammar, adjust tone, generate speaker notes, or redesign a slide layout inside the live editor.
                </p>
              </div>
              <button
                onClick={onCreatePresentation}
                className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Try the Studio
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Template Gallery */}
      <section id="templates" className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Presentation Template Gallery
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                12 domain-ready template categories across business, education, research, and ministry.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                    <img
                      src={tpl.previewImageUrl}
                      alt={tpl.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <div className="text-xs text-slate-500 mb-1 tabular-nums">
                      {tpl.category} · {tpl.slideCount} slides · {tpl.isPremium ? 'Premium' : 'Free'}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{tpl.name}</h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={() => onUseTemplate(tpl.id)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 border-b border-slate-200 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Simple, transparent INR pricing
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Start free and scale monthly presentation capacity as your team grows.
              </p>
            </div>
            <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg self-start">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {(['FREE', 'STARTER', 'PRO', 'BUSINESS'] as PlanCode[]).map((code) => {
              const plan = SUBSCRIPTION_PLANS[code];
              const price = billingCycle === 'ANNUAL' ? plan.annualPriceInr : plan.monthlyPriceInr;
              return (
                <div
                  key={code}
                  className={`bg-white rounded-xl p-6 border flex flex-col justify-between ${
                    code === 'PRO' ? 'border-indigo-600 ring-1 ring-indigo-600/20' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="text-xs text-slate-500">{plan.audienceLabel}</div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900 tabular-nums">
                        ₹{price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-500">
                        /{billingCycle === 'ANNUAL' ? 'year' : 'month'}
                      </span>
                    </div>
                    <ul className="mt-5 space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                      {plan.features.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() =>
                      user ? onOpenDashboard('billing') : onOpenAuth('register')
                    }
                    className={`mt-6 w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                      code === 'PRO'
                        ? 'bg-indigo-700 text-white hover:bg-indigo-800'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {code === 'FREE' ? 'Start Free' : `Get ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Trusted across classrooms, ministries, and research teams
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  'Uploading my 24-page environmental policy PDF produced a clean 15-slide lecture deck in Assamese and English in under two minutes, saving four hours of manual formatting.',
                author: 'Dr. Ananya Kalita',
                role: 'Associate Professor of Environmental Studies, Guwahati University',
              },
              {
                quote:
                  'Our pastoral team prepares weekly Bible study slides and annual ministry reports using the Warm Sanctuary theme and editable PowerPoint export.',
                author: 'Rev. Thomas Narzary',
                role: 'Senior Pastor, Kokrajhar Community Fellowship',
              },
              {
                quote:
                  'The comparison layouts and native editable charts let our analysts fine-tune numbers directly in PowerPoint without rebuilding slides from scratch.',
                author: 'Rohan Deshmukh',
                role: 'Strategy Lead, Meridien Advisory Group',
              },
            ].map((item) => (
              <div key={item.author} className="p-6 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col justify-between">
                <p className="text-sm text-slate-700 leading-relaxed">“{item.quote}”</p>
                <div className="mt-5 pt-4 border-t border-slate-200/70">
                  <div className="text-sm font-semibold text-slate-900">{item.author}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 border-b border-slate-200 bg-slate-50/40">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-slate-900"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs text-slate-500">
          <div>
            <div className="font-display font-bold text-slate-900 text-sm">SlideCraft AI</div>
            <div className="mt-1">Turn Your Ideas Into Beautiful Presentations.</div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#templates" className="hover:text-slate-900">Templates</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onOpenLegal('privacy');
              }}
              className="hover:text-slate-900"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onOpenLegal('terms');
              }}
              className="hover:text-slate-900"
            >
              Terms
            </a>
            <button onClick={onCreatePresentation} className="text-indigo-700 font-medium hover:underline">
              Get Started
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
