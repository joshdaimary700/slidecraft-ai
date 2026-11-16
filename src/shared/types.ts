export type UserRole = 'USER' | 'ADMIN' | 'FOUNDER';

export type PlanCode = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'FOUNDER_LIFETIME';
export type BillingCycle = 'MONTHLY' | 'ANNUAL' | 'LIFETIME';

export type SlideLayout =
  | 'full-image-title'
  | 'image-left'
  | 'image-right'
  | 'two-column-comparison'
  | 'three-column-cards'
  | 'stat-highlight'
  | 'timeline'
  | 'process-diagram'
  | 'quote-image'
  | 'chart-analysis'
  | 'closing-summary';

export type AspectRatio = '16:9' | '4:3';

export interface DocumentSection {
  title: string;
  paragraphs: string[];
  bullets: string[];
}

export interface ThemeConfig {
  id: string;
  name: string;
  canvasBg: string;
  surfaceBg: string;
  titleColor: string;
  bodyColor: string;
  mutedColor: string;
  accentColor: string;
  borderColor: string;
  isDark: boolean;
  titleFont: string;
  bodyFont: string;
}

export const PRESENTATION_THEMES: ThemeConfig[] = [
  {
    id: 'navy-indigo',
    name: 'Executive Navy',
    canvasBg: '#FFFFFF',
    surfaceBg: '#F8FAFC',
    titleColor: '#0F172A',
    bodyColor: '#334155',
    mutedColor: '#64748B',
    accentColor: '#4F46E5',
    borderColor: '#E2E8F0',
    isDark: false,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'royal-violet',
    name: 'Studio Violet',
    canvasBg: '#FAFAFF',
    surfaceBg: '#F3F0FF',
    titleColor: '#1E1B4B',
    bodyColor: '#374151',
    mutedColor: '#6B7280',
    accentColor: '#6D28D9',
    borderColor: '#E5E7EB',
    isDark: false,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'obsidian-night',
    name: 'Obsidian Slate',
    canvasBg: '#0F172A',
    surfaceBg: '#1E293B',
    titleColor: '#F8FAFC',
    bodyColor: '#CBD5E1',
    mutedColor: '#94A3B8',
    accentColor: '#818CF8',
    borderColor: '#334155',
    isDark: true,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'emerald-earth',
    name: 'Forest & Solar',
    canvasBg: '#FFFFFF',
    surfaceBg: '#F0FDF4',
    titleColor: '#064E3B',
    bodyColor: '#334155',
    mutedColor: '#64748B',
    accentColor: '#059669',
    borderColor: '#D1FAE5',
    isDark: false,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'crimson-academic',
    name: 'Academic Monograph',
    canvasBg: '#FAFAF9',
    surfaceBg: '#F5F5F4',
    titleColor: '#1C1917',
    bodyColor: '#44403C',
    mutedColor: '#78716C',
    accentColor: '#991B1B',
    borderColor: '#E7E5E4',
    isDark: false,
    titleFont: 'Georgia',
    bodyFont: 'DM Sans',
  },
  {
    id: 'warm-sanctuary',
    name: 'Warm Sanctuary',
    canvasBg: '#FFFDF9',
    surfaceBg: '#FEF7EE',
    titleColor: '#1E293B',
    bodyColor: '#475569',
    mutedColor: '#64748B',
    accentColor: '#B45309',
    borderColor: '#FDE68A',
    isDark: false,
    titleFont: 'Georgia',
    bodyFont: 'DM Sans',
  },
  {
    id: 'nordic-minimal',
    name: 'Nordic Minimal',
    canvasBg: '#F8FAFC',
    surfaceBg: '#FFFFFF',
    titleColor: '#09090B',
    bodyColor: '#3F3F46',
    mutedColor: '#71717A',
    accentColor: '#2563EB',
    borderColor: '#E4E4E7',
    isDark: false,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    canvasBg: '#111827',
    surfaceBg: '#1F2937',
    titleColor: '#F9FAFB',
    bodyColor: '#D1D5DB',
    mutedColor: '#9CA3AF',
    accentColor: '#F59E0B',
    borderColor: '#374151',
    isDark: true,
    titleFont: 'Georgia',
    bodyFont: 'DM Sans',
  },
  {
    id: 'teal-clinical',
    name: 'Clinical Teal',
    canvasBg: '#FFFFFF',
    surfaceBg: '#F0FDFA',
    titleColor: '#134E4A',
    bodyColor: '#334155',
    mutedColor: '#64748B',
    accentColor: '#0D9488',
    borderColor: '#CCFBF1',
    isDark: false,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'sunset-editorial',
    name: 'Editorial Terracotta',
    canvasBg: '#FFFBF7',
    surfaceBg: '#FFF1E6',
    titleColor: '#292524',
    bodyColor: '#57534E',
    mutedColor: '#78716C',
    accentColor: '#EA580C',
    borderColor: '#FED7AA',
    isDark: false,
    titleFont: 'Georgia',
    bodyFont: 'DM Sans',
  },
  {
    id: 'cyber-emerald',
    name: 'Dark Matrix',
    canvasBg: '#090D16',
    surfaceBg: '#111827',
    titleColor: '#ECFDF5',
    bodyColor: '#D1FAE5',
    mutedColor: '#6EE7B7',
    accentColor: '#10B981',
    borderColor: '#1F2937',
    isDark: true,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'plum-keynote',
    name: 'Keynote Plum',
    canvasBg: '#1E102E',
    surfaceBg: '#2D1B46',
    titleColor: '#FAF5FF',
    bodyColor: '#E9D5FF',
    mutedColor: '#C084FC',
    accentColor: '#F472B6',
    borderColor: '#4C1D95',
    isDark: true,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'ocean-corporate',
    name: 'Oceanic Consulting',
    canvasBg: '#FFFFFF',
    surfaceBg: '#F0F9FF',
    titleColor: '#0C4A6E',
    bodyColor: '#334155',
    mutedColor: '#64748B',
    accentColor: '#0284C7',
    borderColor: '#BAE6FD',
    isDark: false,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'sage-botanical',
    name: 'Botanical Sage',
    canvasBg: '#F4F7F5',
    surfaceBg: '#FFFFFF',
    titleColor: '#14532D',
    bodyColor: '#374151',
    mutedColor: '#6B7280',
    accentColor: '#15803D',
    borderColor: '#BBF7D0',
    isDark: false,
    titleFont: 'Georgia',
    bodyFont: 'DM Sans',
  },
  {
    id: 'monochrome-swiss',
    name: 'Swiss Grid',
    canvasBg: '#FFFFFF',
    surfaceBg: '#F4F4F5',
    titleColor: '#09090B',
    bodyColor: '#27272A',
    mutedColor: '#71717A',
    accentColor: '#DC2626',
    borderColor: '#D4D4D8',
    isDark: false,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
  {
    id: 'sapphire-gradient',
    name: 'Deep Sapphire',
    canvasBg: '#0B1120',
    surfaceBg: '#172554',
    titleColor: '#F0F9FF',
    bodyColor: '#BAE6FD',
    mutedColor: '#7DD3FC',
    accentColor: '#38BDF8',
    borderColor: '#1E3A8A',
    isDark: true,
    titleFont: 'Plus Jakarta Sans',
    bodyFont: 'DM Sans',
  },
];

export const CURATED_VISUALS = [
  {
    id: 'studio',
    label: 'Modern Workspace & Strategy',
    category: 'Business',
    url: '/src/assets/images/hero_presentation_studio_1794618359209.jpg',
  },
  {
    id: 'tech-ai',
    label: 'Artificial Intelligence & Systems',
    category: 'Technology',
    url: '/src/assets/images/slide_tech_ai_1794618356463.jpg',
  },
  {
    id: 'education',
    label: 'Academic Research & Lecture',
    category: 'Education',
    url: '/src/assets/images/slide_education_research_1794618357567.jpg',
  },
  {
    id: 'climate',
    label: 'Environment & Clean Energy',
    category: 'Environment',
    url: '/src/assets/images/slide_nature_climate_1794618357319.jpg',
  },
  {
    id: 'ministry',
    label: 'Church, Leadership & Study',
    category: 'Church',
    url: '/src/assets/images/slide_ministry_community_1794618357661.jpg',
  },
] as const;

export interface SlideStatItem {
  value: string;
  label: string;
  context?: string;
}

export interface SlideTimelineItem {
  date: string;
  title: string;
  description: string;
}

export interface SlideProcessStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface SlideComparisonColumn {
  heading: string;
  points: string[];
}

export interface SlideChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  unit?: string;
  seriesName: string;
  data: Array<{ label: string; value: number }>;
}

