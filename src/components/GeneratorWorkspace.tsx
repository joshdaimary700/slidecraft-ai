import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  ListTree,
  Loader2,
  Sparkles,
  Type as TypeIcon,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  AspectRatio,
  AuthUser,
  CURATED_VISUALS,
  DocumentSection,
  PRESENTATION_THEMES,
  SlideData,
  SUBSCRIPTION_PLANS,
  TemplateRecord,
} from '../shared/types';
import { SlideRenderer } from './SlideRenderer';

interface GeneratorWorkspaceProps {
  user: AuthUser;
  onGenerated: (presentationId: string, updatedUser: AuthUser) => void;
  onRequestUpgrade: () => void;
}

const SAMPLE_TOPICS = [
  'The History of Christianity',
  'Climate Change',
  'Artificial Intelligence',
  'Business Management',
  'Drug Addiction and Recovery',
  'Biblical Leadership',
  'Environmental Protection',
  'Educational Research',
];

const SLIDE_PRESETS = [5, 10, 15, 20, 25, 30];

const PURPOSE_BY_TEMPLATE_CATEGORY: Record<string, string> = {
  Business: 'Business',
  Education: 'Education',
  'Academic Research': 'Academic',
  Technology: 'Business',
  Marketing: 'Marketing',
  'Medical and Health': 'Education',
  'Church and Ministry': 'Church and ministry',
  'Bible Study': 'Church and ministry',
  'Training and Workshops': 'Workshop',
  'Personal Portfolio': 'Marketing',
  'Project Reports': 'Business',
  'Conference Presentations': 'Conference',
};

