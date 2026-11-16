import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Plus,
  Redo2,
  Save,
  Share2,
  Shapes,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, downloadPresentationFile } from '../lib/api';
import {
  AspectRatio,
  AuthUser,
  CURATED_VISUALS,
  PRESENTATION_THEMES,
  PresentationRecord,
  SlideData,
  SlideLayout,
} from '../shared/types';
import { SlideRenderer } from './SlideRenderer';

interface SlideEditorProps {
  presentationId: string;
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
  onBack: () => void;
  onRequestUpgrade: () => void;
}

const LAYOUT_OPTIONS: Array<{ id: SlideLayout; label: string }> = [
  { id: 'full-image-title', label: 'Full-Width Image & Title' },
  { id: 'image-left', label: 'Image Left, Text Right' },
  { id: 'image-right', label: 'Text Left, Image Right' },
  { id: 'two-column-comparison', label: 'Two-Column Comparison' },
  { id: 'three-column-cards', label: 'Three-Column Feature Cards' },
  { id: 'stat-highlight', label: 'Large Statistic Highlight' },
  { id: 'timeline', label: 'Timeline Sequence' },
  { id: 'process-diagram', label: 'Process Diagram' },
  { id: 'quote-image', label: 'Quote & Image' },
  { id: 'chart-analysis', label: 'Chart & Analysis' },
  { id: 'closing-summary', label: 'Closing Summary' },
];

