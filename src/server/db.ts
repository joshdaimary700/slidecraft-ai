import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CURATED_VISUALS } from '../shared/types.ts';
import type { PlanCode } from '../shared/types.ts';

export const FOUNDER_EMAIL = 'joshdaimary700@gmail.com';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'slidecraft.sqlite');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      emailVerified INTEGER NOT NULL DEFAULT 0,
      verificationCode TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS UserProfiles (
      userId TEXT PRIMARY KEY REFERENCES Users(id) ON DELETE CASCADE,
      organization TEXT DEFAULT '',
      jobTitle TEXT DEFAULT '',
      preferredLanguage TEXT DEFAULT 'English',
      avatarUrl TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Presentations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      sourceType TEXT NOT NULL DEFAULT 'topic',
      audience TEXT NOT NULL DEFAULT 'General audience',
      purpose TEXT NOT NULL DEFAULT 'Education',
      style TEXT NOT NULL DEFAULT 'Professional',
      language TEXT NOT NULL DEFAULT 'English',
      aspectRatio TEXT NOT NULL DEFAULT '16:9',
      themeId TEXT NOT NULL DEFAULT 'navy-indigo',
      status TEXT NOT NULL DEFAULT 'READY',
      shareSlug TEXT UNIQUE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS PresentationSlides (
      id TEXT PRIMARY KEY,
      presentationId TEXT NOT NULL REFERENCES Presentations(id) ON DELETE CASCADE,
      slideOrder INTEGER NOT NULL,
      layout TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      paragraphsJson TEXT NOT NULL DEFAULT '[]',
      bulletsJson TEXT NOT NULL DEFAULT '[]',
      statsJson TEXT DEFAULT NULL,
      timelineJson TEXT DEFAULT NULL,
      processStepsJson TEXT DEFAULT NULL,
      comparisonJson TEXT DEFAULT NULL,
      featureCardsJson TEXT DEFAULT NULL,
      quoteJson TEXT DEFAULT NULL,
      chartDataJson TEXT DEFAULT NULL,
      imageId TEXT DEFAULT NULL,
      imageUrl TEXT DEFAULT '',
      imageAlt TEXT DEFAULT '',
      imagePositionJson TEXT DEFAULT '{"x":0,"y":0,"scale":1}',
      backgroundColor TEXT DEFAULT '',
      titleFont TEXT DEFAULT '',
      bodyFont TEXT DEFAULT '',
      titleColor TEXT DEFAULT '',
      bodyColor TEXT DEFAULT '',
      titleSize INTEGER DEFAULT 32,
      bodySize INTEGER DEFAULT 16,
      shapesJson TEXT DEFAULT '[]',
      speakerNotes TEXT DEFAULT '',
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS PresentationImages (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      presentationId TEXT REFERENCES Presentations(id) ON DELETE SET NULL,
      slideId TEXT,
      url TEXT NOT NULL,
      altText TEXT NOT NULL DEFAULT '',
      sourceType TEXT NOT NULL DEFAULT 'upload',
      width INTEGER DEFAULT 1280,
      height INTEGER DEFAULT 720,
      cropJson TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS PresentationTemplates (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      themeId TEXT NOT NULL,
      previewImageUrl TEXT NOT NULL,
      isPremium INTEGER NOT NULL DEFAULT 0,
      slideCount INTEGER NOT NULL DEFAULT 8,
      sampleSlidesJson TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL UNIQUE REFERENCES Users(id) ON DELETE CASCADE,
      planCode TEXT NOT NULL DEFAULT 'FREE',
      billingCycle TEXT NOT NULL DEFAULT 'MONTHLY',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      razorpaySubscriptionId TEXT,
      currentPeriodStart TEXT NOT NULL,
      currentPeriodEnd TEXT,
      cancelAtPeriodEnd INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Payments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      subscriptionId TEXT REFERENCES Subscriptions(id) ON DELETE SET NULL,
      amountInr INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      billingCycle TEXT NOT NULL,
      planCode TEXT NOT NULL,
      razorpayOrderId TEXT,
      razorpayPaymentId TEXT,
      razorpaySignature TEXT,
      status TEXT NOT NULL DEFAULT 'CREATED',
      refundId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS UsageRecords (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      billingMonth TEXT NOT NULL,
      presentationsGenerated INTEGER NOT NULL DEFAULT 0,
      aiEditsCount INTEGER NOT NULL DEFAULT 0,
      imagesGenerated INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      UNIQUE(userId, billingMonth)
    );

    CREATE TABLE IF NOT EXISTS Favorites (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      templateId TEXT NOT NULL REFERENCES PresentationTemplates(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      UNIQUE(userId, templateId)
    );

    CREATE TABLE IF NOT EXISTS AIRequests (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      presentationId TEXT,
      requestType TEXT NOT NULL,
      modelUsed TEXT NOT NULL,
      inputTokens INTEGER NOT NULL DEFAULT 0,
      outputTokens INTEGER NOT NULL DEFAULT 0,
      estimatedCostUsd REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      errorMessage TEXT DEFAULT '',
      durationMs INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS PasswordResets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Promotions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discountPercent INTEGER NOT NULL,
      description TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      validUntil TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS AppSettings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  seedTemplates();
  seedDefaultSettingsAndPromotions();
}

function seedDefaultSettingsAndPromotions() {
  const now = new Date().toISOString();
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO AppSettings (key, value, updatedAt) VALUES (?, ?, ?)
  `);
  insertSetting.run('founder_daily_fair_use_limit', '200', now);
  insertSetting.run('maintenance_mode', 'false', now);
  insertSetting.run('default_ai_model', 'gemini-4-hydrogen', now);

  const insertPromo = db.prepare(`
    INSERT OR IGNORE INTO Promotions (id, code, discountPercent, description, active, validUntil, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertPromo.run(
    'promo_annual_20',
    'ANNUAL20',
    20,
    '20% discount on Annual Starter, Pro, and Business subscriptions',
    1,
    '2027-12-31T23:59:59.000Z',
    now
  );
  insertPromo.run(
    'promo_edu_15',
    'SCHOLAR15',
    15,
    '15% discount for academic researchers and educators',
    1,
    '2027-06-30T23:59:59.000Z',
    now
  );
}

function seedTemplates() {
  const now = new Date().toISOString();
  const templates = [
    {
      slug: 'executive-strategy-deck',
      name: 'Executive Board Strategy',
      category: 'Business',
      description: 'Structured quarterly review, KPI highlights, competitive comparison, and operational roadmap.',
      themeId: 'navy-indigo',
      previewImageUrl: CURATED_VISUALS[0].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Q4 Strategic Operating Plan',
          subtitle: 'Aligning revenue operations, product velocity, and customer retention',
          imageUrl: CURATED_VISUALS[0].url,
          paragraphs: ['Prepared for executive leadership and operational heads.'],
          bullets: [],
        },
        {
          layout: 'stat-highlight',
          title: 'Operational Performance Snapshot',
          subtitle: 'Key growth indicators across core segments',
          stats: [
            { value: '34%', label: 'Net Revenue Retention Gain', context: 'Year-over-year enterprise cohort' },
            { value: '18 days', label: 'Sales Cycle Compression', context: 'Through guided onboarding' },
            { value: '99.4%', label: 'Service Availability', context: 'Across regional deployments' },
          ],
          paragraphs: ['Disciplined execution reduced onboarding friction while increasing multi-year commitments.'],
          bullets: ['Enterprise expansion contributed 62% of net-new ARR', 'Support ticket resolution time fell by 41%'],
        },
        {
          layout: 'process-diagram',
          title: 'Execution Framework',
          subtitle: 'Four-phase operational rollout',
          processSteps: [
            { stepNumber: 1, title: 'Audit', description: 'Baseline workflow latency and unit economics' },
            { stepNumber: 2, title: 'Align', description: 'Assign quarterly owners per regional target' },
            { stepNumber: 3, title: 'Automate', description: 'Deploy standardized reporting pipelines' },
            { stepNumber: 4, title: 'Scale', description: 'Expand validated playbooks across territories' },
          ],
          paragraphs: [],
          bullets: [],
        },
      ],
    },
    {
      slug: 'modern-classroom-lecture',
      name: 'Interactive Lecture & Curriculum',
      category: 'Education',
      description: 'Clear conceptual framing, visual examples, guided discussion prompts, and lesson summary.',
      themeId: 'navy-indigo',
      previewImageUrl: CURATED_VISUALS[2].url,
      isPremium: 0,
      slideCount: 8,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Foundations of Modern Economics',
          subtitle: 'Supply dynamics, fiscal policy, and household decision making',
          imageUrl: CURATED_VISUALS[2].url,
          paragraphs: ['Course Module 04 · Undergraduate Seminar'],
          bullets: [],
        },
        {
          layout: 'two-column-comparison',
          title: 'Microeconomics vs. Macroeconomics',
          subtitle: 'Complementary lenses for analyzing market behavior',
          comparison: [
            { heading: 'Microeconomic Scope', points: ['Individual household budgets', 'Firm pricing and marginal cost', 'Sector-specific elasticity'] },
            { heading: 'Macroeconomic Scope', points: ['National GDP and inflation', 'Central bank interest rate policy', 'Aggregate employment trends'] },
          ],
          paragraphs: [],
          bullets: [],
        },
      ],
    },
    {
      slug: 'peer-reviewed-monograph',
      name: 'Academic Research Defense',
      category: 'Academic Research',
      description: 'Methodology breakdown, empirical findings, chart visualization, and limitations discussion.',
      themeId: 'crimson-academic',
      previewImageUrl: CURATED_VISUALS[2].url,
      isPremium: 1,
      slideCount: 12,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Longitudinal Study on Urban Air Quality',
          subtitle: 'Particulate matter trends and municipal green-corridor interventions',
          imageUrl: CURATED_VISUALS[2].url,
          paragraphs: ['Department of Environmental Sciences · Annual Symposium'],
          bullets: [],
        },
        {
          layout: 'chart-analysis',
          title: 'Measured PM2.5 Reduction by District',
          subtitle: 'Annualized sensor readings before and after corridor deployment',
          chartData: {
            type: 'bar',
            title: 'Average PM2.5 Concentration (µg/m³)',
            unit: 'µg/m³',
            seriesName: 'Post-Intervention',
            data: [
              { label: 'North Zone', value: 42 },
              { label: 'Central Hub', value: 36 },
              { label: 'Riverfront', value: 24 },
              { label: 'East Ward', value: 29 },
            ],
          },
          paragraphs: ['Continuous optical particle counters recorded statistically significant drops in high-canopy corridors.'],
          bullets: ['Controlled for seasonal wind variance', 'Data calibrated against reference stations'],
        },
      ],
    },
    {
      slug: 'ai-systems-architecture',
      name: 'Technology & AI Architecture',
      category: 'Technology',
      description: 'System diagrams, latency metrics, engineering milestones, and product architecture review.',
      themeId: 'obsidian-night',
      previewImageUrl: CURATED_VISUALS[1].url,
      isPremium: 1,
      slideCount: 12,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Enterprise AI Systems Architecture',
          subtitle: 'Designing reliable inference pipelines with structured evaluation',
          imageUrl: CURATED_VISUALS[1].url,
          paragraphs: ['Engineering Architecture Review'],
          bullets: [],
        },
        {
          layout: 'three-column-cards',
          title: 'Core Platform Pillars',
          subtitle: 'Built for deterministic outputs and auditability',
          featureCards: [
            { title: 'Schema Validation', description: 'Strict JSON schema verification prior to storage or export.' },
            { title: 'Latency Routing', description: 'Adaptive model selection balancing speed and reasoning depth.' },
            { title: 'Access Control', description: 'Per-tenant authorization and usage quota enforcement.' },
          ],
          paragraphs: [],
          bullets: [],
        },
      ],
    },
    {
      slug: 'product-launch-gtm',
      name: 'Go-To-Market & Growth Campaign',
      category: 'Marketing',
      description: 'Positioning framework, target persona breakdown, channel funnel metrics, and launch timeline.',
      themeId: 'royal-violet',
      previewImageUrl: CURATED_VISUALS[0].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'image-right',
          title: 'Market Positioning & Launch Plan',
          subtitle: 'Capturing high-intent organic demand in Q1',
          imageUrl: CURATED_VISUALS[0].url,
          paragraphs: ['Focused messaging around measurable time savings and document-to-deck fidelity.'],
          bullets: ['Clarify audience pain points before feature lists', 'Align regional pricing tiers to local purchasing power'],
        },
      ],
    },
    {
      slug: 'clinical-public-health',
      name: 'Medical & Public Health Briefing',
      category: 'Medical and Health',
      description: 'Evidence-based clinical overview, recovery pathways, prevention indicators, and patient education.',
      themeId: 'navy-indigo',
      previewImageUrl: CURATED_VISUALS[3].url,
      isPremium: 1,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'image-left',
          title: 'Community Recovery & Prevention Framework',
          subtitle: 'Integrating clinical care with family and peer support networks',
          imageUrl: CURATED_VISUALS[3].url,
          paragraphs: ['Evidence-informed outreach reduces relapse rates and improves long-term social reintegration.'],
          bullets: ['Early screening in primary health clinics', 'Structured counseling and community follow-up'],
        },
      ],
    },
    {
      slug: 'church-ministry-vision',
      name: 'Church Vision & Ministry Report',
      category: 'Church and Ministry',
      description: 'Pastoral vision casting, congregation outreach impact, biblical leadership principles, and stewardship.',
      themeId: 'warm-sanctuary',
      previewImageUrl: CURATED_VISUALS[4].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Servant Leadership & Community Outreach',
          subtitle: 'Annual Ministry Vision and Stewardship Overview',
          imageUrl: CURATED_VISUALS[4].url,
          paragraphs: ['Building resilient faith communities grounded in service and scripture.'],
          bullets: [],
        },
        {
          layout: 'quote-image',
          title: 'Foundational Calling',
          subtitle: 'Guided by humility, compassion, and steadfast integrity',
          imageUrl: CURATED_VISUALS[4].url,
          quote: {
            text: 'Whoever wants to become great among you must be your servant.',
            attribution: 'Mark 10:43 · Biblical Leadership Principle',
          },
          paragraphs: [],
          bullets: [],
        },
      ],
    },
    {
      slug: 'scripture-bible-study',
      name: 'Expository Bible Study Series',
      category: 'Bible Study',
      description: 'Historical context, verse-by-verse exposition, theological themes, and small-group reflection questions.',
      themeId: 'warm-sanctuary',
      previewImageUrl: CURATED_VISUALS[4].url,
      isPremium: 1,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'timeline',
          title: 'Historical Context of the Early Church',
          subtitle: 'Key milestones from Jerusalem to the Mediterranean world',
          timeline: [
            { date: 'AD 30–33', title: 'Jerusalem Community', description: 'Apostolic teaching, fellowship, and daily care for the vulnerable.' },
            { date: 'AD 46–48', title: 'Antioch & First Mission', description: 'Cross-cultural expansion into Asia Minor.' },
            { date: 'AD 49', title: 'Jerusalem Council', description: 'Affirming unity across Jewish and Gentile believers.' },
          ],
          paragraphs: [],
          bullets: [],
        },
      ],
    },
    {
      slug: 'hands-on-workshop-guide',
      name: 'Interactive Training & Workshop',
      category: 'Training and Workshops',
      description: 'Learning objectives, step-by-step exercises, facilitator prompts, and actionable takeaways.',
      themeId: 'emerald-earth',
      previewImageUrl: CURATED_VISUALS[0].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'process-diagram',
          title: 'Workshop Agenda & Skill Progression',
          subtitle: 'From foundational concepts to applied group exercises',
          processSteps: [
            { stepNumber: 1, title: 'Framing', description: 'Define core problem statement (20 min)' },
            { stepNumber: 2, title: 'Practice', description: 'Hands-on pair exercise (35 min)' },
            { stepNumber: 3, title: 'Critique', description: 'Facilitated peer review (20 min)' },
            { stepNumber: 4, title: 'Action Plan', description: 'Personal 30-day commitment (15 min)' },
          ],
          paragraphs: [],
          bullets: [],
        },
      ],
    },
    {
      slug: 'personal-creative-portfolio',
      name: 'Personal Portfolio & Case Showcase',
      category: 'Personal Portfolio',
      description: 'Clean biographical narrative, selected works showcase, impact metrics, and contact summary.',
      themeId: 'royal-violet',
      previewImageUrl: CURATED_VISUALS[0].url,
      isPremium: 1,
      slideCount: 8,
      sampleSlides: [
        {
          layout: 'image-left',
          title: 'Selected Works & Design Philosophy',
          subtitle: 'Crafting human-centered digital products and research systems',
          imageUrl: CURATED_VISUALS[0].url,
          paragraphs: ['Focused on clarity, measurable outcomes, and enduring craft across web and mobile platforms.'],
          bullets: ['8+ years leading product architecture', 'Delivered 24 shipped enterprise engagements'],
        },
      ],
    },
    {
      slug: 'quarterly-project-report',
      name: 'Engineering & Project Status Report',
      category: 'Project Reports',
      description: 'Deliverable tracking, milestone timeline, risk mitigation matrix, and resource allocation.',
      themeId: 'navy-indigo',
      previewImageUrl: CURATED_VISUALS[1].url,
      isPremium: 0,
      slideCount: 8,
      sampleSlides: [
        {
          layout: 'two-column-comparison',
          title: 'Milestone Progress & Risk Mitigation',
          subtitle: 'Current sprint status against baseline schedule',
          comparison: [
            { heading: 'Completed Deliverables', points: ['Core data ingestion API finalized', 'Automated regression suite passing', 'Security audit remediation closed'] },
            { heading: 'Active Mitigations', points: ['Load-testing regional failover nodes', 'Finalizing localization review for Assamese & Hindi'] },
          ],
          paragraphs: [],
          bullets: [],
        },
      ],
    },
    {
      slug: 'keynote-conference-talk',
      name: 'Keynote & Conference Presentation',
      category: 'Conference Presentations',
      description: 'High-impact stage visuals, memorable single-stat slides, story arcs, and closing call to action.',
      themeId: 'obsidian-night',
      previewImageUrl: CURATED_VISUALS[3].url,
      isPremium: 1,
      slideCount: 12,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Climate Resilience & Clean Infrastructure',
          subtitle: 'Lessons from community-led renewable microgrids',
          imageUrl: CURATED_VISUALS[3].url,
          paragraphs: ['Opening Keynote Address · International Sustainability Forum'],
          bullets: [],
        },
      ],
    },
    {
      slug: 'minimalist-startup-pitch',
      name: 'Minimalist Startup Pitch',
      category: 'Business',
      description: 'Clean investor narrative covering market gap, product traction, unit economics, and funding ask.',
      themeId: 'nordic-minimal',
      previewImageUrl: CURATED_VISUALS[0].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Seed Round Investor Presentation',
          subtitle: 'Reimagining workflow automation for distributed teams',
          imageUrl: CURATED_VISUALS[0].url,
          paragraphs: ['Confidential Investor Brief · Series Seed'],
          bullets: [],
        },
      ],
    },
    {
      slug: 'editorial-terracotta-story',
      name: 'Editorial Storytelling & Brand',
      category: 'Marketing',
      description: 'Warm serif editorial aesthetic built for brand stories, cultural campaigns, and narrative pitches.',
      themeId: 'sunset-editorial',
      previewImageUrl: CURATED_VISUALS[0].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Annual Brand & Culture Narrative',
          subtitle: 'Connecting craft, community impact, and digital storytelling',
          imageUrl: CURATED_VISUALS[0].url,
          paragraphs: ['Creative Direction & Brand Strategy'],
          bullets: [],
        },
      ],
    },
    {
      slug: 'swiss-precision-monograph',
      name: 'Swiss Precision Grid',
      category: 'Technology',
      description: 'High-contrast Swiss typographic grid with vermilion accents for product specs and design reviews.',
      themeId: 'monochrome-swiss',
      previewImageUrl: CURATED_VISUALS[1].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Product Design Specification',
          subtitle: 'Modular component architecture and accessibility benchmarks',
          imageUrl: CURATED_VISUALS[1].url,
          paragraphs: ['Design Systems & Engineering Standards'],
          bullets: [],
        },
      ],
    },
    {
      slug: 'botanical-sustainability-esg',
      name: 'Sustainability & ESG Report',
      category: 'Education',
      description: 'Botanical sage palette tailored for environmental protection, climate policy, and ESG reporting.',
      themeId: 'sage-botanical',
      previewImageUrl: CURATED_VISUALS[3].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Environmental Stewardship & Impact',
          subtitle: 'Measuring carbon reduction, biodiversity, and watershed restoration',
          imageUrl: CURATED_VISUALS[3].url,
          paragraphs: ['Annual Ecological Assessment'],
          bullets: [],
        },
      ],
    },
    {
      slug: 'clinical-teal-overview',
      name: 'Clinical Care & Wellness',
      category: 'Medical and Health',
      description: 'Calm clinical teal palette designed for healthcare training, patient recovery, and wellness programs.',
      themeId: 'teal-clinical',
      previewImageUrl: CURATED_VISUALS[2].url,
      isPremium: 0,
      slideCount: 10,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Preventive Health & Patient Outcomes',
          subtitle: 'Integrated community care protocols and recovery milestones',
          imageUrl: CURATED_VISUALS[2].url,
          paragraphs: ['Clinical Briefing · Public Health Initiative'],
          bullets: [],
        },
      ],
    },
    {
      slug: 'midnight-gold-executive',
      name: 'Midnight Gold Executive',
      category: 'Conference Presentations',
      description: 'High-contrast dark slate and warm gold keynote aesthetic for executive summits and flagship launches.',
      themeId: 'midnight-gold',
      previewImageUrl: CURATED_VISUALS[1].url,
      isPremium: 1,
      slideCount: 12,
      sampleSlides: [
        {
          layout: 'full-image-title',
          title: 'Leadership Summit Keynote',
          subtitle: 'Long-term strategic vision and organizational excellence',
          imageUrl: CURATED_VISUALS[1].url,
          paragraphs: ['Annual Leadership Conclave'],
          bullets: [],
        },
      ],
    },
  ];

  const domainBlocksByCategory: Record<string, any[]> = {
    Business: [
      {
        layout: 'three-column-cards',
        title: 'Strategic Growth Pillars',
        subtitle: 'Core initiatives driving sustainable revenue and operational leverage',
        featureCards: [
          { title: 'Customer Expansion', description: 'Deepen enterprise adoption through guided onboarding and executive reviews.' },
          { title: 'Operational Efficiency', description: 'Standardize workflows and eliminate bottlenecks across delivery teams.' },
          { title: 'Market Differentiation', description: 'Invest in defensible capabilities aligned with high-value buyer needs.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'two-column-comparison',
        title: 'Current Baseline vs. Target State',
        subtitle: 'Operational transformation milestones across core functions',
        comparison: [
          { heading: 'Current Baseline', points: ['Manual reporting across regional teams', 'Fragmented customer handoff workflows', 'Longer sales qualification cycles'] },
          { heading: 'Target Operating State', points: ['Unified weekly KPI visibility', 'Automated lifecycle onboarding playbooks', 'Predictable quarter-over-quarter expansion'] },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'image-right',
        title: 'Resource Allocation & Governance',
        subtitle: 'Empowering cross-functional leads with clear ownership',
        imageUrl: CURATED_VISUALS[0].url,
        paragraphs: ['Quarterly capital allocation prioritizes high-conviction product and customer retention initiatives.'],
        bullets: ['Dedicated executive sponsors for each pillar', 'Bi-weekly milestone checkpoints with clear escalation paths', 'Transparent unit-economics tracking'],
      },
      {
        layout: 'closing-summary',
        title: 'Executive Takeaways & Next Steps',
        subtitle: 'Immediate priorities for the next 30 days',
        paragraphs: ['Disciplined execution across all three strategic pillars positions the organization for compounding growth.'],
        bullets: [
          'Finalize departmental OKRs and resource commitments by Friday',
          'Launch unified weekly performance dashboard across leadership',
          'Schedule 30-day review to measure early conversion lift',
        ],
      },
    ],
    Education: [
      {
        layout: 'three-column-cards',
        title: 'Core Learning Objectives',
        subtitle: 'What learners will understand and apply by the end of this module',
        featureCards: [
          { title: 'Conceptual Clarity', description: 'Master foundational definitions and cause-and-effect relationships.' },
          { title: 'Applied Analysis', description: 'Evaluate real-world case studies using structured frameworks.' },
          { title: 'Collaborative Synthesis', description: 'Articulate reasoned arguments in peer discussion and reflection.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'process-diagram',
        title: 'Guided Lesson Progression',
        subtitle: 'Four structured stages from inquiry to mastery',
        processSteps: [
          { stepNumber: 1, title: 'Hook & Context', description: 'Connect key concepts to everyday lived questions' },
          { stepNumber: 2, title: 'Core Concept', description: 'Explore visual models and worked examples' },
          { stepNumber: 3, title: 'Group Inquiry', description: 'Test understanding through structured peer dialogue' },
          { stepNumber: 4, title: 'Reflection', description: 'Synthesize takeaways and formative checkpoints' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'image-left',
        title: 'Real-World Case Application',
        subtitle: 'Bridging classroom theory with practical evidence',
        imageUrl: CURATED_VISUALS[2].url,
        paragraphs: ['Connecting core principles to tangible examples strengthens long-term retention and critical reasoning.'],
        bullets: ['Compare historical and modern outcomes side-by-side', 'Identify assumptions behind each analytical model', 'Prepare a 2-minute summary for class discussion'],
      },
      {
        layout: 'closing-summary',
        title: 'Module Summary & Review Questions',
        subtitle: 'Key ideas to carry into the next session',
        paragraphs: ['Review the core takeaways below before completing this week’s reflection assignment.'],
        bullets: [
          'Core models clarify trade-offs rather than single isolated variables',
          'Evidence-based comparison separates correlation from causation',
          'Discussion prompt: Which real-world example best illustrates today’s theme?',
        ],
      },
    ],
    'Academic Research': [
      {
        layout: 'three-column-cards',
        title: 'Research Design & Methodology',
        subtitle: 'Rigorous empirical protocol ensuring reproducibility and validity',
        featureCards: [
          { title: 'Study Population', description: 'Stratified sampling criteria minimizing selection and regional bias.' },
          { title: 'Measurement Tools', description: 'Calibrated instruments with verified inter-rater reliability.' },
          { title: 'Statistical Controls', description: 'Multivariate adjustments accounting for seasonal and baseline variance.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'process-diagram',
        title: 'Analytical Pipeline',
        subtitle: 'End-to-end validation from raw observation to peer review',
        processSteps: [
          { stepNumber: 1, title: 'Data Collection', description: 'Standardized field capture across target sites' },
          { stepNumber: 2, title: 'Calibration', description: 'Outlier audit and missing-value verification' },
          { stepNumber: 3, title: 'Modeling', description: 'Regression testing and confidence interval checks' },
          { stepNumber: 4, title: 'Peer Synthesis', description: 'Cross-validation against prior literature' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'two-column-comparison',
        title: 'Key Findings & Study Limitations',
        subtitle: 'Balanced interpretation of empirical results',
        comparison: [
          { heading: 'Primary Findings', points: ['Consistent improvement across primary intervention cohorts', 'Statistically significant trend sustained over follow-up', 'Replicable effect size across secondary clusters'] },
          { heading: 'Methodological Scope', points: ['Observational window limited to current study cycle', 'Further longitudinal tracking recommended for external cohorts', 'Contextual variables documented in appendix tables'] },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'closing-summary',
        title: 'Conclusions & Future Research',
        subtitle: 'Implications for theory, policy, and follow-up studies',
        paragraphs: ['Findings reinforce the primary hypothesis while highlighting clear avenues for multi-center replication.'],
        bullets: [
          'Primary intervention demonstrates measurable, reproducible benefit',
          'Open dataset and methodology appendix prepared for peer verification',
          'Phase II longitudinal cohort study scheduled for upcoming academic term',
        ],
      },
    ],
    Technology: [
      {
        layout: 'process-diagram',
        title: 'End-to-End Execution Pipeline',
        subtitle: 'Deterministic architecture from request intake to verified output',
        processSteps: [
          { stepNumber: 1, title: 'Ingestion', description: 'Normalize structured and unstructured inputs safely' },
          { stepNumber: 2, title: 'Validation', description: 'Enforce strict schema and policy guardrails' },
          { stepNumber: 3, title: 'Processing', description: 'Execute low-latency parallel inference and caching' },
          { stepNumber: 4, title: 'Observability', description: 'Log latency, quality metrics, and audit trails' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'two-column-comparison',
        title: 'Legacy Stack vs. Modern Architecture',
        subtitle: 'Measurable gains in reliability, speed, and maintainability',
        comparison: [
          { heading: 'Legacy Bottlenecks', points: ['Monolithic deployment cycles with brittle coupling', 'Manual schema checks causing silent regressions', 'Opaque failure modes under peak traffic'] },
          { heading: 'Target Architecture', points: ['Modular services with typed contract boundaries', 'Automated validation prior to persistence or export', 'Real-time telemetry and graceful degradation'] },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'image-right',
        title: 'Security, Governance & Scale',
        subtitle: 'Hardening reliability without slowing engineering velocity',
        imageUrl: CURATED_VISUALS[1].url,
        paragraphs: ['Zero-trust boundaries, encrypted sessions, and strict rate controls protect every tenant workload.'],
        bullets: ['Role-based access controls enforced server-side', 'Automated CI regression checks before release', 'Horizontal scaling ready for enterprise demand'],
      },
      {
        layout: 'closing-summary',
        title: 'Architecture Roadmap & Next Steps',
        subtitle: 'Prioritized engineering milestones for rollout',
        paragraphs: ['The unified architecture balances production dependability with rapid iteration across product squads.'],
        bullets: [
          'Complete staging load tests and latency benchmarking',
          'Roll out telemetry alerts and automated canary checks',
          'Enable progressive tenant migration across production clusters',
        ],
      },
    ],
    Marketing: [
      {
        layout: 'three-column-cards',
        title: 'Audience Positioning Pillars',
        subtitle: 'Clarifying value propositions for high-intent customer segments',
        featureCards: [
          { title: 'Core Pain Point', description: 'Eliminate hours of manual formatting and repetitive slide cleanup.' },
          { title: 'Unique Advantage', description: 'Turn raw documents and outlines into executive-ready decks in minutes.' },
          { title: 'Proof & Trust', description: 'Consistent branding, editable exports, and regional language support.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'process-diagram',
        title: 'Full-Funnel Campaign Execution',
        subtitle: 'Coordinated touchpoints from awareness through conversion',
        processSteps: [
          { stepNumber: 1, title: 'Awareness', description: 'Short-form product demos and search guides' },
          { stepNumber: 2, title: 'Activation', description: 'Interactive template previews with zero friction' },
          { stepNumber: 3, title: 'Conversion', description: 'Clear value tiers aligned to team usage' },
          { stepNumber: 4, title: 'Advocacy', description: 'Shareable deck links driving organic referrals' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'timeline',
        title: '90-Day Launch & Growth Cadence',
        subtitle: 'Sequenced rollout across content, partnerships, and retention',
        timeline: [
          { date: 'Month 1', title: 'Messaging & Assets', description: 'Ship landing pages, visual demos, and creator kits.' },
          { date: 'Month 2', title: 'Channel Scaling', description: 'Expand organic search, community showcases, and webinars.' },
          { date: 'Month 3', title: 'Lifecycle Optimization', description: 'Refine onboarding prompts and referral loops.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'closing-summary',
        title: 'Campaign Summary & Action Plan',
        subtitle: 'Immediate launch checklist for the growth team',
        paragraphs: ['Consistent storytelling across landing pages, templates, and product onboarding accelerates word-of-mouth adoption.'],
        bullets: [
          'Approve hero creative assets and customer proof points',
          'Publish weekly template spotlights tailored to key verticals',
          'Review activation and retention metrics every Monday morning',
        ],
      },
    ],
    'Medical and Health': [
      {
        layout: 'three-column-cards',
        title: 'Core Pillars of Preventive Care',
        subtitle: 'Coordinating clinical guidance, community support, and early intervention',
        featureCards: [
          { title: 'Early Screening', description: 'Routine risk assessment in primary and community clinics.' },
          { title: 'Patient Education', description: 'Clear, culturally accessible guidance for patients and families.' },
          { title: 'Continuity of Care', description: 'Structured follow-up reducing relapse and hospital readmission.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'process-diagram',
        title: 'Patient Care & Recovery Pathway',
        subtitle: 'Step-by-step clinical workflow from intake to long-term wellness',
        processSteps: [
          { stepNumber: 1, title: 'Intake', description: 'Compassionate screening and baseline evaluation' },
          { stepNumber: 2, title: 'Care Plan', description: 'Personalized clinical and behavioral goals' },
          { stepNumber: 3, title: 'Support', description: 'Counseling, family education, and peer check-ins' },
          { stepNumber: 4, title: 'Follow-Up', description: 'Ongoing monitoring and relapse prevention' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'two-column-comparison',
        title: 'Reactive Care vs. Preventive Support',
        subtitle: 'Shifting health outcomes through early community engagement',
        comparison: [
          { heading: 'Delayed Intervention', points: ['Higher acute care costs and emergency visits', 'Fragmented follow-up after discharge', 'Limited family awareness of warning signs'] },
          { heading: 'Proactive Care Model', points: ['Timely screening and community counseling', 'Coordinated primary and specialist tracking', 'Sustained recovery and improved quality of life'] },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'closing-summary',
        title: 'Key Clinical Takeaways & Next Steps',
        subtitle: 'Implementing sustainable community health outcomes',
        paragraphs: ['Combining evidence-based clinical protocols with empathetic community support drives measurable long-term recovery.'],
        bullets: [
          'Standardize early-screening checklists across partner clinics',
          'Distribute multilingual patient education handouts',
          'Track 90-day recovery retention milestones monthly',
        ],
      },
    ],
    'Church and Ministry': [
      {
        layout: 'three-column-cards',
        title: 'Three Pillars of Ministry Stewardship',
        subtitle: 'Nurturing spiritual growth, fellowship, and compassionate community service',
        featureCards: [
          { title: 'Scriptural Teaching', description: 'Grounding congregation life in clear, faithful biblical instruction.' },
          { title: 'Discipleship & Care', description: 'Walking alongside families through small groups and pastoral support.' },
          { title: 'Local Outreach', description: 'Serving neighbors practically with humility, generosity, and love.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'process-diagram',
        title: 'Discipleship & Leadership Pathway',
        subtitle: 'Equipping members from first welcome to servant leadership',
        processSteps: [
          { stepNumber: 1, title: 'Welcome', description: 'Warm hospitality and community connection' },
          { stepNumber: 2, title: 'Grow', description: 'Weekly Bible study and prayer fellowship' },
          { stepNumber: 3, title: 'Serve', description: 'Discovering gifts in local ministry teams' },
          { stepNumber: 4, title: 'Lead', description: 'Mentoring new leaders with integrity' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'image-right',
        title: 'Community Impact & Outreach Goals',
        subtitle: 'Extending practical care across neighborhoods and families',
        imageUrl: CURATED_VISUALS[4].url,
        paragraphs: ['Stewardship is measured not only by attendance, but by transformed lives and faithful service to the vulnerable.'],
        bullets: ['Expand youth mentorship and family counseling circles', 'Strengthen transparent stewardship and volunteer training', 'Partner with local fellowships for seasonal relief initiatives'],
      },
      {
        layout: 'closing-summary',
        title: 'Ministry Vision & Prayerful Commitment',
        subtitle: 'Walking forward together in faith and unity',
        paragraphs: ['May every ministry initiative reflect Christ-centered humility, generosity, and faithful stewardship.'],
        bullets: [
          'Commit upcoming ministry calendar and small-group leaders to prayer',
          'Invite every household to participate in a local service team',
          'Review outreach milestones together at the quarterly fellowship gathering',
        ],
      },
    ],
    'Bible Study': [
      {
        layout: 'three-column-cards',
        title: 'Key Theological Themes in Focus',
        subtitle: 'Observing scripture in its literary, covenantal, and pastoral context',
        featureCards: [
          { title: 'Literary Context', description: 'Tracing how the passage fits within the surrounding chapter and book.' },
          { title: 'Covenant Promise', description: 'Understanding God’s faithfulness across Old and New Testaments.' },
          { title: 'Daily Discipleship', description: 'Applying timeless biblical truth to modern family and community life.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'quote-image',
        title: 'Key Scripture Meditation',
        subtitle: 'Reading carefully before interpreting and applying',
        imageUrl: CURATED_VISUALS[4].url,
        quote: {
          text: 'Your word is a lamp to my feet and a light to my path.',
          attribution: 'Psalm 119:105',
        },
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'two-column-comparison',
        title: 'Observation vs. Practical Application',
        subtitle: 'Moving faithfully from biblical text to lived obedience',
        comparison: [
          { heading: 'What the Text Says', points: ['Original audience and historical setting', 'Repeated keywords and structural contrast', 'Connection to the broader Gospel narrative'] },
          { heading: 'How We Live It Today', points: ['Practicing humility and patience in daily work', 'Encouraging fellow believers in weekly fellowship', 'Serving neighbors with integrity and grace'] },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'closing-summary',
        title: 'Small-Group Reflection & Prayer Guide',
        subtitle: 'Questions to discuss together this week',
        paragraphs: ['Take time to reflect quietly and share one personal takeaway with your study group.'],
        bullets: [
          'Which verse or phrase stood out most clearly to you in today’s passage?',
          'What does this passage teach about God’s character and faithfulness?',
          'What is one concrete step of obedience you will practice this week?',
        ],
      },
    ],
    'Training and Workshops': [
      {
        layout: 'three-column-cards',
        title: 'Workshop Outcomes & Deliverables',
        subtitle: 'Practical skills every participant builds during this session',
        featureCards: [
          { title: 'Shared Vocabulary', description: 'Align teams around clear terminology and decision criteria.' },
          { title: 'Hands-On Templates', description: 'Practice repeatable checklists you can reuse immediately at work.' },
          { title: '30-Day Action Plan', description: 'Leave with concrete next steps committed with an accountability partner.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'two-column-comparison',
        title: 'Workshop Dos & Common Pitfalls',
        subtitle: 'Practical habits that separate effective teams from stalled efforts',
        comparison: [
          { heading: 'Best Practices', points: ['Start with a clear problem statement', 'Timebox brainstorming before prioritizing', 'Assign one clear owner per next step'] },
          { heading: 'Avoid These Traps', points: ['Jumping to tools before defining goals', 'Overloading slides with raw prose', 'Ending sessions without follow-up dates'] },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'image-right',
        title: 'Interactive Group Exercise',
        subtitle: '35-minute collaborative sprint in teams of 3–4',
        imageUrl: CURATED_VISUALS[0].url,
        paragraphs: ['Apply the workshop framework directly to a real scenario from your current project.'],
        bullets: ['Step 1: Choose one live challenge (5 min)', 'Step 2: Draft a 3-part solution outline (20 min)', 'Step 3: Present 2-minute peer feedback (10 min)'],
      },
      {
        layout: 'closing-summary',
        title: 'Session Wrap-Up & 30-Day Commitments',
        subtitle: 'Turning today’s practice into lasting team habits',
        paragraphs: ['Real transformation happens in the days following the workshop through consistent application.'],
        bullets: [
          'Document your team’s top priority action within 24 hours',
          'Schedule a 15-minute progress check-in two weeks from today',
          'Share template outputs in the shared workspace for peer learning',
        ],
      },
    ],
    'Personal Portfolio': [
      {
        layout: 'three-column-cards',
        title: 'Core Capabilities & Craft',
        subtitle: 'Combining strategic thinking with meticulous visual and technical execution',
        featureCards: [
          { title: 'Product Strategy', description: 'Translating ambiguous user problems into focused product roadmaps.' },
          { title: 'Systems Design', description: 'Crafting accessible, scalable interfaces and design languages.' },
          { title: 'End-to-End Delivery', description: 'Partnering closely with engineering from prototype to production.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'stat-highlight',
        title: 'Selected Career Impact',
        subtitle: 'Measurable outcomes across enterprise and consumer engagements',
        stats: [
          { value: '24+', label: 'Shipped Launches', context: 'Web, mobile & SaaS platforms' },
          { value: '3.2x', label: 'Activation Lift', context: 'Through streamlined onboarding UX' },
          { value: '8 yrs', label: 'Leadership Experience', context: 'Cross-functional product teams' },
        ],
        paragraphs: ['Focused on tangible user value, clean typography, and resilient engineering collaboration.'],
        bullets: [],
      },
      {
        layout: 'timeline',
        title: 'Featured Case Study Progression',
        subtitle: 'How each engagement moves from discovery to measurable impact',
        timeline: [
          { date: 'Phase 01', title: 'User Discovery', description: 'Field interviews, funnel audits, and problem framing.' },
          { date: 'Phase 02', title: 'Rapid Prototyping', description: 'Iterative interactive flows tested with real users.' },
          { date: 'Phase 03', title: 'Production Launch', description: 'Design system handoff, QA polish, and metric tracking.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'closing-summary',
        title: 'Let’s Build Something Enduring',
        subtitle: 'Available for advisory, leadership, and product collaborations',
        paragraphs: ['Thank you for reviewing these selected works. Reach out anytime to discuss upcoming product initiatives.'],
        bullets: [
          'Full case study walkthroughs available upon request',
          'Open to product architecture consulting and design leadership roles',
          'Let’s connect to explore how we can work together',
        ],
      },
    ],
    'Project Reports': [
      {
        layout: 'stat-highlight',
        title: 'Sprint & Delivery Health Snapshot',
        subtitle: 'Key operational metrics tracked against baseline targets',
        stats: [
          { value: '92%', label: 'Milestone Completion', context: 'On-track for quarterly release' },
          { value: '0', label: 'Critical Blockers', context: 'Security & QA gates verified' },
          { value: '14 days', label: 'Ahead of Schedule', context: 'Core backend stabilization' },
        ],
        paragraphs: ['Cross-functional coordination kept critical-path deliverables moving ahead of schedule.'],
        bullets: [],
      },
      {
        layout: 'timeline',
        title: 'Delivery Schedule & Upcoming Gates',
        subtitle: 'Key milestones across engineering, QA, and launch readiness',
        timeline: [
          { date: 'Week 1–2', title: 'API & Integration', description: 'Core endpoints verified with automated tests.' },
          { date: 'Week 3–4', title: 'Performance QA', description: 'Load testing and regional failover checks.' },
          { date: 'Week 5–6', title: 'Production Rollout', description: 'Phased deployment with live monitoring.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'image-right',
        title: 'Resource & Dependency Alignment',
        subtitle: 'Coordinating engineering, design, and localization tracks',
        imageUrl: CURATED_VISUALS[1].url,
        paragraphs: ['Weekly dependency syncs eliminated handoff delays between backend services and frontend components.'],
        bullets: ['QA automation covers 94% of core user flows', 'Documentation and runbooks finalized prior to handoff', 'Stakeholder sign-off scheduled for Friday review'],
      },
      {
        layout: 'closing-summary',
        title: 'Status Summary & Decisions Needed',
        subtitle: 'Action items for executive alignment',
        paragraphs: ['The project remains green across scope, quality, and schedule with clear next-week checkpoints.'],
        bullets: [
          'Approve final production rollout window for next Tuesday',
          'Confirm stakeholder sign-off on localization copy',
          'Archive sprint retrospective actions into next quarter’s backlog',
        ],
      },
    ],
    'Conference Presentations': [
      {
        layout: 'stat-highlight',
        title: 'Why This Moment Matters Now',
        subtitle: 'Key shifts redefining our industry landscape',
        stats: [
          { value: '4.5x', label: 'Adoption Acceleration', context: 'Across regional organizations' },
          { value: '68%', label: 'Efficiency Gain', context: 'When pairing human craft with AI' },
          { value: '2026+', label: 'Inflection Window', context: 'Early movers set lasting standards' },
        ],
        paragraphs: ['Technology only matters when it amplifies human judgment, clarity, and real-world impact.'],
        bullets: [],
      },
      {
        layout: 'quote-image',
        title: 'Core Keynote Perspective',
        subtitle: 'Designing resilient systems built around people',
        imageUrl: CURATED_VISUALS[3].url,
        quote: {
          text: 'The best tools disappear into the background and elevate the clarity of human ideas.',
          attribution: 'Keynote Theme · Designing for Impact',
        },
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'three-column-cards',
        title: 'Three Shifts Shaping the Next Decade',
        subtitle: 'Practical principles for leaders and builders',
        featureCards: [
          { title: 'Clarity Over Noise', description: 'Concise visual storytelling outperforms dense walls of data.' },
          { title: 'Local-First Access', description: 'Inclusive language and mobile-ready tools unlock global talent.' },
          { title: 'Human-Centered Craft', description: 'Automation accelerates execution while people guide meaning.' },
        ],
        paragraphs: [],
        bullets: [],
      },
      {
        layout: 'closing-summary',
        title: 'Closing Call to Action',
        subtitle: 'Thank you — let’s continue the conversation',
        paragraphs: ['Every meaningful shift begins with a clear story shared boldly with the right community.'],
        bullets: [
          'Start with clarity of purpose before choosing tools or tactics',
          'Invest in accessible design that works for every audience',
          'Thank you for joining today’s keynote — slides available to share',
        ],
      },
    ],
  };

  function expandToFullStarterDeck(tpl: {
    name: string;
    category: string;
    description: string;
    previewImageUrl: string;
    sampleSlides: any[];
  }) {
    const existing = Array.isArray(tpl.sampleSlides) ? [...tpl.sampleSlides] : [];
    const hasCover = existing.some((s) => s.layout === 'full-image-title');
    if (!hasCover) {
      existing.unshift({
        layout: 'full-image-title',
        title: tpl.name,
        subtitle: tpl.description,
        imageUrl: tpl.previewImageUrl,
        paragraphs: [`${tpl.category} Presentation Template`],
        bullets: [],
      });
    }

    const domainPool = domainBlocksByCategory[tpl.category] || domainBlocksByCategory.Business;
    const usedLayouts = new Set(existing.map((s) => s.layout));

    // Add distinct interior domain slides until we have 5 slides before closing
    for (const candidate of domainPool) {
      if (candidate.layout === 'closing-summary') continue;
      if (existing.length >= 5) break;
      if (!usedLayouts.has(candidate.layout)) {
        existing.push({
          ...candidate,
          imageUrl: candidate.imageUrl || tpl.previewImageUrl,
        });
        usedLayouts.add(candidate.layout);
      }
    }

    // Ensure at least 5 slides before adding closing summary (pulling from Business/Conference fallback pools if category pool only has 3 interior blocks)
    const supplementaryPool = [
      ...domainPool.filter((c) => c.layout !== 'closing-summary'),
      ...domainBlocksByCategory.Business.filter((c) => c.layout !== 'closing-summary'),
      ...domainBlocksByCategory['Conference Presentations'].filter((c) => c.layout !== 'closing-summary'),
    ];
    for (const candidate of supplementaryPool) {
      if (existing.length >= 5) break;
      if (!usedLayouts.has(candidate.layout) && !existing.some((s) => s.title === candidate.title)) {
        existing.push({
          ...candidate,
          imageUrl: candidate.imageUrl || tpl.previewImageUrl,
        });
        usedLayouts.add(candidate.layout);
      }
    }
    for (const candidate of supplementaryPool) {
      if (existing.length >= 5) break;
      if (!existing.some((s) => s.title === candidate.title)) {
        existing.push({
          ...candidate,
          imageUrl: candidate.imageUrl || tpl.previewImageUrl,
        });
      }
    }

    // Ensure final slide is always closing-summary
    const hasClosing = existing.some((s) => s.layout === 'closing-summary');
    if (!hasClosing) {
      const closingTemplate = domainPool.find((c) => c.layout === 'closing-summary') || {
        layout: 'closing-summary',
        title: `${tpl.name} — Key Takeaways`,
        subtitle: 'Summary & immediate next steps',
        paragraphs: [tpl.description],
        bullets: [
          'Review core insights and priorities with your team',
          'Customize slides, visuals, and speaker notes to match your audience',
          'Export directly to editable PowerPoint (.pptx) or PDF',
        ],
      };
      existing.push(closingTemplate);
    } else {
      // Move closing-summary to the very end
      const idx = existing.findIndex((s) => s.layout === 'closing-summary');
      if (idx !== -1 && idx !== existing.length - 1) {
        const [closing] = existing.splice(idx, 1);
        existing.push(closing);
      }
    }

    return existing;
  }

  const stmt = db.prepare(`
    INSERT INTO PresentationTemplates (
      id, slug, name, category, description, themeId, previewImageUrl, isPremium, slideCount, sampleSlidesJson, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      description = excluded.description,
      themeId = excluded.themeId,
      previewImageUrl = excluded.previewImageUrl,
      isPremium = excluded.isPremium,
      slideCount = excluded.slideCount,
      sampleSlidesJson = excluded.sampleSlidesJson
  `);

  for (const tpl of templates) {
    const fullStarterSlides = expandToFullStarterDeck(tpl);
    stmt.run(
      `tpl_${tpl.slug}`,
      tpl.slug,
      tpl.name,
      tpl.category,
      tpl.description,
      tpl.themeId,
      tpl.previewImageUrl,
      tpl.isPremium,
      fullStarterSlides.length,
      JSON.stringify(fullStarterSlides),
      now
    );
  }
}

export function getCurrentBillingMonth(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function ensureUsageRecord(userId: string, billingMonth = getCurrentBillingMonth()) {
  const existing = db
    .prepare('SELECT * FROM UsageRecords WHERE userId = ? AND billingMonth = ?')
    .get(userId, billingMonth) as any;
  if (existing) return existing;

  const id = `usage_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO UsageRecords (id, userId, billingMonth, presentationsGenerated, aiEditsCount, imagesGenerated, updatedAt) VALUES (?, ?, ?, 0, 0, 0, ?)'
  ).run(id, userId, billingMonth, now);
  return db
    .prepare('SELECT * FROM UsageRecords WHERE id = ?')
    .get(id) as any;
}

export function ensureSubscriptionForUser(userId: string, email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const isFounderEmail = normalizedEmail === FOUNDER_EMAIL;
  const now = new Date().toISOString();

  let sub = db.prepare('SELECT * FROM Subscriptions WHERE userId = ?').get(userId) as any;

  if (isFounderEmail) {
    // Strictly enforce Founder role & lifetime premium exemption
    db.prepare('UPDATE Users SET role = ?, emailVerified = 1, updatedAt = ? WHERE id = ?').run(
      'FOUNDER',
      now,
      userId
    );
    if (!sub) {
      const subId = `sub_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO Subscriptions (id, userId, planCode, billingCycle, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt)
        VALUES (?, ?, 'FOUNDER_LIFETIME', 'LIFETIME', 'ACTIVE', ?, NULL, 0, ?, ?)
      `).run(subId, userId, now, now, now);
    } else if (sub.planCode !== 'FOUNDER_LIFETIME' || sub.status !== 'ACTIVE') {
      db.prepare(`
        UPDATE Subscriptions
        SET planCode = 'FOUNDER_LIFETIME', billingCycle = 'LIFETIME', status = 'ACTIVE', currentPeriodEnd = NULL, cancelAtPeriodEnd = 0, updatedAt = ?
        WHERE userId = ?
      `).run(now, userId);
    }
    return db.prepare('SELECT * FROM Subscriptions WHERE userId = ?').get(userId) as any;
  }

  // Non-founder accounts can NEVER hold FOUNDER role or FOUNDER_LIFETIME plan
  db.prepare("UPDATE Users SET role = 'USER', updatedAt = ? WHERE id = ? AND role = 'FOUNDER'").run(
    now,
    userId
  );

  if (!sub) {
    const subId = `sub_${crypto.randomUUID()}`;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO Subscriptions (id, userId, planCode, billingCycle, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt)
      VALUES (?, ?, 'FREE', 'MONTHLY', 'ACTIVE', ?, ?, 0, ?, ?)
    `).run(subId, userId, now, periodEnd, now, now);
    sub = db.prepare('SELECT * FROM Subscriptions WHERE id = ?').get(userId) as any;
  } else {
    if (sub.planCode === 'FOUNDER_LIFETIME') {
      db.prepare("UPDATE Subscriptions SET planCode = 'FREE', billingCycle = 'MONTHLY', updatedAt = ? WHERE userId = ?").run(
        now,
        userId
      );
      sub = db.prepare('SELECT * FROM Subscriptions WHERE userId = ?').get(userId) as any;
    }
    // Check subscription expiry for paid plans
    if (sub.planCode !== 'FREE' && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() < Date.now()) {
      if (sub.cancelAtPeriodEnd) {
        db.prepare(`
          UPDATE Subscriptions SET planCode = 'FREE', billingCycle = 'MONTHLY', status = 'EXPIRED', cancelAtPeriodEnd = 0, updatedAt = ? WHERE userId = ?
        `).run(now, userId);
      } else {
        // Mark expired until renewed via verified payment
        db.prepare(`
          UPDATE Subscriptions SET planCode = 'FREE', billingCycle = 'MONTHLY', status = 'EXPIRED', updatedAt = ? WHERE userId = ?
        `).run(now, userId);
      }
      sub = db.prepare('SELECT * FROM Subscriptions WHERE userId = ?').get(userId) as any;
    }
  }
  return sub;
}

export function getEffectivePlanCode(user: any, subscription: any): PlanCode {
  if (user.email.toLowerCase().trim() === FOUNDER_EMAIL && user.role === 'FOUNDER') {
    return 'FOUNDER_LIFETIME';
  }
  if (!subscription || subscription.status !== 'ACTIVE') {
    return 'FREE';
  }
  const code = subscription.planCode as PlanCode;
  if (code === 'FOUNDER_LIFETIME') return 'FREE';
  return code;
}
