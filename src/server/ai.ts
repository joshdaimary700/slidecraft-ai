import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import crypto from 'crypto';
import { CURATED_VISUALS } from '../shared/types.ts';
import type { DocumentSection, SlideData, SlideLayout } from '../shared/types.ts';
import { db } from './db.ts';
import { parsePlainTextToSections } from './docParser.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to enable AI generation.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_LAYOUTS: SlideLayout[] = [
  'full-image-title',
  'image-left',
  'image-right',
  'two-column-comparison',
  'three-column-cards',
  'stat-highlight',
  'timeline',
  'process-diagram',
  'quote-image',
  'chart-analysis',
  'closing-summary',
];

function resolveVisualUrl(visualCategory?: string, slideIdx = 0): { url: string; alt: string } {
  const cat = (visualCategory || '').toLowerCase();
  let match = CURATED_VISUALS.find(
    (v) =>
      cat.includes(v.id) ||
      cat.includes(v.category.toLowerCase()) ||
      (cat.includes('church') && v.id === 'ministry') ||
      (cat.includes('bible') && v.id === 'ministry') ||
      (cat.includes('environment') && v.id === 'climate') ||
      (cat.includes('nature') && v.id === 'climate') ||
      (cat.includes('health') && v.id === 'climate') ||
      (cat.includes('ai') && v.id === 'tech-ai') ||
      (cat.includes('research') && v.id === 'education') ||
      (cat.includes('school') && v.id === 'education')
  );
  if (!match) {
    match = CURATED_VISUALS[slideIdx % CURATED_VISUALS.length];
  }
  return { url: match.url, alt: match.label };
}

function logAIRequest(params: {
  userId: string;
  presentationId?: string;
  requestType: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  durationMs: number;
}) {
  const estimatedCostUsd = Number(
    ((params.inputTokens * 0.00000015 + params.outputTokens * 0.0000006)).toFixed(6)
  );
  db.prepare(`
    INSERT INTO AIRequests (
      id, userId, presentationId, requestType, modelUsed, inputTokens, outputTokens, estimatedCostUsd, status, errorMessage, durationMs, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aireq_${crypto.randomUUID()}`,
    params.userId,
    params.presentationId || null,
    params.requestType,
    params.modelUsed,
    params.inputTokens,
    params.outputTokens,
    estimatedCostUsd,
    params.status,
    params.errorMessage || '',
    params.durationMs,
    new Date().toISOString()
  );
}

const SLIDE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    deckTitle: { type: Type.STRING },
    recommendedThemeId: { type: Type.STRING },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          layout: { type: Type.STRING },
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          paragraphs: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          bullets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          visualCategory: { type: Type.STRING },
          imageAlt: { type: Type.STRING },
          stats: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                label: { type: Type.STRING },
                context: { type: Type.STRING },
              },
            },
          },
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          processSteps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stepNumber: { type: Type.INTEGER },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          comparison: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                heading: { type: Type.STRING },
                points: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          featureCards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          quote: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              attribution: { type: Type.STRING },
            },
          },
          chartData: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              title: { type: Type.STRING },
              unit: { type: Type.STRING },
              seriesName: { type: Type.STRING },
              data: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
          speakerNotes: { type: Type.STRING },
        },
        required: ['layout', 'title', 'paragraphs', 'bullets'],
      },
    },
  },
  required: ['deckTitle', 'slides'],
};

export interface GenerateDeckParams {
  userId: string;
  presentationId: string;
  sourceType: 'topic' | 'text' | 'document' | 'outline';
  content: string;
  slideCount: number;
  audience: string;
  purpose: string;
  writingStyle: string;
  language: string;
  aspectRatio: '16:9' | '4:3';
  includeSpeakerNotes: boolean;
  includeCharts: boolean;
  preferredThemeId?: string;
  templateName?: string;
  templateCategory?: string;
  templateDescription?: string;
  templateImageUrl?: string;
  templateLayouts?: SlideLayout[];
  selectedImageUrls?: string[];
}