export type SlideTransitionEffect = 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'flip' | 'bounce';

export interface SlideShapeElement {
  id: string;
  type: 'rect' | 'circle' | 'callout' | 'star' | 'badge' | 'glass-card' | 'gradient-pill';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  rotation?: number;
  animation?: 'float' | 'pulse' | 'spin' | 'bounce' | 'shimmer' | 'none';
}

export interface SlideData {
  id: string;
  presentationId: string;
  slideOrder: number;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  paragraphs: string[];
  bullets: string[];
  stats?: SlideStatItem[];
  timeline?: SlideTimelineItem[];
  processSteps?: SlideProcessStep[];
  comparison?: SlideComparisonColumn[];
  featureCards?: Array<{ title: string; description: string; icon?: string }>;
  quote?: { text: string; attribution: string };
  chartData?: SlideChartData | null;
  imageUrl?: string;
  imageAlt?: string;
  imagePosition?: { x: number; y: number; scale: number; cropX?: number; cropY?: number };
  backgroundColor?: string;
  titleFont?: string;
  bodyFont?: string;
  titleColor?: string;
  bodyColor?: string;
  titleSize?: number;
  bodySize?: number;
  shapes?: SlideShapeElement[];
  transitionEffect?: SlideTransitionEffect;
  speakerNotes?: string;
  updatedAt?: string;
}