export const GeneratorWorkspace: React.FC<GeneratorWorkspaceProps> = ({
  user,
  onGenerated,
  onRequestUpgrade,
}) => {
  const plan = SUBSCRIPTION_PLANS[user.subscription.planCode];
  const maxSlides = user.isFounder ? 50 : plan.maxSlidesPerPresentation;
  const allowsPremiumTemplates = user.isFounder || plan.allowsPremiumTemplates;

  const [sourceType, setSourceType] = useState<'topic' | 'text' | 'document' | 'outline'>('topic');
  const [content, setContent] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileType, setUploadedFileType] = useState('');
  const [uploadedSections, setUploadedSections] = useState<DocumentSection[]>([]);
  const [extractedSnapshot, setExtractedSnapshot] = useState('');
  const [extracting, setExtracting] = useState(false);

  const [preserveExactContent, setPreserveExactContent] = useState(false);
  const [matchSourceSlides, setMatchSourceSlides] = useState(false);

  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateFilter, setTemplateFilter] = useState('All');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; altText?: string }>>([]);
  const [selectedPictureUrls, setSelectedPictureUrls] = useState<string[]>([]);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  const [slideCount, setSlideCount] = useState<number>(maxSlides >= 10 ? 10 : Math.min(5, maxSlides));
  const [isCustomInputOpen, setIsCustomInputOpen] = useState(false);

  const [audience, setAudience] = useState('General audience');
  const [purpose, setPurpose] = useState('Education');
  const [writingStyle, setWritingStyle] = useState('Professional');
  const [languageOption, setLanguageOption] = useState('English');
  const [customLanguage, setCustomLanguage] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [themeId, setThemeId] = useState('navy-indigo');

  const [generating, setGenerating] = useState(false);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pictureUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!generating) {
      setGenerationElapsed(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setGenerationElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [generating]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiFetch<{ templates: TemplateRecord[] }>('/api/templates').catch(() => ({ templates: [] })),
      apiFetch<{ uploaded: Array<{ id: string; url: string; altText?: string }> }>('/api/images').catch(() => ({
        uploaded: [],
      })),
    ])
      .then(([tplRes, imgRes]) => {
        if (!mounted) return;
        setTemplates(tplRes.templates || []);
        setUploadedImages(imgRes.uploaded || []);
      })
      .finally(() => {
        if (mounted) setLoadingTemplates(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isExactModeActive = sourceType !== 'topic' && preserveExactContent;
  const minSlides = isExactModeActive ? 1 : 2;
  const effectiveSlideCount = Math.max(
    minSlides,
    Math.min(
      maxSlides,
      matchSourceSlides && uploadedSections.length > 0 ? uploadedSections.length : slideCount
    )
  );

  const slideCountOptions = useMemo(() => {
    const opts: number[] = [];
    for (let n = minSlides; n <= maxSlides; n++) {
      opts.push(n);
    }
    return opts;
  }, [minSlides, maxSlides]);

  const templateCategories = useMemo(() => {
    const cats = Array.from(new Set(templates.map((t) => t.category)));
    return ['All', ...cats];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (templateFilter === 'All') return templates;
    return templates.filter((t) => t.category === templateFilter);
  }, [templates, templateFilter]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const activeTheme = useMemo(
    () => PRESENTATION_THEMES.find((t) => t.id === themeId) || PRESENTATION_THEMES[0],
    [themeId]
  );

  const generationStage = useMemo(() => {
    if (generationElapsed < 8) return 'Preparing your presentation';
    if (generationElapsed < 35) return 'Writing and organizing slide content';
    if (generationElapsed < 90) return 'Applying layouts and visual structure';
    return 'Finalizing slides and saving the presentation';
  }, [generationElapsed]);

  const handleSelectTemplate = (tpl: TemplateRecord | null) => {
    if (!tpl) {
      setSelectedTemplateId('');
      return;
    }
    if (tpl.isPremium && !allowsPremiumTemplates) {
      onRequestUpgrade();
      return;
    }
    setSelectedTemplateId(tpl.id);
    if (tpl.themeId) {
      setThemeId(tpl.themeId);
    }
    if (!isExactModeActive && PURPOSE_BY_TEMPLATE_CATEGORY[tpl.category]) {
      setPurpose(PURPOSE_BY_TEMPLATE_CATEGORY[tpl.category]);
    }
  };

  const handleTogglePictureUrl = (url: string) => {
    setSelectedPictureUrls((prev) =>
      prev.includes(url) ? prev.filter((item) => item !== url) : [...prev, url]
    );
  };

  const handleFreePicturesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setUploadingPicture(true);
    try {
      const newlyUploaded: Array<{ id: string; url: string; altText?: string }> = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('image', file);
        form.append('altText', file.name.replace(/\.[^.]+$/, ''));
        const res = await apiFetch<{ id: string; url: string; altText?: string }>('/api/images/upload', {
          method: 'POST',
          body: form,
        });
        newlyUploaded.push(res);
      }
      if (newlyUploaded.length > 0) {
        setUploadedImages((prev) => [...newlyUploaded, ...prev]);
        setSelectedPictureUrls((prev) => {
          const next = [...prev];
          for (const item of newlyUploaded) {
            if (!next.includes(item.url)) next.push(item.url);
          }
          return next;
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to upload picture.');
    } finally {
      setUploadingPicture(false);
      if (pictureUploadRef.current) {
        pictureUploadRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setError('');
    setExtracting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch<{
        fileName: string;
        extractedText: string;
        sections?: DocumentSection[];
        detectedSlideCount?: number;
        fileType?: string;
      }>('/api/presentations/extract-document', {
        method: 'POST',
        body: form,
      });

      const sections = Array.isArray(res.sections) ? res.sections : [];
      const detectedCount = res.detectedSlideCount || sections.length || 1;

      setUploadedFileName(res.fileName);
      setUploadedFileType(res.fileType || '');
      setUploadedSections(sections);
      setExtractedSnapshot(res.extractedText);
      setContent(res.extractedText);

      // Default to exact verbatim preservation whenever a file is uploaded
      setPreserveExactContent(true);
      if (detectedCount >= 1 && (user.isFounder || detectedCount <= maxSlides)) {
        setMatchSourceSlides(true);
        setSlideCount(detectedCount);
        setIsCustomInputOpen(false);
      } else {
        setMatchSourceSlides(false);
        setSlideCount(Math.min(maxSlides, detectedCount));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to read uploaded file.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSelectDropdownChange = (val: string) => {
    if (val === 'match') {
      if (!user.isFounder && uploadedSections.length > maxSlides) {
        onRequestUpgrade();
        return;
      }
      setMatchSourceSlides(true);
      setSlideCount(Math.max(1, uploadedSections.length));
      setIsCustomInputOpen(false);
      return;
    }
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) {
      setMatchSourceSlides(false);
      setSlideCount(Math.max(minSlides, Math.min(maxSlides, parsed)));
      setIsCustomInputOpen(!SLIDE_PRESETS.includes(parsed));
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetSlides =
      sourceType === 'document' && isExactModeActive && matchSourceSlides && uploadedSections.length > 0
        ? uploadedSections.length
        : slideCount;

    if (!user.isFounder && targetSlides > maxSlides) {
      setError(
        `Your ${plan.name} plan allows up to ${maxSlides} slides per presentation. Select ${maxSlides} or fewer, or upgrade your plan.`
      );
      return;
    }

    if (!user.isFounder && user.usage.remainingPresentations === 0) {
      setError(
        `You have used all ${plan.monthlyPresentationsLimit} monthly presentations on your ${plan.name} plan.`
      );
      return;
    }

    if (content.trim().length < 3) {
      setError('Please enter a topic, paste text, write an outline, or upload a document.');
      return;
    }

    const finalLanguage =
      languageOption === 'Other' ? customLanguage.trim() || 'English' : languageOption;

    const useOriginalSections =
      sourceType === 'document' &&
      isExactModeActive &&
      uploadedSections.length > 0 &&
      content === extractedSnapshot;

    setGenerating(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 240_000);
    try {
      const res = await apiFetch<{ presentationId: string; user: AuthUser }>(
        '/api/presentations/generate',
        {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            sourceType,
            content: content.trim(),
            slideCount: targetSlides,
            audience,
            purpose,
            writingStyle,
            language: finalLanguage,
            aspectRatio,
            themeId,
            templateId: selectedTemplateId || undefined,
            selectedImageUrls: selectedPictureUrls.length > 0 ? selectedPictureUrls : undefined,
            preserveExactContent: isExactModeActive,
            matchSourceSlides: sourceType === 'document' && isExactModeActive && matchSourceSlides,
            sections: useOriginalSections ? uploadedSections : undefined,
            uploadedFileName: sourceType === 'document' ? uploadedFileName : undefined,
          }),
        }
      );
      onGenerated(res.presentationId, res.user);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError(
          'Slide generation took longer than 4 minutes and was stopped. Try fewer slides or a shorter topic, then try again.'
        );
      } else {
        setError(err?.message || 'Failed to generate presentation.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Create Presentation with AI
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Choose your content source, pick a template design style, and generate an editable deck.
          </p>
        </div>
        <div className="text-xs text-slate-500 tabular-nums shrink-0">
          {user.isFounder ? (
            <span>Founder Access · Up to 50 slides · Unlimited decks</span>
          ) : (
            <span>
              {user.usage.remainingPresentations} of {user.usage.presentationsLimit} monthly decks remaining · Max {maxSlides} slides
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm text-red-700">{error}</span>
          {!user.isFounder && (
            <button
              type="button"
              onClick={onRequestUpgrade}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap shrink-0 hover:bg-slate-800"
            >
              View Plans
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-6">
        {/* 1. Source Type Tabs */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-lg mb-5">
            {[
              { id: 'topic', label: 'Topic to Slides', icon: Sparkles },
              { id: 'text', label: 'Text & Notes', icon: TypeIcon },
              { id: 'document', label: 'Upload Document', icon: FileText },
              { id: 'outline', label: 'From Outline', icon: ListTree },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = sourceType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    const nextType = tab.id as 'topic' | 'text' | 'document' | 'outline';
                    setSourceType(nextType);
                    setError('');
                    if (nextType === 'topic') {
                      setPreserveExactContent(false);
                      setMatchSourceSlides(false);
                    } else if (nextType === 'document' && uploadedFileName) {
                      setPreserveExactContent(true);
                    }
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {sourceType === 'topic' && (
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                What is your presentation about?
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g., Artificial Intelligence in Healthcare, The History of Christianity, Climate Change..."
                className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
              />
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-2">Popular topics:</div>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_TOPICS.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setContent(topic)}
                      className="px-3 py-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sourceType === 'text' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-800">
                Paste your lecture notes, research summary, or paragraphs
              </label>
              <textarea
                rows={7}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your article, meeting notes, or study material here. Use blank lines or --- between slides if keeping exact text..."
                className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 leading-relaxed"
              />
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveExactContent}
                  onChange={(e) => {
                    setPreserveExactContent(e.target.checked);
                    setMatchSourceSlides(false);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Keep my exact text (do not rewrite or add anything)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Places your pasted text directly onto slides word-for-word without AI rewriting or adding extra points.
                  </div>
                </div>
              </label>
            </div>
          )}

          {sourceType === 'document' && (
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                Upload PDF, DOCX, TXT, or PPTX document
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.pptx,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                className="border border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-colors"
              >
                {extracting ? (
                  <div className="flex flex-col items-center gap-2 text-indigo-700">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm font-medium">Reading file content...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-slate-400" />
                    <div className="text-sm font-medium text-slate-800">
                      {uploadedFileName
                        ? `Loaded: ${uploadedFileName}`
                        : 'Click to upload or drag and drop a file'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {uploadedFileName && uploadedSections.length > 0 ? (
                        <span className="tabular-nums">
                          {uploadedFileType || 'File'} · {uploadedSections.length}{' '}
                          {uploadedSections.length === 1 ? 'section/slide' : 'sections/slides'} detected · Click to replace
                        </span>
                      ) : (
                        'Supports PDF, DOCX, PPTX, and TXT up to 15 MB'
                      )}
                    </div>
                  </div>
                )}
              </div>

              <label className="mt-4 flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveExactContent}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPreserveExactContent(checked);
                    if (!checked) {
                      setMatchSourceSlides(false);
                      if (slideCount < 2) setSlideCount(Math.min(5, maxSlides));
                    } else if (
                      uploadedSections.length >= 1 &&
                      (user.isFounder || uploadedSections.length <= maxSlides)
                    ) {
                      setMatchSourceSlides(true);
                      setSlideCount(uploadedSections.length);
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Keep uploaded content exact (do not rewrite or add anything)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {preserveExactContent
                      ? 'Exact mode is active: SlideCraft AI keeps every word and slide from your uploaded file as-is without rewriting, summarizing, or adding extra text.'
                      : 'AI rewrite mode: SlideCraft AI will summarize and rewrite your document into new slide layouts.'}
                  </div>
                </div>
              </label>

              {content && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
                    <span>Extracted file content ({content.length.toLocaleString()} characters)</span>
                    {uploadedSections.length > 0 && content === extractedSnapshot && (
                      <span className="text-slate-500 tabular-nums">
                        Preserving {uploadedSections.length}{' '}
                        {uploadedSections.length === 1 ? 'slide' : 'slides'} verbatim
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          )}

          {sourceType === 'outline' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-800">
                Provide slide headings or structured bullet points
              </label>
              <textarea
                rows={7}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  '1. Introduction & Core Problem\n2. Historical Context\n3. Key Findings & Case Study\n4. Strategic Recommendations\n5. Next Steps & Conclusion'
                }
                className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 leading-relaxed"
              />
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveExactContent}
                  onChange={(e) => {
                    setPreserveExactContent(e.target.checked);
                    setMatchSourceSlides(false);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Keep my exact outline wording (do not expand or rewrite)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Creates slides using only the headings and bullet points you wrote without adding AI-generated text.
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* 2. Template Design Style Picker */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-indigo-700 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900">Choose a Template Design Style</h2>
            </div>
            <span className="text-xs text-slate-500">
              {selectedTemplate
                ? `${selectedTemplate.name} · ${activeTheme.name} · Full Deck Cover to Closing`
                : `Auto Design · ${activeTheme.name}`}
            </span>
          </div>

          {/* Category filter row */}
          <div className="flex flex-wrap gap-1.5">
            {templateCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setTemplateFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  templateFilter === cat
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loadingTemplates ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading template design styles...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[410px] overflow-y-auto pr-1">
              {/* Auto / Clean Default Style Card */}
              {templateFilter === 'All' && (
                <button
                  type="button"
                  onClick={() => handleSelectTemplate(null)}
                  className={`text-left rounded-xl border p-2.5 transition-colors flex flex-col justify-between ${
                    !selectedTemplateId
                      ? 'border-indigo-600 ring-2 ring-indigo-600/15 bg-indigo-50/25'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className="aspect-[16/9] rounded-md border p-3 flex flex-col justify-between mb-2.5"
                    style={{
                      backgroundColor: activeTheme.canvasBg,
                      borderColor: activeTheme.borderColor,
                    }}
                  >
                    <div className="w-8 h-1 rounded-full" style={{ backgroundColor: activeTheme.accentColor }} />
                    <div>
                      <div
                        className="text-[11px] font-bold leading-tight"
                        style={{ color: activeTheme.titleColor, fontFamily: activeTheme.titleFont }}
                      >
                        Smart Adaptive Layout
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: activeTheme.mutedColor }}>
                        Matches selected theme automatically
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">Auto Design</div>
                      <div className="text-[11px] text-slate-500 truncate">Flexible · All Layouts</div>
                    </div>
                    {!selectedTemplateId && <Check className="w-4 h-4 text-indigo-700 shrink-0" />}
                  </div>
                </button>
              )}

              {filteredTemplates.map((tpl) => {
                const locked = tpl.isPremium && !allowsPremiumTemplates;
                const active = selectedTemplateId === tpl.id;
                const tplTheme =
                  PRESENTATION_THEMES.find((t) => t.id === tpl.themeId) || PRESENTATION_THEMES[0];
                const previewSlide = tpl.sampleSlides?.[0] as SlideData | undefined;

                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`text-left rounded-xl border p-2.5 transition-colors flex flex-col justify-between ${
                      active
                        ? 'border-indigo-600 ring-2 ring-indigo-600/15 bg-indigo-50/25'
                        : locked
                          ? 'border-slate-200 bg-slate-50/70 hover:border-indigo-300'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="pointer-events-none mb-2.5">
                      {previewSlide ? (
                        <SlideRenderer
                          slide={previewSlide}
                          themeId={tpl.themeId}
                          aspectRatio="16:9"
                          compact
                        />
                      ) : (
                        <div
                          className="aspect-[16/9] rounded-md border p-3 flex flex-col justify-between"
                          style={{
                            backgroundColor: tplTheme.canvasBg,
                            borderColor: tplTheme.borderColor,
                          }}
                        >
                          <div
                            className="w-8 h-1 rounded-full"
                            style={{ backgroundColor: tplTheme.accentColor }}
                          />
                          <div
                            className="text-[11px] font-bold truncate"
                            style={{ color: tplTheme.titleColor }}
                          >
                            {tpl.name}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{tpl.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {tpl.category} · {tpl.slideCount} slides · {tplTheme.name}
                          {locked ? ' · Pro' : ''}
                        </div>
                      </div>
                      {active && <Check className="w-4 h-4 text-indigo-700 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Free Picture Adding Connected to Template Selection */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-700 shrink-0" />
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Add Free Pictures to Your Template (100% Free)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedTemplate
                      ? `Upload your own photos or pick free visuals to pair with "${selectedTemplate.name}".`
                      : 'Upload your own photos or pick free visuals to embed into your generated slides.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedPictureUrls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPictureUrls([])}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Clear ({selectedPictureUrls.length})
                  </button>
                )}
                <input
                  ref={pictureUploadRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFreePicturesUpload(e.target.files)}
                />
                <button
                  type="button"
                  disabled={uploadingPicture}
                  onClick={() => pictureUploadRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {uploadingPicture ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Free Picture</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {[
                ...uploadedImages.map((img) => ({
                  key: `up-${img.id}`,
                  url: img.url,
                  label: img.altText || 'Uploaded picture',
                })),
                ...CURATED_VISUALS.map((vis) => ({
                  key: `cur-${vis.id}`,
                  url: vis.url,
                  label: vis.label,
                })),
              ].map((pic) => {
                const orderIdx = selectedPictureUrls.indexOf(pic.url);
                const selected = orderIdx !== -1;
                return (
                  <button
                    key={pic.key}
                    type="button"
                    onClick={() => handleTogglePictureUrl(pic.url)}
                    className={`group relative rounded-lg overflow-hidden border text-left transition-all ${
                      selected
                        ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden">
                      <img
                        src={pic.url}
                        alt={pic.label}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-150"
                      />
                    </div>
                    <div className="px-2 py-1.5 bg-white flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-medium text-slate-700 truncate">{pic.label}</span>
                      {selected && (
                        <span className="text-[10px] font-semibold text-indigo-700 shrink-0 tabular-nums">
                          {orderIdx === 0 ? '1 · Cover' : `${orderIdx + 1}`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Generation Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">Presentation Settings</h2>
            <span className="text-xs text-slate-500 tabular-nums">
              Configured for {effectiveSlideCount} {effectiveSlideCount === 1 ? 'slide' : 'slides'} · {aspectRatio}
            </span>
          </div>

          {/* Number of slides — Dropdown Selector + Preset Buttons */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label htmlFor="slide-count-select" className="block text-xs font-medium text-slate-700">
                Number of slides
              </label>
              <span className="text-xs text-slate-500 tabular-nums">
                {matchSourceSlides && sourceType === 'document' && uploadedSections.length > 0
                  ? `Matching uploaded file (${uploadedSections.length} ${uploadedSections.length === 1 ? 'slide' : 'slides'})`
                  : `${effectiveSlideCount} ${effectiveSlideCount === 1 ? 'slide' : 'slides'} selected`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                id="slide-count-select"
                aria-label="Select number of slides"
                value={
                  matchSourceSlides && sourceType === 'document' && uploadedSections.length > 0
                    ? 'match'
                    : String(effectiveSlideCount)
                }
                onChange={(e) => handleSelectDropdownChange(e.target.value)}
                className="px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 tabular-nums"
              >
                {sourceType === 'document' &&
                  isExactModeActive &&
                  uploadedSections.length > 0 && (
                    <option value="match">
                      Match uploaded file ({uploadedSections.length}{' '}
                      {uploadedSections.length === 1 ? 'slide' : 'slides'})
                      {!user.isFounder && uploadedSections.length > maxSlides ? ' · Upgrade' : ''}
                    </option>
                  )}
                {slideCountOptions.map((n) => (
                  <option key={n} value={String(n)}>
                    {n} {n === 1 ? 'slide' : 'slides'}
                  </option>
                ))}
              </select>

              {SLIDE_PRESETS.map((num) => {
                const locked = !user.isFounder && num > maxSlides;
                const active = !matchSourceSlides && !isCustomInputOpen && effectiveSlideCount === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        onRequestUpgrade();
                      } else {
                        setMatchSourceSlides(false);
                        setIsCustomInputOpen(false);
                        setSlideCount(num);
                      }
                    }}
                    className={`px-3.5 py-2 text-xs font-medium rounded-lg border tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : locked
                          ? 'bg-slate-50 text-slate-400 border-slate-200 hover:border-indigo-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {num} slides {locked ? '· Upgrade' : ''}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setMatchSourceSlides(false);
                  setIsCustomInputOpen((prev) => !prev);
                }}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  isCustomInputOpen && !matchSourceSlides
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                Custom
              </button>

              {isCustomInputOpen && (
                <input
                  type="number"
                  min={minSlides}
                  max={maxSlides}
                  value={slideCount}
                  onChange={(e) => {
                    setMatchSourceSlides(false);
                    setSlideCount(
                      Math.max(minSlides, Math.min(maxSlides, Number(e.target.value) || minSlides))
                    );
                  }}
                  className="w-20 px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              )}
            </div>
          </div>

          {/* 4-column settings grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                disabled={isExactModeActive}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-indigo-600"
              >
                {[
                  'Students',
                  'Teachers',
                  'Business professionals',
                  'Church leaders',
                  'Researchers',
                  'General audience',
                ].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={isExactModeActive}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-indigo-600"
              >
                {[
                  'Education',
                  'Business',
                  'Academic',
                  'Training',
                  'Church and ministry',
                  'Research',
                  'Marketing',
                  'Conference',
                  'Workshop',
                ].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Writing style</label>
              <select
                value={writingStyle}
                onChange={(e) => setWritingStyle(e.target.value)}
                disabled={isExactModeActive}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-indigo-600"
              >
                {[
                  'Professional',
                  'Academic',
                  'Simple English',
                  'Creative',
                  'Informative',
                  'Persuasive',
                ].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Language</label>
              <select
                value={languageOption}
                onChange={(e) => setLanguageOption(e.target.value)}
                disabled={isExactModeActive}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-indigo-600"
              >
                {['English', 'Hindi', 'Assamese', 'Bodo', 'Other'].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {languageOption === 'Other' && !isExactModeActive && (
                <input
                  type="text"
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  placeholder="Enter language (e.g., Spanish, Bengali)"
                  className="mt-2 w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              )}
            </div>
          </div>

          {isExactModeActive && (
            <div className="text-xs text-slate-500">
              Audience, purpose, writing style, and language rewriting are turned off while exact content preservation is enabled.
            </div>
          )}

          {/* Aspect Ratio + Visual Color Palette Override */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Aspect ratio</label>
              <div className="grid grid-cols-2 sm:w-80 gap-2">
                {(['16:9', '4:3'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                      aspectRatio === ratio
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {ratio === '16:9' ? '16:9 Widescreen' : '4:3 Standard'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-slate-700">
                  Color & Typography Theme ({PRESENTATION_THEMES.length} styles)
                </label>
                <span className="text-[11px] text-slate-500">
                  Selected: {activeTheme.name} {activeTheme.isDark ? '· Dark' : '· Light'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESENTATION_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeId(t.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                      themeId === t.id
                        ? 'border-indigo-600 bg-indigo-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-md border shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: t.canvasBg, borderColor: t.accentColor, borderWidth: 2 }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.accentColor }} />
                    </span>
                    <span className="text-xs font-medium text-slate-800 truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Failed generations never consume presentation credits. All slides are auto-saved for editing.
          </p>
          <div className="flex items-center gap-3">
            {generating && (
              <div className="text-right" role="status" aria-live="polite">
                <p className="text-xs font-semibold text-indigo-700">{generationStage}</p>
                <p className="text-[11px] text-slate-500">
                  {generationElapsed}s elapsed · Please keep this page open
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={generating || extracting}
              className="px-6 py-3 rounded-xl bg-indigo-700 text-white text-sm font-semibold hover:bg-indigo-800 disabled:opacity-60 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isExactModeActive
                      ? `Building ${effectiveSlideCount} exact ${effectiveSlideCount === 1 ? 'slide' : 'slides'}...`
                      : `Generating ${effectiveSlideCount} slides...`}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {isExactModeActive ? 'Generate Exact Presentation' : 'Generate Presentation'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
