import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Image as ImageIcon } from 'lucide-react';
import { AspectRatio, PRESENTATION_THEMES, SlideData, ThemeConfig } from '../shared/types';

interface SlideRendererProps {
  slide: SlideData;
  themeId: string;
  aspectRatio: AspectRatio;
  editable?: boolean;
  compact?: boolean;
  slideIndex?: number;
  totalSlides?: number;
  deckTitle?: string;
  onUpdate?: (patch: Partial<SlideData>) => void;
}

function SlideImage({
  url,
  alt,
  position,
  className = '',
  theme,
}: {
  url?: string;
  alt?: string;
  position?: { x: number; y: number; scale: number };
  className?: string;
  theme: ThemeConfig;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border ${className}`}
        style={{
          background: `linear-gradient(135deg, ${theme.surfaceBg}, ${theme.borderColor})`,
          borderColor: theme.borderColor,
          color: theme.mutedColor,
        }}
      >
        <ImageIcon className="w-7 h-7 mb-1.5 opacity-60" />
        <span className="text-xs font-medium px-3 text-center opacity-80">
          {alt || 'Visual frame'}
        </span>
      </div>
    );
  }

  const scale = position?.scale || 1;
  const x = position?.x || 0;
  const y = position?.y || 0;

  return (
    <div className={`overflow-hidden rounded-lg relative ${className}`}>
      <img
        src={url}
        alt={alt || 'Presentation slide visual'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-150"
        style={{
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
        }}
      />
    </div>
  );
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({
  slide,
  themeId,
  aspectRatio,
  editable = false,
  compact = false,
  slideIndex = 0,
  totalSlides = 1,
  deckTitle = '',
  onUpdate,
}) => {
  const theme = PRESENTATION_THEMES.find((t) => t.id === themeId) || PRESENTATION_THEMES[0];
  const bg = slide.backgroundColor || theme.canvasBg;
  const titleColor = slide.titleColor || theme.titleColor;
  const bodyColor = slide.bodyColor || theme.bodyColor;
  const titleFont = slide.titleFont || theme.titleFont;
  const bodyFont = slide.bodyFont || theme.bodyFont;

  const titlePx = compact ? 13 : Math.max(18, Math.min(42, slide.titleSize || 28));
  const bodyPx = compact ? 9 : Math.max(12, Math.min(22, slide.bodySize || 15));
  const aspectClass = aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-[16/9]';

  const updateBullet = (idx: number, val: string) => {
    if (!onUpdate) return;
    const next = [...slide.bullets];
    next[idx] = val;
    onUpdate({ bullets: next });
  };

  const updateParagraph = (idx: number, val: string) => {
    if (!onUpdate) return;
    const next = [...slide.paragraphs];
    next[idx] = val;
    onUpdate({ paragraphs: next });
  };

  const renderEditableTitle = (isHero = false) =>
    editable && onUpdate ? (
      <input
        type="text"
        value={slide.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        className="w-full bg-transparent font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1 -mx-1"
        style={{
          color: isHero ? '#FFFFFF' : titleColor,
          fontFamily: titleFont,
          fontSize: isHero ? `${Math.min(44, titlePx + 8)}px` : `${titlePx}px`,
          lineHeight: 1.18,
        }}
      />
    ) : (
      <h2
        className="font-bold tracking-tight"
        style={{
          color: isHero ? '#FFFFFF' : titleColor,
          fontFamily: titleFont,
          fontSize: isHero ? `${compact ? 14 : Math.min(44, titlePx + 8)}px` : `${titlePx}px`,
          lineHeight: 1.18,
        }}
      >
        {slide.title}
      </h2>
    );

  const renderEditableSubtitle = (isHero = false) => {
    if (!slide.subtitle && !editable) return null;
    return editable && onUpdate ? (
      <input
        type="text"
        value={slide.subtitle || ''}
        placeholder="Add slide subtitle..."
        onChange={(e) => onUpdate({ subtitle: e.target.value })}
        className="w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1 -mx-1 mt-1"
        style={{
          color: isHero ? '#E2E8F0' : theme.mutedColor,
          fontFamily: bodyFont,
          fontSize: compact ? '9px' : isHero ? '17px' : '14px',
        }}
      />
    ) : (
      <p
        className="mt-1"
        style={{
          color: isHero ? '#E2E8F0' : theme.mutedColor,
          fontFamily: bodyFont,
          fontSize: compact ? '9px' : isHero ? '17px' : '14px',
        }}
      >
        {slide.subtitle}
      </p>
    );
  };

  const renderProseAndBullets = () => (
    <div className={compact ? 'space-y-1' : 'space-y-3'}>
      {slide.paragraphs.map((p, idx) =>
        editable && onUpdate ? (
          <textarea
            key={`p-${idx}`}
            value={p}
            rows={2}
            onChange={(e) => updateParagraph(idx, e.target.value)}
            className="w-full bg-transparent resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1 -mx-1"
            style={{ color: bodyColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
          />
        ) : (
          <p
            key={`p-${idx}`}
            className="leading-relaxed"
            style={{ color: bodyColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
          >
            {p}
          </p>
        )
      )}

      {slide.bullets.length > 0 && (
        <ul className={compact ? 'space-y-0.5' : 'space-y-2'}>
          {slide.bullets.map((b, idx) => (
            <li key={`b-${idx}`} className="flex items-start gap-2.5">
              <span
                className="shrink-0 rounded-full mt-2"
                style={{
                  width: compact ? 4 : 6,
                  height: compact ? 4 : 6,
                  backgroundColor: theme.accentColor,
                }}
              />
              {editable && onUpdate ? (
                <input
                  type="text"
                  value={b}
                  onChange={(e) => updateBullet(idx, e.target.value)}
                  className="flex-1 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1 -mx-1"
                  style={{ color: bodyColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
                />
              ) : (
                <span
                  className="leading-snug"
                  style={{ color: bodyColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
                >
                  {b}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Full-width hero image layout
  if (slide.layout === 'full-image-title') {
    return (
      <div
        className={`relative w-full overflow-hidden select-none ${aspectClass} ${compact ? 'rounded-md' : 'rounded-xl'}`}
        style={{ backgroundColor: '#0F172A' }}
      >
        {slide.imageUrl && (
          <img
            src={slide.imageUrl}
            alt={slide.imageAlt || slide.title}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-slate-950/40" />
        <div
          className={`relative z-10 h-full flex flex-col justify-center ${compact ? 'p-3' : 'p-12 md:p-16'}`}
        >
          <div
            className={compact ? 'w-6 h-0.5 mb-1.5' : 'w-14 h-1 mb-5'}
            style={{ backgroundColor: theme.accentColor }}
          />
          <div className="max-w-3xl">
            {renderEditableTitle(true)}
            {renderEditableSubtitle(true)}
            {slide.paragraphs.length > 0 && !compact && (
              <div className="mt-6 max-w-2xl">
                {editable && onUpdate ? (
                  <input
                    type="text"
                    value={slide.paragraphs[0] || ''}
                    onChange={(e) => updateParagraph(0, e.target.value)}
                    className="w-full bg-transparent text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 rounded px-1 -mx-1"
                  />
                ) : (
                  <p className="text-slate-200 text-sm leading-relaxed">{slide.paragraphs[0]}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden flex flex-col justify-between ${aspectClass} ${compact ? 'p-3 rounded-md' : 'px-8 pt-7 pb-6 md:px-10 md:pt-8 md:pb-6 rounded-xl'}`}
      style={{
        backgroundColor: bg,
        border: `1px solid ${theme.borderColor}`,
      }}
    >
      {/* Top Master Template Accent Stripe */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: compact ? 2 : 4,
          backgroundColor: theme.accentColor,
        }}
      />

      {/* Header */}
      <div className={`shrink-0 border-b relative ${compact ? 'pb-1 mb-1.5' : 'pb-3 mb-5'}`} style={{ borderColor: theme.borderColor }}>
        <div className="flex items-baseline gap-3">
          {!compact && slideIndex > 0 && (
            <span
              className="font-mono text-xs font-bold tracking-wider shrink-0 tabular-nums"
              style={{ color: theme.accentColor }}
            >
              {String(slideIndex + 1).padStart(2, '0')}
            </span>
          )}
          <div className="flex-1 min-w-0">
            {renderEditableTitle(false)}
            {renderEditableSubtitle(false)}
          </div>
        </div>
        <div
          className="absolute left-0 -bottom-px"
          style={{
            width: compact ? 20 : 48,
            height: compact ? 1.5 : 2,
            backgroundColor: theme.accentColor,
          }}
        />
      </div>

      {/* Main Content Body */}
      <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
        {(slide.layout === 'image-left' || slide.layout === 'image-right') && (
          <div className={`grid grid-cols-12 ${compact ? 'gap-2' : 'gap-7'} h-full items-center`}>
            <div className={`col-span-6 h-full min-h-0 ${slide.layout === 'image-right' ? 'order-2' : 'order-1'}`}>
              <SlideImage
                url={slide.imageUrl}
                alt={slide.imageAlt}
                position={slide.imagePosition}
                theme={theme}
                className="w-full h-full"
              />
            </div>
            <div className={`col-span-6 overflow-y-auto max-h-full ${slide.layout === 'image-right' ? 'order-1' : 'order-2'}`}>
              {renderProseAndBullets()}
            </div>
          </div>
        )}

        {slide.layout === 'two-column-comparison' && (
          <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-6'} h-full items-stretch`}>
            {(slide.comparison?.length
              ? slide.comparison.slice(0, 2)
              : [
                  { heading: 'Perspective A', points: slide.bullets.slice(0, Math.ceil(slide.bullets.length / 2)) },
                  { heading: 'Perspective B', points: slide.bullets.slice(Math.ceil(slide.bullets.length / 2)) },
                ]
            ).map((col, cIdx) => (
              <div
                key={cIdx}
                className={compact ? 'p-1.5 rounded border' : 'p-6 rounded-xl border flex flex-col'}
                style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
              >
                {editable && onUpdate && slide.comparison ? (
                  <input
                    type="text"
                    value={col.heading}
                    onChange={(e) => {
                      const next = [...(slide.comparison || [])];
                      next[cIdx] = { ...next[cIdx], heading: e.target.value };
                      onUpdate({ comparison: next });
                    }}
                    className="font-semibold mb-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1"
                    style={{ color: theme.accentColor, fontSize: compact ? '9px' : '17px' }}
                  />
                ) : (
                  <h3
                    className={`font-semibold ${compact ? 'mb-1' : 'mb-3'}`}
                    style={{ color: theme.accentColor, fontSize: compact ? '9px' : '17px' }}
                  >
                    {col.heading}
                  </h3>
                )}
                <ul className={compact ? 'space-y-0.5' : 'space-y-2.5'}>
                  {(col.points || []).map((pt, pIdx) => (
                    <li key={pIdx} className="flex items-start gap-2">
                      <span
                        className="shrink-0 rounded-full mt-1.5"
                        style={{ width: compact ? 3 : 5, height: compact ? 3 : 5, backgroundColor: theme.accentColor }}
                      />
                      {editable && onUpdate && slide.comparison ? (
                        <input
                          type="text"
                          value={pt}
                          onChange={(e) => {
                            const next = [...(slide.comparison || [])];
                            const pts = [...next[cIdx].points];
                            pts[pIdx] = e.target.value;
                            next[cIdx] = { ...next[cIdx], points: pts };
                            onUpdate({ comparison: next });
                          }}
                          className="flex-1 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1"
                          style={{ color: bodyColor, fontSize: compact ? '8px' : `${bodyPx - 1}px` }}
                        />
                      ) : (
                        <span style={{ color: bodyColor, fontSize: compact ? '8px' : `${bodyPx - 1}px` }}>
                          {pt}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {slide.layout === 'three-column-cards' && (
          <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-5'} h-full items-stretch`}>
            {(slide.featureCards?.length
              ? slide.featureCards.slice(0, 3)
              : slide.bullets.slice(0, 3).map((b, i) => ({ title: `Pillar 0${i + 1}`, description: b }))
            ).map((card, idx) => (
              <div
                key={idx}
                className={compact ? 'p-1.5 rounded border relative overflow-hidden' : 'p-5 rounded-xl border flex flex-col justify-between relative overflow-hidden'}
                style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
              >
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{ height: compact ? 2 : 3, backgroundColor: theme.accentColor }}
                />
                <div>
                  <div
                    className={`font-mono font-semibold ${compact ? 'text-[8px]' : 'text-xs mb-2'}`}
                    style={{ color: theme.accentColor }}
                  >
                    0{idx + 1}
                  </div>
                  {editable && onUpdate && slide.featureCards ? (
                    <>
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) => {
                          const next = [...(slide.featureCards || [])];
                          next[idx] = { ...next[idx], title: e.target.value };
                          onUpdate({ featureCards: next });
                        }}
                        className="w-full font-semibold bg-transparent mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1"
                        style={{ color: titleColor, fontSize: compact ? '9px' : '16px' }}
                      />
                      <textarea
                        value={card.description}
                        rows={3}
                        onChange={(e) => {
                          const next = [...(slide.featureCards || [])];
                          next[idx] = { ...next[idx], description: e.target.value };
                          onUpdate({ featureCards: next });
                        }}
                        className="w-full bg-transparent resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1"
                        style={{ color: bodyColor, fontSize: compact ? '8px' : '13.5px' }}
                      />
                    </>
                  ) : (
                    <>
                      <h3
                        className={`font-semibold ${compact ? 'mb-0.5' : 'mb-2'}`}
                        style={{ color: titleColor, fontSize: compact ? '9px' : '16px' }}
                      >
                        {card.title}
                      </h3>
                      <p
                        className="leading-relaxed"
                        style={{ color: bodyColor, fontSize: compact ? '7.5px' : '13.5px' }}
                      >
                        {card.description}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.layout === 'stat-highlight' && (
          <div className={`flex flex-col justify-between h-full ${compact ? 'gap-1.5' : 'gap-5'}`}>
            <div
              className={`grid ${
                (slide.stats?.length || 1) === 1
                  ? 'grid-cols-1'
                  : (slide.stats?.length || 1) === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-3'
              } ${compact ? 'gap-1.5' : 'gap-5'}`}
            >
              {(slide.stats?.length ? slide.stats.slice(0, 3) : [{ value: '01', label: slide.title, context: '' }]).map(
                (st, idx) => (
                  <div
                    key={idx}
                    className={compact ? 'p-2 rounded border relative overflow-hidden' : 'p-6 rounded-xl border relative overflow-hidden'}
                    style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                  >
                    <div
                      className="absolute top-0 left-0 right-0"
                      style={{ height: compact ? 2 : 3, backgroundColor: theme.accentColor }}
                    />
                    <div
                      className="font-display font-bold tabular-nums tracking-tight"
                      style={{ color: theme.accentColor, fontSize: compact ? '14px' : '38px' }}
                    >
                      {st.value}
                    </div>
                    <div
                      className="font-semibold mt-1"
                      style={{ color: titleColor, fontSize: compact ? '8.5px' : '15px' }}
                    >
                      {st.label}
                    </div>
                    {st.context && !compact && (
                      <div className="mt-1 text-xs" style={{ color: theme.mutedColor }}>
                        {st.context}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
            {!compact && <div className="pt-1">{renderProseAndBullets()}</div>}
          </div>
        )}

        {slide.layout === 'timeline' && (
          <div className="relative flex flex-col justify-center h-full">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.min(4, slide.timeline?.length || 3)}, minmax(0, 1fr))`,
              }}
            >
              {(slide.timeline?.length
                ? slide.timeline.slice(0, 4)
                : slide.bullets.slice(0, 4).map((b, i) => ({ date: `Phase ${i + 1}`, title: b, description: '' }))
              ).map((item, idx) => (
                <div key={idx} className="flex flex-col">
                  <div
                    className={`font-mono font-semibold ${compact ? 'text-[7px] mb-1' : 'text-xs mb-2'}`}
                    style={{ color: theme.accentColor }}
                  >
                    {item.date}
                  </div>
                  <div className="flex items-center mb-2">
                    <div
                      className="rounded-full shrink-0"
                      style={{
                        width: compact ? 6 : 10,
                        height: compact ? 6 : 10,
                        backgroundColor: theme.accentColor,
                      }}
                    />
                    <div className="h-px flex-1" style={{ backgroundColor: theme.borderColor }} />
                  </div>
                  <div
                    className={compact ? 'p-1.5 rounded border flex-1' : 'p-4 rounded-xl border flex-1'}
                    style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                  >
                    <h4
                      className="font-semibold"
                      style={{ color: titleColor, fontSize: compact ? '8.5px' : '15px' }}
                    >
                      {item.title}
                    </h4>
                    {!compact && (
                      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: bodyColor }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide.layout === 'process-diagram' && (
          <div
            className={`grid ${compact ? 'gap-1.5' : 'gap-4'} items-stretch`}
            style={{
              gridTemplateColumns: `repeat(${Math.min(4, slide.processSteps?.length || 4)}, minmax(0, 1fr))`,
            }}
          >
            {(slide.processSteps?.length
              ? slide.processSteps.slice(0, 4)
              : slide.bullets.slice(0, 4).map((b, i) => ({ stepNumber: i + 1, title: `Step ${i + 1}`, description: b }))
            ).map((step, idx) => (
              <div
                key={idx}
                className={compact ? 'p-1.5 rounded border' : 'p-5 rounded-xl border flex flex-col justify-between'}
                style={{
                  backgroundColor: theme.surfaceBg,
                  borderColor: theme.accentColor,
                }}
              >
                <div>
                  <span
                    className={`font-mono font-semibold uppercase tracking-wider ${compact ? 'text-[7px]' : 'text-[11px]'}`}
                    style={{ color: theme.accentColor }}
                  >
                    Step {step.stepNumber || idx + 1}
                  </span>
                  <h4
                    className={`font-semibold ${compact ? 'mt-0.5' : 'mt-2 mb-2'}`}
                    style={{ color: titleColor, fontSize: compact ? '9px' : '16px' }}
                  >
                    {step.title}
                  </h4>
                  {!compact && (
                    <p className="text-xs leading-relaxed" style={{ color: bodyColor }}>
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.layout === 'quote-image' && (
          <div className={`grid grid-cols-12 ${compact ? 'gap-2' : 'gap-7'} h-full items-center`}>
            <div className="col-span-5 h-full min-h-0">
              <SlideImage
                url={slide.imageUrl}
                alt={slide.imageAlt}
                position={slide.imagePosition}
                theme={theme}
                className="w-full h-full"
              />
            </div>
            <div
              className={`col-span-7 h-full flex flex-col justify-center rounded-xl border ${compact ? 'p-2' : 'p-8'}`}
              style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
            >
              <blockquote
                className="italic leading-relaxed font-medium"
                style={{ color: titleColor, fontFamily: titleFont, fontSize: compact ? '9.5px' : '21px' }}
              >
                “{slide.quote?.text || slide.paragraphs[0] || slide.title}”
              </blockquote>
              {(slide.quote?.attribution || slide.subtitle) && (
                <cite
                  className={`not-italic font-semibold ${compact ? 'mt-1 text-[8px]' : 'mt-4 text-sm'}`}
                  style={{ color: theme.accentColor }}
                >
                  — {slide.quote?.attribution || slide.subtitle}
                </cite>
              )}
            </div>
          </div>
        )}

        {slide.layout === 'chart-analysis' && (
          <div className={`grid grid-cols-12 ${compact ? 'gap-2' : 'gap-6'} h-full items-center`}>
            <div
              className={`col-span-7 h-full rounded-xl border flex flex-col ${compact ? 'p-1.5' : 'p-4'}`}
              style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
            >
              <div
                className={`font-semibold ${compact ? 'text-[8px] mb-1' : 'text-xs mb-2'}`}
                style={{ color: titleColor }}
              >
                {slide.chartData?.title || 'Quantitative Overview'}
              </div>
              <div className="flex-1 min-h-0">
                {slide.chartData?.data?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {slide.chartData.type === 'line' ? (
                      <LineChart data={slide.chartData.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.borderColor} />
                        <XAxis dataKey="label" tick={{ fontSize: compact ? 7 : 11, fill: theme.mutedColor }} />
                        <YAxis tick={{ fontSize: compact ? 7 : 11, fill: theme.mutedColor }} />
                        {!compact && <Tooltip />}
                        <Line type="monotone" dataKey="value" stroke={theme.accentColor} strokeWidth={2.5} />
                      </LineChart>
                    ) : slide.chartData.type === 'pie' ? (
                      <PieChart>
                        <Pie
                          data={slide.chartData.data}
                          dataKey="value"
                          nameKey="label"
                          outerRadius={compact ? 28 : 85}
                          label={!compact}
                        >
                          {slide.chartData.data.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={[theme.accentColor, '#0F172A', '#059669', '#D97706', '#6366F1'][idx % 5]}
                            />
                          ))}
                        </Pie>
                        {!compact && <Tooltip />}
                      </PieChart>
                    ) : (
                      <BarChart data={slide.chartData.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.borderColor} />
                        <XAxis dataKey="label" tick={{ fontSize: compact ? 7 : 11, fill: theme.mutedColor }} />
                        <YAxis tick={{ fontSize: compact ? 7 : 11, fill: theme.mutedColor }} />
                        {!compact && <Tooltip />}
                        <Bar dataKey="value" fill={theme.accentColor} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs" style={{ color: theme.mutedColor }}>
                    Add chart data points in Visuals panel
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-5 overflow-y-auto max-h-full">{renderProseAndBullets()}</div>
          </div>
        )}

        {slide.layout === 'closing-summary' && (
          <div
            className={`rounded-xl border h-full flex flex-col relative overflow-hidden ${compact ? 'p-2 justify-center overflow-hidden' : 'p-7 md:p-8 overflow-y-auto'}`}
            style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
          >
            <div
              className="absolute top-0 left-0 right-0"
              style={{ height: compact ? 2 : 3, backgroundColor: theme.accentColor }}
            />
            <div className={compact ? 'space-y-1' : 'my-auto space-y-4'}>
              {slide.paragraphs.map((p, idx) =>
                editable && onUpdate ? (
                  <textarea
                    key={`cp-${idx}`}
                    value={p}
                    rows={2}
                    onChange={(e) => updateParagraph(idx, e.target.value)}
                    className="w-full bg-transparent resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1 -mx-1"
                    style={{ color: bodyColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
                  />
                ) : (
                  <p
                    key={`cp-${idx}`}
                    className="leading-relaxed"
                    style={{ color: bodyColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
                  >
                    {p}
                  </p>
                )
              )}

              {slide.bullets.length > 0 && (
                <div className={compact ? 'space-y-1' : 'space-y-2.5 pt-1'}>
                  {slide.bullets.map((b, idx) => (
                    <div
                      key={`cb-${idx}`}
                      className={`flex items-start gap-3 ${compact ? '' : 'p-3 rounded-lg border'}`}
                      style={
                        compact
                          ? undefined
                          : { backgroundColor: bg, borderColor: theme.borderColor }
                      }
                    >
                      <span
                        className={`font-mono font-bold shrink-0 tabular-nums ${compact ? 'text-[7px]' : 'text-xs mt-0.5'}`}
                        style={{ color: theme.accentColor }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {editable && onUpdate ? (
                        <input
                          type="text"
                          value={b}
                          onChange={(e) => updateBullet(idx, e.target.value)}
                          className="flex-1 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded px-1 -mx-1"
                          style={{ color: bodyColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
                        />
                      ) : (
                        <span
                          className="leading-snug flex-1"
                          style={{ color: titleColor, fontFamily: bodyFont, fontSize: `${bodyPx}px` }}
                        >
                          {b}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Shapes Overlay */}
      {!compact &&
        (slide.shapes || []).map((sh) => (
          <div
            key={sh.id}
            className="absolute flex items-center justify-center text-xs font-semibold text-white shadow-sm pointer-events-none"
            style={{
              left: `${sh.x}%`,
              top: `${sh.y}%`,
              width: `${sh.w}%`,
              height: `${sh.h}%`,
              backgroundColor: sh.color,
              borderRadius: sh.type === 'circle' ? '9999px' : '10px',
              opacity: 0.92,
            }}
          >
            {sh.label}
          </div>
        ))}

      {/* Footer */}
      {!compact && (
        <div
          className="shrink-0 pt-2 mt-3 flex items-center justify-between text-[11px] tabular-nums"
          style={{ color: theme.mutedColor }}
        >
          <span className="truncate max-w-[65%]">{deckTitle}</span>
          <span>
            {slideIndex + 1} / {totalSlides}
          </span>
        </div>
      )}
    </div>
  );
};