export interface PresentationRecord {
  id: string;
  userId: string;
  title: string;
  topic: string;
  sourceType: 'topic' | 'text' | 'document' | 'outline' | 'template';
  audience: string;
  purpose: string;
  style: string;
  language: string;
  aspectRatio: AspectRatio;
  themeId: string;
  status: 'DRAFT' | 'READY';
  shareSlug?: string | null;
  slideCount?: number;
  thumbnailSlide?: SlideData | null;
  slides?: SlideData[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  audienceLabel: string;
  monthlyPriceInr: number;
  annualPriceInr: number;
  monthlyPresentationsLimit: number;
  maxSlidesPerPresentation: number;
  aiEditsLimit: number;
  allowsPremiumTemplates: boolean;
  allowsPdfExport: boolean;
  allowsSpeakerNotes: boolean;
  allowsChartsAndDiagrams: boolean;
  priorityProcessing: boolean;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<PlanCode, PlanDefinition> = {
  FREE: {
    code: 'FREE',
    name: 'Free',
    audienceLabel: 'For trying SlideCraft AI',
    monthlyPriceInr: 0,
    annualPriceInr: 0,
    monthlyPresentationsLimit: 3,
    maxSlidesPerPresentation: 8,
    aiEditsLimit: 15,
    allowsPremiumTemplates: false,
    allowsPdfExport: false,
    allowsSpeakerNotes: false,
    allowsChartsAndDiagrams: false,
    priorityProcessing: false,
    features: [
      '3 presentations per month',
      'Maximum 8 slides per presentation',
      'Basic templates & standard layouts',
      'Editable PowerPoint (.pptx) & outline export',
      'Standard AI slide assistant (15 edits/month)',
    ],
  },
  STARTER: {
    code: 'STARTER',
    name: 'Starter',
    audienceLabel: 'For students & educators',
    monthlyPriceInr: 50,
    annualPriceInr: 480,
    monthlyPresentationsLimit: 50,
    maxSlidesPerPresentation: 15,
    aiEditsLimit: 150,
    allowsPremiumTemplates: false,
    allowsPdfExport: true,
    allowsSpeakerNotes: false,
    allowsChartsAndDiagrams: true,
    priorityProcessing: false,
    features: [
      '50 presentations per month',
      'Maximum 15 slides per presentation',
      'Professional templates & visual integration',
      'Editable PowerPoint (.pptx) & PDF export',
      'Standard AI slide editing (150 edits/month)',
    ],
  },
  PRO: {
    code: 'PRO',
    name: 'Pro',
    audienceLabel: 'For professionals & ministries',
    monthlyPriceInr: 120,
    annualPriceInr: 1152,
    monthlyPresentationsLimit: 100,
    maxSlidesPerPresentation: 25,
    aiEditsLimit: 500,
    allowsPremiumTemplates: true,
    allowsPdfExport: true,
    allowsSpeakerNotes: true,
    allowsChartsAndDiagrams: true,
    priorityProcessing: false,
    features: [
      '100 presentations per month',
      'Maximum 25 slides per presentation',
      'All Starter features + full premium template library',
      'AI speaker notes & advanced diagrams/charts',
      'Advanced AI slide assistant (500 edits/month)',
    ],
  },
  BUSINESS: {
    code: 'BUSINESS',
    name: 'Business',
    audienceLabel: 'For teams & organizations',
    monthlyPriceInr: 250,
    annualPriceInr: 2400,
    monthlyPresentationsLimit: 200,
    maxSlidesPerPresentation: 40,
    aiEditsLimit: 1500,
    allowsPremiumTemplates: true,
    allowsPdfExport: true,
    allowsSpeakerNotes: true,
    allowsChartsAndDiagrams: true,
    priorityProcessing: true,
    features: [
      '200 presentations per month',
      'Maximum 40 slides per presentation',
      'Priority AI processing & premium design library',
      'Advanced customization & higher image limits',
      'High-volume AI assistant (1,500 edits/month)',
    ],
  },
  FOUNDER_LIFETIME: {
    code: 'FOUNDER_LIFETIME',
    name: 'Founder Lifetime Premium',
    audienceLabel: 'Application Creator & Owner',
    monthlyPriceInr: 0,
    annualPriceInr: 0,
    monthlyPresentationsLimit: 999999,
    maxSlidesPerPresentation: 50,
    aiEditsLimit: 999999,
    allowsPremiumTemplates: true,
    allowsPdfExport: true,
    allowsSpeakerNotes: true,
    allowsChartsAndDiagrams: true,
    priorityProcessing: true,
    features: [
      'Lifetime free access to all premium features',
      'Unlimited presentation creation (fair-use safeguard)',
      'All Pro & Business capabilities + future releases',
      'Full PPTX, PDF, speaker notes & template access',
      'No subscription payments or expiry',
    ],
  },
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  isFounder: boolean;
  organization?: string;
  jobTitle?: string;
  preferredLanguage?: string;
  subscription: {
    planCode: PlanCode;
    billingCycle: BillingCycle;
    status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  usage: {
    billingMonth: string;
    presentationsGenerated: number;
    aiEditsCount: number;
    imagesGenerated: number;
    presentationsLimit: number;
    maxSlidesPerPresentation: number;
    remainingPresentations: number | 'UNLIMITED';
  };
}

export interface TemplateRecord {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  themeId: string;
  previewImageUrl: string;
  isPremium: boolean;
  slideCount: number;
  isFavorited?: boolean;
  sampleSlides?: Partial<SlideData>[];
}
