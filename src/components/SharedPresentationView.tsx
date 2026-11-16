import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PresentationRecord } from '../shared/types';
import { SlideRenderer } from './SlideRenderer';

interface SharedPresentationViewProps {
  shareSlug: string;
  onExit: () => void;
}

export const SharedPresentationView: React.FC<SharedPresentationViewProps> = ({
  shareSlug,
  onExit,
}) => {
  const [pres, setPres] = useState<PresentationRecord | null>(null);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ presentation: PresentationRecord }>(`/api/share/${shareSlug}`)
      .then((res) => setPres(res.presentation))
      .catch((err) => setError(err?.message || 'Shared presentation not found.'))
      .finally(() => setLoading(false));
  }, [shareSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading shared presentation...</span>
      </div>
    );
  }

  if (error || !pres || !pres.slides?.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <p className="text-sm text-red-600 mb-4">{error || 'Presentation unavailable.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
        >
          Go to SlideCraft AI
        </button>
      </div>
    );
  }

  const slides = pres.slides;
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 text-white">
      <header className="flex items-center justify-between max-w-6xl w-full mx-auto">
        <div>
          <div className="text-sm font-semibold">{pres.title}</div>
          <div className="text-xs text-slate-400">
            Shared via SlideCraft AI · {pres.audience} · {pres.language}
          </div>
        </div>
        <button
          onClick={onExit}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium"
        >
          Open SlideCraft AI
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center my-6">
        <div className="w-full max-w-5xl">
          <SlideRenderer
            slide={slides[idx]}
            themeId={pres.themeId}
            aspectRatio={pres.aspectRatio}
            slideIndex={idx}
            totalSlides={slides.length}
            deckTitle={pres.title}
          />
        </div>
      </div>

      <footer className="flex items-center justify-center gap-4">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-mono tabular-nums">
          {idx + 1} / {slides.length}
        </span>
        <button
          onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
          disabled={idx === slides.length - 1}
          className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};