function buildTemplateLayoutSequence(
  slideCount: number,
  includeCharts: boolean,
  templateLayouts?: SlideLayout[]
): SlideLayout[] {
  const defaultInterior: SlideLayout[] = includeCharts
    ? [
        'stat-highlight',
        'three-column-cards',
        'image-right',
        'process-diagram',
        'two-column-comparison',
        'chart-analysis',
        'timeline',
        'image-left',
      ]
    : [
        'three-column-cards',
        'image-right',
        'process-diagram',
        'two-column-comparison',
        'timeline',
        'image-left',
        'quote-image',
      ];

  const customInterior = (templateLayouts || []).filter(
    (l) =>
      VALID_LAYOUTS.includes(l) &&
      l !== 'full-image-title' &&
      l !== 'closing-summary' &&
      (includeCharts || (l !== 'chart-analysis' && l !== 'stat-highlight'))
  );

  // Combine template's signature layouts first, then remaining executive layouts for variety on long decks
  const pool: SlideLayout[] = [];
  for (const l of [...customInterior, ...defaultInterior]) {
    if (!pool.includes(l)) pool.push(l);
  }

  const sequence: SlideLayout[] = [];
  for (let i = 0; i < slideCount; i++) {
    if (i === 0) {
      sequence.push('full-image-title');
    } else if (i === slideCount - 1 && slideCount >= 2) {
      sequence.push('closing-summary');
    } else {
      sequence.push(pool[(i - 1) % pool.length]);
    }
  }
  return sequence;
}