export const SlideEditor: React.FC<SlideEditorProps> = ({
  presentationId,
  user,
  onUserUpdated,
  onBack,
  onRequestUpgrade,
}) => {
  const [presentation, setPresentation] = useState<PresentationRecord | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [history, setHistory] = useState<SlideData[][]>([]);
  const [future, setFuture] = useState<SlideData[][]>([]);

  const [rightTab, setRightTab] = useState<'design' | 'visuals' | 'ai'>('ai');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [previewMode, setPreviewMode] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [targetTone, setTargetTone] = useState('Executive & Persuasive');
  const [newSlidePrompt, setNewSlidePrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; altText: string }>>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [presRes, imgRes] = await Promise.all([
          apiFetch<{ presentation: PresentationRecord }>(`/api/presentations/${presentationId}`),
          apiFetch<{ uploaded: Array<{ id: string; url: string; altText: string }> }>('/api/images'),
        ]);
        if (!mounted) return;
        setPresentation(presRes.presentation);
        setSlides(presRes.presentation.slides || []);
        setUploadedImages(imgRes.uploaded || []);
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Failed to load presentation.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [presentationId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const commitSlides = (nextSlides: SlideData[], recordHistory = true) => {
    if (recordHistory) {
      setHistory((prev) => [...prev.slice(-25), slides]);
      setFuture([]);
    }
    const reindexed = nextSlides.map((s, i) => ({ ...s, slideOrder: i }));
    setSlides(reindexed);
    setSaveState('dirty');

    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      persistSlides(reindexed);
    }, 900);
  };

  const persistSlides = async (slidesToSave = slides) => {
    setSaveState('saving');
    try {
      await apiFetch(`/api/presentations/${presentationId}/slides`, {
        method: 'PUT',
        body: JSON.stringify({ slides: slidesToSave }),
      });
      setSaveState('saved');
    } catch {
      setSaveState('dirty');
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [slides, ...f]);
    setSlides(prev);
    setSaveState('dirty');
    persistSlides(prev);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, slides]);
    setSlides(next);
    setSaveState('dirty');
    persistSlides(next);
  };

  const activeSlide = slides[activeIdx];

  const updateActiveSlide = (patch: Partial<SlideData>) => {
    if (!activeSlide) return;
    const next = slides.map((s, idx) => (idx === activeIdx ? { ...s, ...patch } : s));
    commitSlides(next);
  };

  const updateMeta = async (patch: {
    title?: string;
    themeId?: string;
    aspectRatio?: AspectRatio;
    toggleShare?: boolean;
  }) => {
    if (!presentation) return;
    try {
      const res = await apiFetch<{ presentation: PresentationRecord }>(
        `/api/presentations/${presentation.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }
      );
      setPresentation((prev) => (prev ? { ...prev, ...res.presentation } : prev));
      if (patch.toggleShare === true && res.presentation.shareSlug) {
        const shareUrl = `${window.location.origin}/?share=${res.presentation.shareSlug}`;
        navigator.clipboard?.writeText(shareUrl).catch(() => {});
        showToast('Public share link copied to clipboard.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update presentation settings.');
    }
  };

  const addSlide = () => {
    if (!presentation) return;
    const newSlide: SlideData = {
      id: `slide_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      presentationId: presentation.id,
      slideOrder: slides.length,
      layout: 'image-right',
      title: 'New Section Title',
      subtitle: 'Add a supporting subtitle',
      paragraphs: ['Summarize the core idea of this slide in one or two clear sentences.'],
      bullets: ['Key supporting point one', 'Key supporting point two'],
      imageUrl: CURATED_VISUALS[slides.length % CURATED_VISUALS.length].url,
      imageAlt: CURATED_VISUALS[slides.length % CURATED_VISUALS.length].label,
      imagePosition: { x: 0, y: 0, scale: 1 },
      speakerNotes: '',
      shapes: [],
    };
    const next = [...slides];
    next.splice(activeIdx + 1, 0, newSlide);
    commitSlides(next);
    setActiveIdx(activeIdx + 1);
  };

  const duplicateSlide = (idx: number) => {
    const src = slides[idx];
    if (!src) return;
    const copy: SlideData = {
      ...src,
      id: `slide_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${src.title} (Copy)`,
    };
    const next = [...slides];
    next.splice(idx + 1, 0, copy);
    commitSlides(next);
    setActiveIdx(idx + 1);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx);
    commitSlides(next);
    setActiveIdx(Math.max(0, Math.min(idx, next.length - 1)));
  };

  const handleDropReorder = (targetIdx: number) => {
    if (dragIndex === null || dragIndex === targetIdx) {
      setDragIndex(null);
      return;
    }
    const next = [...slides];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIdx, 0, moved);
    setDragIndex(null);
    commitSlides(next);
    setActiveIdx(targetIdx);
  };

  const handleUploadSlideImage = async (file: File) => {
    if (!activeSlide || !presentation) return;
    const form = new FormData();
    form.append('image', file);
    form.append('presentationId', presentation.id);
    form.append('slideId', activeSlide.id);
    form.append('altText', file.name);
    try {
      const res = await apiFetch<{ id: string; url: string; altText: string }>(
        '/api/images/upload',
        { method: 'POST', body: form }
      );
      setUploadedImages((prev) => [res, ...prev]);
      updateActiveSlide({ imageUrl: res.url, imageAlt: res.altText });
      showToast('Image uploaded and applied to slide.');
    } catch (err: any) {
      setError(err?.message || 'Image upload failed.');
    }
  };

  const runSlideAssist = async (action: string) => {
    if (!activeSlide || !presentation) return;
    setError('');
    setAiLoading(action);
    try {
      const res = await apiFetch<{ patch: Partial<SlideData>; user: AuthUser }>(
        '/api/ai/slide-assist',
        {
          method: 'POST',
          body: JSON.stringify({
            presentationId: presentation.id,
            slide: activeSlide,
            action,
            targetTone,
            language: presentation.language,
          }),
        }
      );
      updateActiveSlide(res.patch);
      onUserUpdated(res.user);
      showToast('Slide updated with AI.');
    } catch (err: any) {
      setError(err?.message || 'AI assist request failed.');
    } finally {
      setAiLoading(null);
    }
  };

  const runDeckAssist = async (mode: 'new-slide' | 'summarize' | 'conclusion') => {
    if (!presentation) return;
    setError('');
    setAiLoading(mode);
    try {
      const res = await apiFetch<{ slide: SlideData; user: AuthUser }>('/api/ai/deck-assist', {
        method: 'POST',
        body: JSON.stringify({
          presentationId: presentation.id,
          mode,
          deckTitle: presentation.title,
          language: presentation.language,
          prompt: newSlidePrompt,
          existingTitles: slides.map((s) => s.title),
        }),
      });
      const next = [...slides, { ...res.slide, slideOrder: slides.length }];
      commitSlides(next);
      setActiveIdx(next.length - 1);
      onUserUpdated(res.user);
      setNewSlidePrompt('');
      showToast('New AI slide added to deck.');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate slide.');
    } finally {
      setAiLoading(null);
    }
  };

  const handleExport = async (format: 'pptx' | 'pdf' | 'txt') => {
    if (!presentation) return;
    setExportMenuOpen(false);
    setExportingFormat(format);
    setError('');
    try {
      await persistSlides();
      await downloadPresentationFile(presentation.id, format, presentation.title);
      showToast(`Exported ${format.toUpperCase()} file.`);
    } catch (err: any) {
      setError(err?.message || 'Export failed.');
    } finally {
      setExportingFormat(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-700" />
          <span>Loading presentation workspace...</span>
        </div>
      </div>
    );
  }

  if (!presentation || !activeSlide) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-sm text-red-600 mb-4">{error || 'Presentation not found.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Toolbar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              persistSlides();
              onBack();
            }}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={presentation.title}
            onChange={(e) => setPresentation({ ...presentation, title: e.target.value })}
            onBlur={(e) => updateMeta({ title: e.target.value })}
            className="text-sm font-semibold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none rounded-md px-2 py-1 min-w-[160px] max-w-xs truncate"
          />
          <span className="hidden sm:inline text-xs text-slate-400 whitespace-nowrap">
            {saveState === 'saving'
              ? 'Saving...'
              : saveState === 'dirty'
                ? 'Unsaved edits'
                : 'Saved'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={future.length === 0}
            title="Redo"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => persistSlides()}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          <button
            onClick={() => setPreviewMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>

          <button
            onClick={() => updateMeta({ toggleShare: !presentation.shareSlug })}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap ${
              presentation.shareSlug
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{presentation.shareSlug ? 'Shared' : 'Share'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={Boolean(exportingFormat)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
            >
              {exportingFormat ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export</span>
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-40">
                <button
                  onClick={() => handleExport('pptx')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-100 flex items-center justify-between"
                >
                  <span>PowerPoint (.pptx)</span>
                  <span className="text-[11px] text-slate-400">Editable</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-100 flex items-center justify-between"
                >
                  <span>PDF Document (.pdf)</span>
                  <span className="text-[11px] text-slate-400">Print-ready</span>
                </button>
                <button
                  onClick={() => handleExport('txt')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-100 flex items-center justify-between"
                >
                  <span>Outline (.txt)</span>
                  <span className="text-[11px] text-slate-400">Plain text</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {(error || toast) && (
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          {error ? (
            <div className="flex items-center gap-3 text-red-700">
              <span>{error}</span>
              {error.toLowerCase().includes('upgrade') || error.toLowerCase().includes('requires') ? (
                <button
                  onClick={onRequestUpgrade}
                  className="underline font-semibold text-indigo-700"
                >
                  Upgrade Plan
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>{toast}</span>
            </div>
          )}
          <button onClick={() => { setError(''); setToast(''); }} className="text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3-Pane Editor Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT SIDEBAR: Thumbnails */}
        <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 tabular-nums">
              Slides ({slides.length})
            </span>
            <button
              onClick={addSlide}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {slides.map((s, idx) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropReorder(idx)}
                onClick={() => setActiveIdx(idx)}
                className={`group relative rounded-lg p-1.5 border cursor-pointer transition-colors ${
                  idx === activeIdx
                    ? 'border-indigo-600 bg-indigo-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 px-0.5 tabular-nums">
                  <span className="font-semibold">
                    {idx + 1}. {s.layout}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Duplicate slide"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateSlide(idx);
                      }}
                      className="p-0.5 hover:text-indigo-700"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {slides.length > 1 && (
                      <button
                        type="button"
                        title="Delete slide"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSlide(idx);
                        }}
                        className="p-0.5 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="pointer-events-none">
                  <SlideRenderer
                    slide={s}
                    themeId={presentation.themeId}
                    aspectRatio={presentation.aspectRatio}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN CANVAS + SPEAKER NOTES */}
        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto p-5 md:p-8">
          <div className="max-w-4xl w-full mx-auto space-y-5">
            <div className="shadow-sm rounded-xl">
              <SlideRenderer
                slide={activeSlide}
                themeId={presentation.themeId}
                aspectRatio={presentation.aspectRatio}
                editable
                slideIndex={activeIdx}
                totalSlides={slides.length}
                deckTitle={presentation.title}
                onUpdate={updateActiveSlide}
              />
            </div>

            {/* Structured Content Quick-Editor & Speaker Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Bullet Points & Paragraphs</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveSlide({
                          bullets: [...activeSlide.bullets, 'New bullet point'],
                        })
                      }
                      className="text-[11px] font-medium text-indigo-700 hover:underline"
                    >
                      + Add Bullet
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveSlide({
                          paragraphs: [...activeSlide.paragraphs, 'New paragraph text'],
                        })
                      }
                      className="text-[11px] font-medium text-slate-600 hover:underline"
                    >
                      + Add Paragraph
                    </button>
                  </div>
                </div>

                {activeSlide.bullets.length === 0 && activeSlide.paragraphs.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Click any text directly on the slide canvas to edit, or add bullets above.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {activeSlide.bullets.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={b}
                          onChange={(e) => {
                            const next = [...activeSlide.bullets];
                            next[bIdx] = e.target.value;
                            updateActiveSlide({ bullets: next });
                          }}
                          className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveSlide({
                              bullets: activeSlide.bullets.filter((_, i) => i !== bIdx),
                            })
                          }
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800">Speaker Notes</span>
                  <button
                    type="button"
                    disabled={Boolean(aiLoading)}
                    onClick={() => runSlideAssist('speaker-notes')}
                    className="text-[11px] font-medium text-indigo-700 hover:underline disabled:opacity-50"
                  >
                    {aiLoading === 'speaker-notes' ? 'Generating...' : 'AI Write Notes'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={activeSlide.speakerNotes || ''}
                  onChange={(e) => updateActiveSlide({ speakerNotes: e.target.value })}
                  placeholder="Presenter talking points (included automatically in PowerPoint .pptx export notes)..."
                  className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR: Design, Visuals, AI Assistant */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0">
          <div className="p-2 border-b border-slate-200 grid grid-cols-3 gap-1 bg-slate-50">
            {[
              { id: 'ai', label: 'AI Studio', icon: Sparkles },
              { id: 'design', label: 'Design', icon: Layers },
              { id: 'visuals', label: 'Visuals', icon: ImageIcon },
            ].map((t) => {
              const Icon = t.icon;
              const active = rightTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setRightTab(t.id as any)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                    active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {rightTab === 'ai' && (
              <>
                <div>
                  <button
                    type="button"
                    disabled={Boolean(aiLoading)}
                    onClick={() => runSlideAssist('improve')}
                    className="w-full py-2.5 px-4 rounded-lg bg-indigo-700 text-white text-xs font-semibold hover:bg-indigo-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  >
                    {aiLoading === 'improve' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>Improve This Slide</span>
                  </button>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Refines structure, layout fit, and clarity automatically.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="text-xs font-semibold text-slate-800 mb-2">
                    Slide Writing Actions
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'rewrite', label: 'Rewrite Content' },
                      { id: 'grammar', label: 'Fix Grammar' },
                      { id: 'simplify', label: 'Simplify Text' },
                      { id: 'expand', label: 'Expand Detail' },
                      { id: 'shorten', label: 'Shorten Text' },
                      { id: 'more-bullets', label: '+ More Bullets' },
                      { id: 'redesign', label: 'Redesign Layout' },
                      { id: 'suggest-image', label: 'Suggest Image' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        disabled={Boolean(aiLoading)}
                        onClick={() => runSlideAssist(btn.id)}
                        className="px-2.5 py-2 rounded-lg border border-slate-200 text-left text-xs font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {aiLoading === btn.id ? 'Working...' : btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Change Slide Tone
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={targetTone}
                      onChange={(e) => setTargetTone(e.target.value)}
                      className="flex-1 text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {[
                        'Executive & Persuasive',
                        'Academic & Formal',
                        'Simple & Clear',
                        'Pastoral & Inspiring',
                        'Creative Storytelling',
                      ].map((tone) => (
                        <option key={tone} value={tone}>
                          {tone}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={Boolean(aiLoading)}
                      onClick={() => runSlideAssist('tone')}
                      className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-800">Deck-Level AI Actions</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSlidePrompt}
                      onChange={(e) => setNewSlidePrompt(e.target.value)}
                      placeholder="Topic for new AI slide..."
                      className="flex-1 text-xs px-2.5 py-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={Boolean(aiLoading)}
                      onClick={() => runDeckAssist('new-slide')}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                    >
                      {aiLoading === 'new-slide' ? '...' : 'Add AI Slide'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={Boolean(aiLoading)}
                      onClick={() => runDeckAssist('summarize')}
                      className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {aiLoading === 'summarize' ? 'Working...' : 'Summarize Deck'}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(aiLoading)}
                      onClick={() => runDeckAssist('conclusion')}
                      className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {aiLoading === 'conclusion' ? 'Working...' : 'Add Conclusion'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {rightTab === 'design' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-2">
                    Slide Layout
                  </label>
                  <select
                    value={activeSlide.layout}
                    onChange={(e) => updateActiveSlide({ layout: e.target.value as SlideLayout })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {LAYOUT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-2">
                    Presentation Color Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESENTATION_THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateMeta({ themeId: t.id })}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs ${
                          presentation.themeId === t.id
                            ? 'border-indigo-600 bg-indigo-50/40 font-semibold'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded border shrink-0"
                          style={{ backgroundColor: t.canvasBg, borderColor: t.accentColor, borderWidth: 2 }}
                        />
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-2">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['16:9', '4:3'] as AspectRatio[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => updateMeta({ aspectRatio: r })}
                        className={`py-2 text-xs font-medium rounded-lg border ${
                          presentation.aspectRatio === r
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-800">Typography & Colors</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Heading Font</label>
                      <select
                        value={activeSlide.titleFont || 'Plus Jakarta Sans'}
                        onChange={(e) => updateActiveSlide({ titleFont: e.target.value })}
                        className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                      >
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                        <option value="DM Sans">DM Sans</option>
                        <option value="Georgia">Georgia Serif</option>
                        <option value="Arial">Arial</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Body Font</label>
                      <select
                        value={activeSlide.bodyFont || 'DM Sans'}
                        onChange={(e) => updateActiveSlide({ bodyFont: e.target.value })}
                        className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                      >
                        <option value="DM Sans">DM Sans</option>
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                        <option value="Georgia">Georgia Serif</option>
                        <option value="Arial">Arial</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Title Size ({activeSlide.titleSize || 28}px)
                      </label>
                      <input
                        type="range"
                        min={20}
                        max={42}
                        value={activeSlide.titleSize || 28}
                        onChange={(e) => updateActiveSlide({ titleSize: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Body Size ({activeSlide.bodySize || 15}px)
                      </label>
                      <input
                        type="range"
                        min={12}
                        max={22}
                        value={activeSlide.bodySize || 15}
                        onChange={(e) => updateActiveSlide({ bodySize: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Slide BG</label>
                      <input
                        type="color"
                        value={activeSlide.backgroundColor || '#FFFFFF'}
                        onChange={(e) => updateActiveSlide({ backgroundColor: e.target.value })}
                        className="w-full h-8 rounded border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Title Color</label>
                      <input
                        type="color"
                        value={activeSlide.titleColor || '#0F172A'}
                        onChange={(e) => updateActiveSlide({ titleColor: e.target.value })}
                        className="w-full h-8 rounded border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Body Color</label>
                      <input
                        type="color"
                        value={activeSlide.bodyColor || '#334155'}
                        onChange={(e) => updateActiveSlide({ bodyColor: e.target.value })}
                        className="w-full h-8 rounded border border-slate-200 cursor-pointer"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveSlide({
                        backgroundColor: '',
                        titleColor: '',
                        bodyColor: '',
                      })
                    }
                    className="text-[11px] text-slate-500 hover:text-slate-900 underline"
                  >
                    Reset colors to theme defaults
                  </button>
                </div>
              </>
            )}

            {rightTab === 'visuals' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-800">Slide Image</span>
                    <input
                      ref={imageUploadRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadSlideImage(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => imageUploadRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[...uploadedImages.map((u) => ({ url: u.url, label: u.altText })), ...CURATED_VISUALS].map(
                      (img, idx) => (
                        <button
                          key={`${img.url}-${idx}`}
                          type="button"
                          onClick={() => updateActiveSlide({ imageUrl: img.url, imageAlt: img.label })}
                          className={`rounded-lg overflow-hidden border text-left ${
                            activeSlide.imageUrl === img.url
                              ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                              : 'border-slate-200'
                          }`}
                        >
                          <img
                            src={img.url}
                            alt={img.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-14 object-cover"
                          />
                          <div className="px-1.5 py-1 text-[10px] text-slate-700 truncate">
                            {img.label}
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Image Crop / Zoom / Pan */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-800">Image Crop & Framing</div>
                  <div>
                    <label className="block text-[11px] text-slate-500">
                      Zoom ({(activeSlide.imagePosition?.scale || 1).toFixed(2)}x)
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={2}
                      step={0.05}
                      value={activeSlide.imagePosition?.scale || 1}
                      onChange={(e) =>
                        updateActiveSlide({
                          imagePosition: {
                            x: activeSlide.imagePosition?.x || 0,
                            y: activeSlide.imagePosition?.y || 0,
                            scale: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500">Pan X</label>
                      <input
                        type="range"
                        min={-25}
                        max={25}
                        value={activeSlide.imagePosition?.x || 0}
                        onChange={(e) =>
                          updateActiveSlide({
                            imagePosition: {
                              x: Number(e.target.value),
                              y: activeSlide.imagePosition?.y || 0,
                              scale: activeSlide.imagePosition?.scale || 1,
                            },
                          })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Pan Y</label>
                      <input
                        type="range"
                        min={-25}
                        max={25}
                        value={activeSlide.imagePosition?.y || 0}
                        onChange={(e) =>
                          updateActiveSlide({
                            imagePosition: {
                              x: activeSlide.imagePosition?.x || 0,
                              y: Number(e.target.value),
                              scale: activeSlide.imagePosition?.scale || 1,
                            },
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Add Shapes & Diagrams */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Shapes className="w-3.5 h-3.5" />
                      <span>Shapes & Callouts</span>
                    </span>
                    {(activeSlide.shapes?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => updateActiveSlide({ shapes: [] })}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Clear Shapes
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { type: 'rect' as const, label: 'Badge Box' },
                      { type: 'circle' as const, label: 'Circle' },
                      { type: 'callout' as const, label: 'Highlight' },
                    ].map((sh) => (
                      <button
                        key={sh.type}
                        type="button"
                        onClick={() =>
                          updateActiveSlide({
                            shapes: [
                              ...(activeSlide.shapes || []),
                              {
                                id: `sh_${Date.now()}`,
                                type: sh.type,
                                label: sh.label,
                                x: 74,
                                y: 18 + (activeSlide.shapes?.length || 0) * 12,
                                w: 18,
                                h: 9,
                                color: '#4F46E5',
                              },
                            ],
                          })
                        }
                        className="px-2 py-1.5 rounded border border-slate-200 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        + {sh.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add / Edit Chart */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Data Chart</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveSlide({
                          layout: 'chart-analysis',
                          chartData: activeSlide.chartData || {
                            type: 'bar',
                            title: 'Comparison Metric',
                            seriesName: 'Value',
                            data: [
                              { label: 'Q1', value: 24 },
                              { label: 'Q2', value: 38 },
                              { label: 'Q3', value: 52 },
                              { label: 'Q4', value: 64 },
                            ],
                          },
                        })
                      }
                      className="text-[11px] font-medium text-indigo-700 hover:underline"
                    >
                      {activeSlide.chartData ? 'Switch to Chart' : '+ Insert Chart'}
                    </button>
                  </div>
                  {activeSlide.chartData && (
                    <div className="space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <select
                        value={activeSlide.chartData.type}
                        onChange={(e) =>
                          updateActiveSlide({
                            chartData: {
                              ...activeSlide.chartData!,
                              type: e.target.value as 'bar' | 'line' | 'pie',
                            },
                          })
                        }
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white"
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="line">Line Chart</option>
                        <option value="pie">Pie Chart</option>
                      </select>
                      {activeSlide.chartData.data.map((d, dIdx) => (
                        <div key={dIdx} className="flex gap-1.5">
                          <input
                            type="text"
                            value={d.label}
                            onChange={(e) => {
                              const next = [...activeSlide.chartData!.data];
                              next[dIdx] = { ...next[dIdx], label: e.target.value };
                              updateActiveSlide({
                                chartData: { ...activeSlide.chartData!, data: next },
                              });
                            }}
                            className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded bg-white"
                          />
                          <input
                            type="number"
                            value={d.value}
                            onChange={(e) => {
                              const next = [...activeSlide.chartData!.data];
                              next[dIdx] = { ...next[dIdx], value: Number(e.target.value) || 0 };
                              updateActiveSlide({
                                chartData: { ...activeSlide.chartData!, data: next },
                              });
                            }}
                            className="w-16 text-xs font-mono px-2 py-1 border border-slate-200 rounded bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Fullscreen Preview Modal */}
      {previewMode && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6">
          <div className="flex items-center justify-between text-white">
            <span className="text-sm font-medium text-slate-300">
              {presentation.title} · Slide {activeIdx + 1} of {slides.length}
            </span>
            <button
              onClick={() => setPreviewMode(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium"
            >
              Exit Preview
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center my-4 min-h-0">
            <div className="w-full max-w-5xl">
              <SlideRenderer
                slide={activeSlide}
                themeId={presentation.themeId}
                aspectRatio={presentation.aspectRatio}
                slideIndex={activeIdx}
                totalSlides={slides.length}
                deckTitle={presentation.title}
              />
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 text-white">
            <button
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
              className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono tabular-nums">
              {activeIdx + 1} / {slides.length}
            </span>
            <button
              onClick={() => setActiveIdx((i) => Math.min(slides.length - 1, i + 1))}
              disabled={activeIdx === slides.length - 1}
              className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