export async function generatePresentationDeck(params: GenerateDeckParams): Promise<{
  deckTitle: string;
  recommendedThemeId: string;
  slides: Omit<SlideData, 'id' | 'presentationId' | 'slideOrder'>[];
}> {
  const start = Date.now();
  const model = 'gemini-4-hydrogen';

  try {
    const ai = getClient();

    const allowedLayoutsText = params.includeCharts
      ? VALID_LAYOUTS.join(', ')
      : VALID_LAYOUTS.filter((l) => l !== 'chart-analysis').join(', ');

    const layoutPlan = buildTemplateLayoutSequence(
      params.slideCount,
      params.includeCharts,
      params.templateLayouts
    );
    const layoutPlanGuide = layoutPlan
      .map((l, idx) => `Slide ${idx + 1}: "${l}"`)
      .join(' | ');

    const systemInstruction = `You are SlideCraft AI, a senior editorial presentation architect.
Your task is to generate a clean, executive-grade presentation deck in structured JSON that works cohesively from Slide 1 all the way to the final slide.

STRICT RULES:
1. Generate EXACTLY ${params.slideCount} slides.
2. Write ALL slide titles, subtitles, paragraphs, bullets, diagrams, and speaker notes in ${params.language}.
3. Target audience: ${params.audience}. Purpose: ${params.purpose}. Writing style: ${params.writingStyle}.
4. Do NOT overcrowd slides: keep paragraphs concise (1-2 crisp sentences), bullets short (max 4-5 bullets per slide, under 14 words each).
5. Follow this exact end-to-end slide layout blueprint (using ONLY valid layout keys: ${allowedLayoutsText}):
   ${layoutPlanGuide}
   - Slide 1 must use "full-image-title".
   - Final slide must use "closing-summary" with a strong executive wrap-up and 3-5 actionable takeaway bullets.
   - Every middle slide MUST populate the matching structured fields for its layout so NO slide is ever sparse:
     * "two-column-comparison" -> populate comparison (2 columns, 3-4 points each)
     * "three-column-cards" -> populate featureCards (3 cards with title & description)
     * "stat-highlight" -> populate stats (2-3 grounded metrics; NEVER fabricate statistics or citations) + 1 short summary paragraph
     * "timeline" -> populate timeline (3-4 chronological milestones)
     * "process-diagram" -> populate processSteps (3-4 sequential steps with stepNumber 1..N)
     * "quote-image" -> populate quote ({ text, attribution }) ONLY with genuine, accurately attributed quotes or verified historical/scripture text; NEVER invent quotes
     * "chart-analysis" -> populate chartData ONLY when numerical data is explicitly provided in the source or established public reference data; if no grounded numbers apply, use "image-right" instead
6. For visualCategory on each slide, choose the closest fit from: "studio" (business/strategy/workshop), "tech-ai" (AI/technology/systems), "education" (academic/research/school), "climate" (environment/nature/health/recovery), "ministry" (church/biblical/history/community).
7. ${params.includeSpeakerNotes ? 'Include helpful, natural 2-3 sentence speakerNotes on every slide.' : 'Set speakerNotes to empty string "".'}
8. Recommended themeId should be one of: navy-indigo, royal-violet, obsidian-night, emerald-earth, crimson-academic, warm-sanctuary, nordic-minimal, midnight-gold, teal-clinical, sunset-editorial, cyber-emerald, plum-keynote, ocean-corporate, sage-botanical, monochrome-swiss, sapphire-gradient.${
      params.templateName
        ? `\n9. TEMPLATE DESIGN STYLE SELECTED: "${params.templateName}" (${params.templateCategory || 'General'}). Design intent: ${params.templateDescription || 'Executive presentation rhythm'}. Carry this template's visual voice, cohesive storytelling, and executive pacing across EVERY slide from Slide 1 through Slide ${params.slideCount}.`
        : ''
    }`;

    const trimmedSource = params.content.slice(0, 28000);
    const promptByType: Record<string, string> = {
      topic: `Create a comprehensive, well-structured ${params.slideCount}-slide presentation on the topic:\n"${trimmedSource}"`,
      text: `Transform the following source notes/text into a well-organized ${params.slideCount}-slide presentation without losing key concepts or accuracy:\n\n${trimmedSource}`,
      document: `Analyze the following extracted document text and transform its actual content into a faithful, well-structured ${params.slideCount}-slide presentation:\n\n${trimmedSource}`,
      outline: `Develop the following presentation outline into a complete, rich ${params.slideCount}-slide presentation:\n\n${trimmedSource}`,
    };

    const response = await ai.models.generateContent({
      model,
      contents: promptByType[params.sourceType] || promptByType.topic,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: SLIDE_RESPONSE_SCHEMA,
        thinkingConfig: {
          thinkingLevel: params.slideCount > 15 ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
        },
      },
    });

    const rawText = (response.text || '{}').trim();
    const parsed = JSON.parse(rawText);
    const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];

    if (rawSlides.length === 0) {
      throw new Error('AI returned an empty slide set. Please try refining your prompt.');
    }

    const totalReturned = Math.min(params.slideCount, rawSlides.length);
    const slides: Omit<SlideData, 'id' | 'presentationId' | 'slideOrder'>[] = rawSlides
      .slice(0, params.slideCount)
      .map((s: any, idx: number) => {
        const plannedLayout = layoutPlan[idx];
        let layout: SlideLayout =
          idx === 0
            ? 'full-image-title'
            : idx === totalReturned - 1 && totalReturned >= 2
              ? 'closing-summary'
              : VALID_LAYOUTS.includes(s.layout)
                ? s.layout
                : plannedLayout || 'image-right';

        const paragraphs: string[] = Array.isArray(s.paragraphs) ? s.paragraphs.map(String).filter(Boolean) : [];
        const bullets: string[] = Array.isArray(s.bullets) ? s.bullets.map(String).filter(Boolean) : [];
        let stats = Array.isArray(s.stats) && s.stats.length > 0 ? s.stats : undefined;
        let timeline = Array.isArray(s.timeline) && s.timeline.length > 0 ? s.timeline : undefined;
        let processSteps =
          Array.isArray(s.processSteps) && s.processSteps.length > 0 ? s.processSteps : undefined;
        let comparison =
          Array.isArray(s.comparison) && s.comparison.length > 0 ? s.comparison : undefined;
        let featureCards =
          Array.isArray(s.featureCards) && s.featureCards.length > 0 ? s.featureCards : undefined;
        const quote = s.quote?.text ? s.quote : undefined;
        const chartData =
          params.includeCharts && s.chartData?.data?.length > 0
            ? {
                type: (['bar', 'line', 'pie'].includes(s.chartData.type)
                  ? s.chartData.type
                  : 'bar') as 'bar' | 'line' | 'pie',
                title: String(s.chartData.title || s.title || 'Data Overview'),
                unit: s.chartData.unit ? String(s.chartData.unit) : undefined,
                seriesName: String(s.chartData.seriesName || 'Value'),
                data: s.chartData.data.map((d: any) => ({
                  label: String(d.label || ''),
                  value: Number(d.value) || 0,
                })),
              }
            : null;

        // Hydrate structured layouts cleanly if AI returned bullets without nested objects, or degrade gracefully
        if (layout === 'chart-analysis' && !chartData) {
          layout = idx % 2 === 0 ? 'image-left' : 'image-right';
        }
        if (layout === 'quote-image' && !quote && paragraphs.length === 0) {
          layout = 'image-right';
        }
        if (layout === 'stat-highlight' && !stats) {
          layout = featureCards ? 'three-column-cards' : 'image-right';
        }
        if (layout === 'three-column-cards' && !featureCards && bullets.length >= 2) {
          featureCards = bullets.slice(0, 3).map((b: string, bIdx: number) => ({
            title: `Focus 0${bIdx + 1}`,
            description: b,
          }));
        }
        if (layout === 'process-diagram' && !processSteps && bullets.length >= 2) {
          processSteps = bullets.slice(0, 4).map((b: string, bIdx: number) => ({
            stepNumber: bIdx + 1,
            title: `Step ${bIdx + 1}`,
            description: b,
          }));
        }
        if (layout === 'timeline' && !timeline && bullets.length >= 2) {
          timeline = bullets.slice(0, 4).map((b: string, bIdx: number) => ({
            date: `Phase ${bIdx + 1}`,
            title: b.slice(0, 48),
            description: b,
          }));
        }
        if (layout === 'two-column-comparison' && !comparison && bullets.length >= 2) {
          const mid = Math.ceil(bullets.length / 2);
          comparison = [
            { heading: 'Core Aspect A', points: bullets.slice(0, mid) },
            { heading: 'Core Aspect B', points: bullets.slice(mid) },
          ];
        }

        const visual = resolveVisualUrl(s.visualCategory || params.templateCategory, idx);
        const userPickedUrl =
          params.selectedImageUrls && params.selectedImageUrls.length > 0
            ? params.selectedImageUrls[idx % params.selectedImageUrls.length]
            : undefined;

        return {
          layout,
          title: String(s.title || `Slide ${idx + 1}`).trim(),
          subtitle: String(s.subtitle || '').trim(),
          paragraphs,
          bullets,
          stats,
          timeline,
          processSteps,
          comparison,
          featureCards,
          quote,
          chartData,
          imageUrl:
            userPickedUrl || (idx === 0 && params.templateImageUrl ? params.templateImageUrl : visual.url),
          imageAlt: String(s.imageAlt || visual.alt),
          imagePosition: { x: 0, y: 0, scale: 1 },
          speakerNotes: params.includeSpeakerNotes ? String(s.speakerNotes || '') : '',
          shapes: [],
        };
      });

    const usageMeta = (response as any).usageMetadata;
    logAIRequest({
      userId: params.userId,
      presentationId: params.presentationId,
      requestType: `generate_${params.sourceType}`,
      modelUsed: model,
      inputTokens: usageMeta?.promptTokenCount || Math.ceil(trimmedSource.length / 4),
      outputTokens: usageMeta?.candidatesTokenCount || Math.ceil(rawText.length / 4),
      status: 'SUCCESS',
      durationMs: Date.now() - start,
    });

    return {
      deckTitle: String(parsed.deckTitle || params.content.slice(0, 80)).trim(),
      recommendedThemeId: params.preferredThemeId || String(parsed.recommendedThemeId || 'navy-indigo'),
      slides,
    };
  } catch (err: any) {
    logAIRequest({
      userId: params.userId,
      presentationId: params.presentationId,
      requestType: `generate_${params.sourceType}`,
      modelUsed: model,
      inputTokens: 0,
      outputTokens: 0,
      status: 'FAILED',
      errorMessage: err?.message || 'Unknown AI generation failure',
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

export type SlideAssistAction =
  | 'improve'
  | 'rewrite'
  | 'grammar'
  | 'simplify'
  | 'expand'
  | 'shorten'
  | 'more-bullets'
  | 'tone'
  | 'redesign'
  | 'speaker-notes'
  | 'suggest-image';

export async function assistSlide(params: {
  userId: string;
  presentationId: string;
  slide: SlideData;
  action: SlideAssistAction;
  targetTone?: string;
  language?: string;
}): Promise<Partial<SlideData>> {
  const start = Date.now();
  const model = 'gemini-4-hydrogen';

  try {
    const ai = getClient();

    const actionGuides: Record<SlideAssistAction, string> = {
      improve:
        'Holistically improve clarity, visual layout selection, executive phrasing, and bullet precision while preserving factual accuracy.',
      rewrite: 'Rewrite the title, subtitle, paragraphs, and bullets with fresh, engaging phrasing.',
      grammar: 'Fix all grammar, spelling, and punctuation issues cleanly without altering meaning.',
      simplify: 'Simplify complex terminology into plain, crystal-clear language accessible to general readers.',
      expand: 'Expand the slide explanation with richer context and clearer supporting points.',
      shorten: 'Condense paragraphs and bullets to be crisp, scannable, and high-impact.',
      'more-bullets': 'Keep existing points and generate 2-3 additional high-value bullet points.',
      tone: `Adapt the entire slide writing tone to be ${params.targetTone || 'Executive & Persuasive'}.`,
      redesign: `Select a better, cleaner slide layout from (${VALID_LAYOUTS.join(', ')}) and structure its matching fields (processSteps, comparison, featureCards, timeline, or bullets).`,
      'speaker-notes': 'Generate detailed, natural presenter speaker notes (3-5 sentences) for this slide.',
      'suggest-image':
        'Recommend the best visualCategory ("studio", "tech-ai", "education", "climate", "ministry") and descriptive imageAlt for this slide.',
    };

    const response = await ai.models.generateContent({
      model,
      contents: `Current slide JSON:\n${JSON.stringify({
        layout: params.slide.layout,
        title: params.slide.title,
        subtitle: params.slide.subtitle,
        paragraphs: params.slide.paragraphs,
        bullets: params.slide.bullets,
        comparison: params.slide.comparison,
        featureCards: params.slide.featureCards,
        processSteps: params.slide.processSteps,
        timeline: params.slide.timeline,
        speakerNotes: params.slide.speakerNotes,
      })}\n\nAction requested: ${actionGuides[params.action]}\nLanguage: ${params.language || 'English'}. Never invent fake statistics or citations.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            layout: { type: Type.STRING },
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
            bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualCategory: { type: Type.STRING },
            imageAlt: { type: Type.STRING },
            speakerNotes: { type: Type.STRING },
            processSteps: SLIDE_RESPONSE_SCHEMA.properties.slides.items.properties.processSteps,
            comparison: SLIDE_RESPONSE_SCHEMA.properties.slides.items.properties.comparison,
            featureCards: SLIDE_RESPONSE_SCHEMA.properties.slides.items.properties.featureCards,
            timeline: SLIDE_RESPONSE_SCHEMA.properties.slides.items.properties.timeline,
          },
          required: ['title', 'paragraphs', 'bullets'],
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const raw = (response.text || '{}').trim();
    const updated = JSON.parse(raw);

    const patch: Partial<SlideData> = {
      title: updated.title || params.slide.title,
      subtitle: updated.subtitle ?? params.slide.subtitle,
      paragraphs: Array.isArray(updated.paragraphs) ? updated.paragraphs : params.slide.paragraphs,
      bullets: Array.isArray(updated.bullets) ? updated.bullets : params.slide.bullets,
      speakerNotes: updated.speakerNotes ?? params.slide.speakerNotes,
    };

    if (params.action === 'redesign' || params.action === 'improve') {
      if (updated.layout && VALID_LAYOUTS.includes(updated.layout)) {
        patch.layout = updated.layout;
      }
      if (Array.isArray(updated.processSteps) && updated.processSteps.length > 0) {
        patch.processSteps = updated.processSteps;
      }
      if (Array.isArray(updated.comparison) && updated.comparison.length > 0) {
        patch.comparison = updated.comparison;
      }
      if (Array.isArray(updated.featureCards) && updated.featureCards.length > 0) {
        patch.featureCards = updated.featureCards;
      }
      if (Array.isArray(updated.timeline) && updated.timeline.length > 0) {
        patch.timeline = updated.timeline;
      }
    }

    if (params.action === 'suggest-image' || params.action === 'improve') {
      if (updated.visualCategory) {
        const resolved = resolveVisualUrl(updated.visualCategory, params.slide.slideOrder);
        patch.imageUrl = resolved.url;
        patch.imageAlt = updated.imageAlt || resolved.alt;
      }
    }

    const usageMeta = (response as any).usageMetadata;
    logAIRequest({
      userId: params.userId,
      presentationId: params.presentationId,
      requestType: `assist_${params.action}`,
      modelUsed: model,
      inputTokens: usageMeta?.promptTokenCount || 300,
      outputTokens: usageMeta?.candidatesTokenCount || 250,
      status: 'SUCCESS',
      durationMs: Date.now() - start,
    });

    return patch;
  } catch (err: any) {
    logAIRequest({
      userId: params.userId,
      presentationId: params.presentationId,
      requestType: `assist_${params.action}`,
      modelUsed: model,
      inputTokens: 0,
      outputTokens: 0,
      status: 'FAILED',
      errorMessage: err?.message || 'Slide assist error',
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

export async function generateSingleSlideOrSummary(params: {
  userId: string;
  presentationId: string;
  mode: 'new-slide' | 'summarize' | 'conclusion';
  deckTitle: string;
  language: string;
  prompt?: string;
  existingTitles: string[];
}): Promise<Omit<SlideData, 'id' | 'presentationId' | 'slideOrder'>> {
  const start = Date.now();
  const model = 'gemini-4-hydrogen';

  try {
    const ai = getClient();
    const instructionMap = {
      'new-slide': `Generate ONE new presentation slide for the deck "${params.deckTitle}" about: "${params.prompt || 'Additional key insight'}". Existing slide titles: ${params.existingTitles.join(' | ')}.`,
      summarize: `Generate ONE executive summary slide summarizing the key takeaways of the deck "${params.deckTitle}" covering: ${params.existingTitles.join(' | ')}.`,
      conclusion: `Generate ONE impactful closing conclusion slide (layout: "closing-summary") for the deck "${params.deckTitle}" covering: ${params.existingTitles.join(' | ')}.`,
    };

    const response = await ai.models.generateContent({
      model,
      contents: `${instructionMap[params.mode]}\nWrite in ${params.language}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: SLIDE_RESPONSE_SCHEMA.properties.slides.items,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const layout: SlideLayout = VALID_LAYOUTS.includes(parsed.layout)
      ? parsed.layout
      : params.mode === 'conclusion'
        ? 'closing-summary'
        : 'image-right';
    const visual = resolveVisualUrl(parsed.visualCategory, params.existingTitles.length);

    const usageMeta = (response as any).usageMetadata;
    logAIRequest({
      userId: params.userId,
      presentationId: params.presentationId,
      requestType: `deck_${params.mode}`,
      modelUsed: model,
      inputTokens: usageMeta?.promptTokenCount || 250,
      outputTokens: usageMeta?.candidatesTokenCount || 250,
      status: 'SUCCESS',
      durationMs: Date.now() - start,
    });

    return {
      layout,
      title: String(parsed.title || 'New Slide'),
      subtitle: String(parsed.subtitle || ''),
      paragraphs: Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [],
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
      featureCards: Array.isArray(parsed.featureCards) ? parsed.featureCards : undefined,
      processSteps: Array.isArray(parsed.processSteps) ? parsed.processSteps : undefined,
      comparison: Array.isArray(parsed.comparison) ? parsed.comparison : undefined,
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : undefined,
      quote: parsed.quote?.text ? parsed.quote : undefined,
      imageUrl: visual.url,
      imageAlt: String(parsed.imageAlt || visual.alt),
      imagePosition: { x: 0, y: 0, scale: 1 },
      speakerNotes: String(parsed.speakerNotes || ''),
      shapes: [],
    };
  } catch (err: any) {
    logAIRequest({
      userId: params.userId,
      presentationId: params.presentationId,
      requestType: `deck_${params.mode}`,
      modelUsed: model,
      inputTokens: 0,
      outputTokens: 0,
      status: 'FAILED',
      errorMessage: err?.message || 'Deck assist error',
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

export function buildVerbatimDeck(params: {
  content: string;
  sections?: DocumentSection[];
  requestedSlideCount?: number;
  matchSourceSlides?: boolean;
  preferredThemeId?: string;
  preferredImageUrl?: string;
  selectedImageUrls?: string[];
  fallbackTitle?: string;
  maxSlidesAllowed?: number;
}): {
  deckTitle: string;
  recommendedThemeId: string;
  slides: Omit<SlideData, 'id' | 'presentationId' | 'slideOrder'>[];
} {
  const maxLimit = Math.max(1, Math.min(50, params.maxSlidesAllowed || 50));

  let sourceSections: DocumentSection[] = [];
  if (Array.isArray(params.sections) && params.sections.length > 0) {
    sourceSections = params.sections
      .map((s, idx) => ({
        title: String(s.title || `Slide ${idx + 1}`).trim(),
        paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map((p) => String(p).trim()).filter(Boolean) : [],
        bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b).trim()).filter(Boolean) : [],
      }))
      .filter((s) => s.title || s.paragraphs.length > 0 || s.bullets.length > 0);
  }

  if (sourceSections.length === 0) {
    sourceSections = parsePlainTextToSections(params.content, params.fallbackTitle || 'Slide');
  }

  if (sourceSections.length === 0) {
    throw new Error('No readable content found to create slides.');
  }

  const targetCount = params.matchSourceSlides
    ? Math.min(maxLimit, sourceSections.length)
    : Math.max(1, Math.min(maxLimit, params.requestedSlideCount || sourceSections.length));

  let finalSections: DocumentSection[] = [];

  if (targetCount === sourceSections.length) {
    finalSections = sourceSections;
  } else if (targetCount < sourceSections.length) {
    // Evenly group sections into targetCount buckets without dropping any line
    const buckets: DocumentSection[][] = Array.from({ length: targetCount }, () => []);
    for (let i = 0; i < sourceSections.length; i++) {
      const bucketIdx = Math.min(targetCount - 1, Math.floor((i * targetCount) / sourceSections.length));
      buckets[bucketIdx].push(sourceSections[i]);
    }
    finalSections = buckets
      .filter((b) => b.length > 0)
      .map((bucket) => {
        const first = bucket[0];
        const paragraphs = [...first.paragraphs];
        const bullets = [...first.bullets];
        for (let j = 1; j < bucket.length; j++) {
          const extra = bucket[j];
          if (extra.title) paragraphs.push(extra.title);
          paragraphs.push(...extra.paragraphs);
          bullets.push(...extra.bullets);
        }
        return {
          title: first.title,
          paragraphs,
          bullets,
        };
      });
  } else {
    // targetCount > sourceSections.length: split multi-item sections or sentences across slides without adding any words
    const expanded: DocumentSection[] = [];
    for (const sec of sourceSections) {
      const items: Array<{ kind: 'p' | 'b'; text: string }> = [
        ...sec.paragraphs.map((text) => ({ kind: 'p' as const, text })),
        ...sec.bullets.map((text) => ({ kind: 'b' as const, text })),
      ];

      // If single paragraph is long prose and we need more slides, split only at sentence boundaries
      if (items.length <= 1 && sourceSections.length < targetCount) {
        const singleText = items[0]?.text || '';
        const sentences = singleText
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (sentences.length > 1) {
          items.splice(
            0,
            items.length,
            ...sentences.map((text) => ({ kind: items[0]?.kind || ('p' as const), text }))
          );
        }
      }

      if (items.length <= 1) {
        expanded.push(sec);
      } else {
        // Keep section title + chunk items only as needed later
        expanded.push({
          title: sec.title,
          paragraphs: items.filter((it) => it.kind === 'p').map((it) => it.text),
          bullets: items.filter((it) => it.kind === 'b').map((it) => it.text),
        });
      }
    }

    // Iteratively split the largest section until we reach targetCount or cannot split further
    while (expanded.length < targetCount) {
      let bestIdx = -1;
      let bestItemCount = 1;
      for (let i = 0; i < expanded.length; i++) {
        const count = expanded[i].paragraphs.length + expanded[i].bullets.length;
        if (count > bestItemCount) {
          bestItemCount = count;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;

      const sec = expanded[bestIdx];
      const combined: Array<{ kind: 'p' | 'b'; text: string }> = [
        ...sec.paragraphs.map((text) => ({ kind: 'p' as const, text })),
        ...sec.bullets.map((text) => ({ kind: 'b' as const, text })),
      ];
      const mid = Math.ceil(combined.length / 2);
      const firstHalf = combined.slice(0, mid);
      const secondHalf = combined.slice(mid);

      // Promote first item of second half to title if it is concise, otherwise preserve section title verbatim
      let secondTitle = sec.title;
      let secondItems = secondHalf;
      if (secondHalf.length > 1 && secondHalf[0].text.length <= 110) {
        secondTitle = secondHalf[0].text;
        secondItems = secondHalf.slice(1);
      }

      const firstSec: DocumentSection = {
        title: sec.title,
        paragraphs: firstHalf.filter((it) => it.kind === 'p').map((it) => it.text),
        bullets: firstHalf.filter((it) => it.kind === 'b').map((it) => it.text),
      };
      const secondSec: DocumentSection = {
        title: secondTitle,
        paragraphs: secondItems.filter((it) => it.kind === 'p').map((it) => it.text),
        bullets: secondItems.filter((it) => it.kind === 'b').map((it) => it.text),
      };
      expanded.splice(bestIdx, 1, firstSec, secondSec);
    }

    finalSections = expanded;
  }

  const hasUserSelectedPictures =
    Array.isArray(params.selectedImageUrls) && params.selectedImageUrls.length > 0;

  const slides: Omit<SlideData, 'id' | 'presentationId' | 'slideOrder'>[] = finalSections.map((sec, idx) => {
    const isCleanTitleCover =
      idx === 0 &&
      sec.bullets.length === 0 &&
      sec.paragraphs.length <= 1 &&
      (sec.paragraphs[0]?.length || 0) <= 180;

    const visual = CURATED_VISUALS[idx % CURATED_VISUALS.length];
    const userPickedUrl = hasUserSelectedPictures
      ? params.selectedImageUrls![idx % params.selectedImageUrls!.length]
      : undefined;

    const layout: SlideLayout = isCleanTitleCover
      ? 'full-image-title'
      : hasUserSelectedPictures
        ? idx % 2 === 1
          ? 'image-right'
          : 'image-left'
        : 'closing-summary';

    return {
      layout,
      title: sec.title,
      subtitle: '',
      paragraphs: sec.paragraphs,
      bullets: sec.bullets,
      imageUrl: userPickedUrl || (idx === 0 && params.preferredImageUrl ? params.preferredImageUrl : visual.url),
      imageAlt: visual.label,
      imagePosition: { x: 0, y: 0, scale: 1 },
      speakerNotes: '',
      shapes: [],
    };
  });

  const cleanDeckTitle = (
    finalSections[0]?.title ||
    params.fallbackTitle ||
    'Uploaded Presentation'
  )
    .slice(0, 120)
    .trim();

  return {
    deckTitle: cleanDeckTitle,
    recommendedThemeId: params.preferredThemeId || 'navy-indigo',
    slides,
  };
}
