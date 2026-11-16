import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import fs from 'fs';
import http from 'http';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  assistSlide,
  buildVerbatimDeck,
  generatePresentationDeck,
  generateSingleSlideOrSummary,
} from './src/server/ai.ts';
import type { SlideAssistAction } from './src/server/ai.ts';
import {
  attachOptionalAuth,
  buildAuthUser,
  clearSessionCookie,
  requireAdminOrFounder,
  requireAuth,
  setSessionCookie,
  signSessionToken,
} from './src/server/auth.ts';
import type { AuthenticatedRequest } from './src/server/auth.ts';
import {
  db,
  ensureSubscriptionForUser,
  ensureUsageRecord,
  FOUNDER_EMAIL,
  getCurrentBillingMonth,
  initDatabase,
} from './src/server/db.ts';
import { extractDocumentStructured } from './src/server/docParser.ts';
import { generateAndroidStudioProjectZip } from './src/server/androidExport.ts';
import { generateOutlineText, generatePdfBuffer, generatePptxBuffer } from './src/server/exporter.ts';
import { CURATED_VISUALS, SUBSCRIPTION_PLANS } from './src/shared/types.ts';
import type { PlanCode, PresentationRecord, SlideData } from './src/shared/types.ts';

dotenv.config();
initDatabase();

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Static assets for uploaded images and generated image library
const uploadsPath = path.join(process.cwd(), 'uploads');
const assetsImagesPath = path.join(process.cwd(), 'src', 'assets', 'images');
app.use('/uploads', express.static(uploadsPath));
app.use('/src/assets/images', express.static(assetsImagesPath));

// Google Play Store Trusted Web Activity (TWA) Digital Asset Links verification endpoint
app.get('/.well-known/assetlinks.json', (_req, res) => {
  const pkgRow = db
    .prepare("SELECT value FROM AppSettings WHERE key = 'play_store_package_name'")
    .get() as { value: string } | undefined;
  const fpRow = db
    .prepare("SELECT value FROM AppSettings WHERE key = 'play_store_sha256_fingerprints'")
    .get() as { value: string } | undefined;

  const packageName =
    (pkgRow?.value || process.env.ANDROID_PACKAGE_NAME || 'com.slidecraft.ai').trim() || 'com.slidecraft.ai';
  const rawFingerprints = fpRow?.value || process.env.ANDROID_SHA256_FINGERPRINTS || '';
  const fingerprints = rawFingerprints
    .split(/[\s,;]+/)
    .map((fp) => fp.trim().toUpperCase())
    .filter((fp) => /^[A-F0-9:]{64,120}$/.test(fp));

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(
    fingerprints.length > 0
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: packageName,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : []
  );
});

// Rate limiters with proxy header support (Cloud Run / nginx) + IPv6 subnet normalization
function getClientIpKey(req: express.Request): string {
  let rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const forwarded = req.headers.forwarded;
  if (typeof forwarded === 'string') {
    const match = forwarded.match(/for="?([^;,\s"]+)"?/i);
    if (match?.[1]) {
      let candidate = match[1].trim();
      // Strip brackets and optional port from RFC 7239 Forwarded values like "[2001:db8::1]:4711" or "1.2.3.4:1234"
      if (candidate.startsWith('[')) {
        const endBracket = candidate.indexOf(']');
        if (endBracket !== -1) candidate = candidate.slice(1, endBracket);
      } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
        candidate = candidate.split(':')[0];
      }
      if (candidate && candidate !== 'unknown' && !candidate.startsWith('_')) {
        rawIp = candidate;
      }
    }
  }
  return ipKeyGenerator(rawIp);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIpKey,
  message: { error: 'Too many authentication attempts. Please wait a few minutes and try again.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIpKey,
  message: { error: 'AI rate limit reached. Please pause briefly before sending another request.' },
});

// Multer storage for image uploads and memory storage for document extraction
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
    cb(null, uploadsPath);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
    cb(null, `img_${Date.now()}_${crypto.randomUUID().slice(0, 8)}${safeExt}`);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function parseSlideRow(row: any): SlideData {
  const safeJson = (val: string | null | undefined, fallback: any) => {
    if (!val) return fallback;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };
  return {
    id: row.id,
    presentationId: row.presentationId,
    slideOrder: row.slideOrder,
    layout: row.layout,
    title: row.title,
    subtitle: row.subtitle || '',
    paragraphs: safeJson(row.paragraphsJson, []),
    bullets: safeJson(row.bulletsJson, []),
    stats: safeJson(row.statsJson, undefined),
    timeline: safeJson(row.timelineJson, undefined),
    processSteps: safeJson(row.processStepsJson, undefined),
    comparison: safeJson(row.comparisonJson, undefined),
    featureCards: safeJson(row.featureCardsJson, undefined),
    quote: safeJson(row.quoteJson, undefined),
    chartData: safeJson(row.chartDataJson, null),
    imageUrl: row.imageUrl || '',
    imageAlt: row.imageAlt || '',
    imagePosition: safeJson(row.imagePositionJson, { x: 0, y: 0, scale: 1 }),
    backgroundColor: row.backgroundColor || '',
    titleFont: row.titleFont || '',
    bodyFont: row.bodyFont || '',
    titleColor: row.titleColor || '',
    bodyColor: row.bodyColor || '',
    titleSize: row.titleSize || 32,
    bodySize: row.bodySize || 16,
    shapes: safeJson(row.shapesJson, []),
    speakerNotes: row.speakerNotes || '',
    updatedAt: row.updatedAt,
  };
}

function saveSlidesForPresentation(presentationId: string, slides: Partial<SlideData>[]) {
  const now = new Date().toISOString();
  const deleteStmt = db.prepare('DELETE FROM PresentationSlides WHERE presentationId = ?');
  const insertStmt = db.prepare(`
    INSERT INTO PresentationSlides (
      id, presentationId, slideOrder, layout, title, subtitle,
      paragraphsJson, bulletsJson, statsJson, timelineJson, processStepsJson,
      comparisonJson, featureCardsJson, quoteJson, chartDataJson,
      imageUrl, imageAlt, imagePositionJson,
      backgroundColor, titleFont, bodyFont, titleColor, bodyColor, titleSize, bodySize,
      shapesJson, speakerNotes, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items: Partial<SlideData>[]) => {
    deleteStmt.run(presentationId);
    items.forEach((s, idx) => {
      insertStmt.run(
        s.id || `slide_${crypto.randomUUID()}`,
        presentationId,
        idx,
        s.layout || 'image-right',
        s.title || `Slide ${idx + 1}`,
        s.subtitle || '',
        JSON.stringify(s.paragraphs || []),
        JSON.stringify(s.bullets || []),
        s.stats ? JSON.stringify(s.stats) : null,
        s.timeline ? JSON.stringify(s.timeline) : null,
        s.processSteps ? JSON.stringify(s.processSteps) : null,
        s.comparison ? JSON.stringify(s.comparison) : null,
        s.featureCards ? JSON.stringify(s.featureCards) : null,
        s.quote ? JSON.stringify(s.quote) : null,
        s.chartData ? JSON.stringify(s.chartData) : null,
        s.imageUrl || '',
        s.imageAlt || '',
        JSON.stringify(s.imagePosition || { x: 0, y: 0, scale: 1 }),
        s.backgroundColor || '',
        s.titleFont || '',
        s.bodyFont || '',
        s.titleColor || '',
        s.bodyColor || '',
        s.titleSize || 32,
        s.bodySize || 16,
        JSON.stringify(s.shapes || []),
        s.speakerNotes || '',
        now
      );
    });
  });

  tx(slides);
}

function getFirebaseConfig(): { projectId?: string; apiKey?: string; oAuthClientId?: string } {
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
  } catch {
    // ignore missing or malformed config
  }
  return {};
}

// ---------------- HEALTH & CONFIG ----------------
app.get('/api/config/public', (_req, res) => {
  const fbCfg = getFirebaseConfig();
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || fbCfg.oAuthClientId || '',
    firebaseAuthEnabled: Boolean(fbCfg.apiKey && fbCfg.projectId),
    razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

// ---------------- AUTHENTICATION ----------------
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { email, password, name } = req.body || {};
  const cleanEmail = String(email || '').toLowerCase().trim();
  const cleanName = String(name || '').trim();
  const rawPassword = String(password || '');

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (rawPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }
  if (!cleanName) {
    res.status(400).json({ error: 'Please enter your full name.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM Users WHERE email = ?').get(cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    return;
  }

  const userId = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(rawPassword, 10);
  const role = cleanEmail === FOUNDER_EMAIL ? 'FOUNDER' : 'USER';

  db.prepare(`
    INSERT INTO Users (id, email, passwordHash, name, role, emailVerified, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, cleanEmail, passwordHash, cleanName, role, 1, now, now);

  db.prepare(`
    INSERT INTO UserProfiles (userId, organization, jobTitle, preferredLanguage, updatedAt)
    VALUES (?, '', '', 'English', ?)
  `).run(userId, now);

  ensureSubscriptionForUser(userId, cleanEmail);
  ensureUsageRecord(userId);

  const token = signSessionToken(userId, cleanEmail);
  setSessionCookie(res, token);
  const authUser = buildAuthUser(userId);
  res.status(201).json({ user: authUser, token });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').toLowerCase().trim();
  const rawPassword = String(password || '');

  if (!cleanEmail || !rawPassword) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db.prepare('SELECT * FROM Users WHERE email = ?').get(cleanEmail) as any;
  if (!user || !bcrypt.compareSync(rawPassword, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signSessionToken(user.id, user.email);
  setSessionCookie(res, token);
  const authUser = buildAuthUser(user.id);
  res.json({ user: authUser, token });
});

app.post('/api/auth/google', authLimiter, async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ error: 'Missing Google authentication token.' });
    return;
  }

  const fbCfg = getFirebaseConfig();
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  try {
    let verifiedEmail = '';
    let verifiedName = '';
    let verifiedPicture = '';

    if (fbCfg.apiKey && fbCfg.projectId) {
      // Decode JWT payload to verify audience & issuer belong to this Firebase project
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        res.status(401).json({ error: 'Malformed Firebase ID token.' });
        return;
      }
      let claims: any;
      try {
        claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      } catch {
        res.status(401).json({ error: 'Malformed Firebase ID token.' });
        return;
      }
      if (
        claims.aud !== fbCfg.projectId ||
        claims.iss !== `https://securetoken.google.com/${fbCfg.projectId}`
      ) {
        res.status(401).json({ error: 'Token audience mismatch.' });
        return;
      }

      // Cryptographically verify token against Firebase Identity Toolkit
      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbCfg.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (!lookupRes.ok) {
        res.status(401).json({ error: 'Failed to verify Google sign-in with Firebase.' });
        return;
      }
      const lookupData = (await lookupRes.json()) as any;
      const fbUser = lookupData?.users?.[0];
      if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
        res.status(401).json({ error: 'Google account email could not be verified.' });
        return;
      }
      verifiedEmail = String(fbUser.email).toLowerCase().trim();
      verifiedName = String(fbUser.displayName || verifiedEmail.split('@')[0]);
      verifiedPicture = String(fbUser.photoUrl || '');
    } else if (googleClientId) {
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
      );
      if (!verifyRes.ok) {
        res.status(401).json({ error: 'Invalid Google authentication token.' });
        return;
      }
      const payload = (await verifyRes.json()) as any;
      if (payload.aud !== googleClientId || payload.email_verified !== 'true') {
        res.status(401).json({ error: 'Google account email could not be verified.' });
        return;
      }
      verifiedEmail = String(payload.email).toLowerCase().trim();
      verifiedName = String(payload.name || verifiedEmail.split('@')[0]);
      verifiedPicture = String(payload.picture || '');
    } else {
      res.status(503).json({
        error: 'Google Sign-In is not configured on the server.',
      });
      return;
    }

    let user = db.prepare('SELECT * FROM Users WHERE email = ?').get(verifiedEmail) as any;
    const now = new Date().toISOString();

    if (!user) {
      const userId = `usr_${crypto.randomUUID()}`;
      const randomPassHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
      const role = verifiedEmail === FOUNDER_EMAIL ? 'FOUNDER' : 'USER';
      db.prepare(`
        INSERT INTO Users (id, email, passwordHash, name, role, emailVerified, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(userId, verifiedEmail, randomPassHash, verifiedName, role, now, now);

      db.prepare(`
        INSERT INTO UserProfiles (userId, organization, jobTitle, preferredLanguage, avatarUrl, updatedAt)
        VALUES (?, '', '', 'English', ?, ?)
      `).run(userId, verifiedPicture, now);

      user = db.prepare('SELECT * FROM Users WHERE id = ?').get(userId) as any;
    }

    const token = signSessionToken(user.id, user.email);
    setSessionCookie(res, token);
    const authUser = buildAuthUser(user.id);
    res.json({ user: authUser, token });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Google authentication failed.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.authUser });
});

app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  const cleanEmail = String(req.body?.email || '').toLowerCase().trim();
  const user = db.prepare('SELECT id FROM Users WHERE email = ?').get(cleanEmail) as any;
  if (!user) {
    res.json({
      message: 'If an account matches that email, a password reset code has been generated.',
    });
    return;
  }

  const resetCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO PasswordResets (id, userId, token, expiresAt, used, createdAt)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(`rst_${crypto.randomUUID()}`, user.id, resetCode, expiresAt, new Date().toISOString());

  res.json({
    message:
      'Password reset code generated (valid for 15 minutes). Since SMTP email delivery is not configured, use this verification code below.',
    devResetCode: resetCode,
  });
});

app.post('/api/auth/reset-password', authLimiter, (req, res) => {
  const cleanEmail = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }

  const user = db.prepare('SELECT id FROM Users WHERE email = ?').get(cleanEmail) as any;
  if (!user) {
    res.status(400).json({ error: 'Invalid email or reset code.' });
    return;
  }

  const resetRow = db
    .prepare(
      'SELECT * FROM PasswordResets WHERE userId = ? AND token = ? AND used = 0 ORDER BY createdAt DESC LIMIT 1'
    )
    .get(user.id, code) as any;

  if (!resetRow || new Date(resetRow.expiresAt).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset code is invalid or expired.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE Users SET passwordHash = ?, updatedAt = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10),
    now,
    user.id
  );
  db.prepare('UPDATE PasswordResets SET used = 1 WHERE id = ?').run(resetRow.id);

  res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
});

app.put('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.authUser!.id;
  const { name, organization, jobTitle, preferredLanguage } = req.body || {};
  const now = new Date().toISOString();

  if (name && String(name).trim()) {
    db.prepare('UPDATE Users SET name = ?, updatedAt = ? WHERE id = ?').run(
      String(name).trim(),
      now,
      userId
    );
  }
  db.prepare(`
    INSERT INTO UserProfiles (userId, organization, jobTitle, preferredLanguage, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET
      organization = excluded.organization,
      jobTitle = excluded.jobTitle,
      preferredLanguage = excluded.preferredLanguage,
      updatedAt = excluded.updatedAt
  `).run(
    userId,
    String(organization || '').trim(),
    String(jobTitle || '').trim(),
    String(preferredLanguage || 'English').trim(),
    now
  );

  res.json({ user: buildAuthUser(userId) });
});

// ---------------- TEMPLATES & FAVORITES ----------------
app.get('/api/templates', attachOptionalAuth, (req: AuthenticatedRequest, res) => {
  const rows = db.prepare('SELECT * FROM PresentationTemplates ORDER BY isPremium ASC, name ASC').all() as any[];
  const favSet = new Set<string>();
  if (req.authUser) {
    const favs = db
      .prepare('SELECT templateId FROM Favorites WHERE userId = ?')
      .all(req.authUser.id) as any[];
    favs.forEach((f) => favSet.add(f.templateId));
  }

  const templates = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    description: r.description,
    themeId: r.themeId,
    previewImageUrl: r.previewImageUrl,
    isPremium: Boolean(r.isPremium),
    slideCount: r.slideCount,
    isFavorited: favSet.has(r.id),
    sampleSlides: JSON.parse(r.sampleSlidesJson || '[]'),
  }));

  res.json({ templates });
});

app.post('/api/templates/:id/favorite', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.authUser!.id;
  const templateId = req.params.id;
  const existing = db
    .prepare('SELECT id FROM Favorites WHERE userId = ? AND templateId = ?')
    .get(userId, templateId) as any;

  if (existing) {
    db.prepare('DELETE FROM Favorites WHERE id = ?').run(existing.id);
    res.json({ favorited: false });
  } else {
    db.prepare('INSERT INTO Favorites (id, userId, templateId, createdAt) VALUES (?, ?, ?, ?)').run(
      `fav_${crypto.randomUUID()}`,
      userId,
      templateId,
      new Date().toISOString()
    );
    res.json({ favorited: true });
  }
});

app.post('/api/templates/:id/use', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const tpl = db.prepare('SELECT * FROM PresentationTemplates WHERE id = ?').get(req.params.id) as any;
  if (!tpl) {
    res.status(404).json({ error: 'Template not found.' });
    return;
  }

  const plan = SUBSCRIPTION_PLANS[user.subscription.planCode];
  if (tpl.isPremium && !user.isFounder && !plan.allowsPremiumTemplates) {
    res.status(403).json({
      error: 'This premium template requires a Pro, Business, or Founder account.',
      upgradeRequired: true,
    });
    return;
  }

  const presentationId = `pres_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO Presentations (
      id, userId, title, topic, sourceType, audience, purpose, style, language, aspectRatio, themeId, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, 'template', 'General audience', ?, 'Professional', 'English', '16:9', ?, 'READY', ?, ?)
  `).run(presentationId, user.id, tpl.name, tpl.description, tpl.category, tpl.themeId, now, now);

  const sampleSlides = JSON.parse(tpl.sampleSlidesJson || '[]') as Partial<SlideData>[];
  const slidesToSave =
    sampleSlides.length > 0
      ? sampleSlides
      : [
          {
            layout: 'full-image-title' as const,
            title: tpl.name,
            subtitle: tpl.description,
            imageUrl: tpl.previewImageUrl,
            paragraphs: ['Created from template'],
            bullets: [],
          },
        ];

  saveSlidesForPresentation(presentationId, slidesToSave);
  res.status(201).json({ presentationId });
});

// ---------------- DOCUMENT EXTRACTION & IMAGES ----------------
app.post('/api/presentations/extract-document', requireAuth, uploadDoc.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Please select a PDF, DOCX, TXT, or PPTX file.' });
    return;
  }
  try {
    const result = await extractDocumentStructured(req.file.buffer, req.file.originalname);
    res.json({
      fileName: req.file.originalname,
      extractedText: result.text,
      sections: result.sections,
      detectedSlideCount: result.detectedSlideCount,
      fileType: result.fileType,
      characterCount: result.text.length,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to read uploaded document.' });
  }
});

app.get('/api/images', requireAuth, (req: AuthenticatedRequest, res) => {
  const uploaded = db
    .prepare('SELECT * FROM PresentationImages WHERE userId = ? ORDER BY createdAt DESC LIMIT 50')
    .all(req.authUser!.id) as any[];
  res.json({
    curated: CURATED_VISUALS,
    uploaded,
  });
});

app.post('/api/images/upload', requireAuth, uploadImage.single('image'), (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  const id = `img_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO PresentationImages (id, userId, presentationId, slideId, url, altText, sourceType, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 'upload', ?)
  `).run(
    id,
    req.authUser!.id,
    req.body?.presentationId || null,
    req.body?.slideId || null,
    url,
    req.body?.altText || req.file.originalname,
    now
  );

  res.status(201).json({ id, url, altText: req.file.originalname });
});

// ---------------- PRESENTATIONS & AI GENERATION ----------------
app.get('/api/presentations', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM Presentations WHERE userId = ? ORDER BY updatedAt DESC')
    .all(req.authUser!.id) as any[];

  const slideCountStmt = db.prepare('SELECT COUNT(*) as count FROM PresentationSlides WHERE presentationId = ?');
  const firstSlideStmt = db.prepare(
    'SELECT * FROM PresentationSlides WHERE presentationId = ? ORDER BY slideOrder ASC LIMIT 1'
  );

  const presentations: PresentationRecord[] = rows.map((r) => {
    const countRow = slideCountStmt.get(r.id) as any;
    const thumbRow = firstSlideStmt.get(r.id) as any;
    return {
      ...r,
      slideCount: countRow?.count || 0,
      thumbnailSlide: thumbRow ? parseSlideRow(thumbRow) : null,
    };
  });

  res.json({ presentations });
});

app.get('/api/presentations/:id', attachOptionalAuth, (req: AuthenticatedRequest, res) => {
  const pres = db.prepare('SELECT * FROM Presentations WHERE id = ?').get(req.params.id) as any;
  if (!pres) {
    res.status(404).json({ error: 'Presentation not found.' });
    return;
  }

  const isOwner = req.authUser && (req.authUser.id === pres.userId || req.authUser.isFounder);
  if (!isOwner && !pres.shareSlug) {
    res.status(403).json({ error: 'You do not have permission to view this presentation.' });
    return;
  }

  const slideRows = db
    .prepare('SELECT * FROM PresentationSlides WHERE presentationId = ? ORDER BY slideOrder ASC')
    .all(pres.id) as any[];

  res.json({
    presentation: {
      ...pres,
      slides: slideRows.map(parseSlideRow),
    },
  });
});

app.get('/api/share/:slug', (req, res) => {
  const pres = db.prepare('SELECT * FROM Presentations WHERE shareSlug = ?').get(req.params.slug) as any;
  if (!pres) {
    res.status(404).json({ error: 'Shared presentation not found.' });
    return;
  }
  const slideRows = db
    .prepare('SELECT * FROM PresentationSlides WHERE presentationId = ? ORDER BY slideOrder ASC')
    .all(pres.id) as any[];
  res.json({
    presentation: {
      ...pres,
      slides: slideRows.map(parseSlideRow),
    },
  });
});

app.post('/api/presentations/generate', requireAuth, aiLimiter, async (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const plan = SUBSCRIPTION_PLANS[user.subscription.planCode];
  const billingMonth = getCurrentBillingMonth();
  const usage = ensureUsageRecord(user.id, billingMonth);

  // Fair-use check for Founder, strict plan check for normal users
  if (user.isFounder) {
    const fairUseRow = db
      .prepare("SELECT value FROM AppSettings WHERE key = 'founder_daily_fair_use_limit'")
      .get() as any;
    const dailyLimit = Number(fairUseRow?.value || 200);
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todayCount = db
      .prepare("SELECT COUNT(*) as c FROM AIRequests WHERE userId = ? AND status = 'SUCCESS' AND createdAt LIKE ?")
      .get(user.id, `${todayPrefix}%`) as any;
    if ((todayCount?.c || 0) >= dailyLimit) {
      res.status(429).json({
        error: `Daily fair-use safeguard (${dailyLimit} AI requests/day) reached. You can adjust this in Founder Settings.`,
      });
      return;
    }
  } else {
    if (usage.presentationsGenerated >= plan.monthlyPresentationsLimit) {
      res.status(403).json({
        error: `Monthly presentation limit (${plan.monthlyPresentationsLimit}) reached for your ${plan.name} plan. Upgrade your plan to create more presentations.`,
        upgradeRequired: true,
      });
      return;
    }
  }

  const {
    sourceType = 'topic',
    content,
    slideCount = 8,
    audience = 'General audience',
    purpose = 'Education',
    writingStyle = 'Professional',
    language = 'English',
    aspectRatio = '16:9',
    themeId,
    templateId,
    selectedImageUrls,
    preserveExactContent = false,
    matchSourceSlides = false,
    sections,
    uploadedFileName,
  } = req.body || {};

  const safeSelectedImageUrls: string[] = Array.isArray(selectedImageUrls)
    ? selectedImageUrls
        .map((u: unknown) => String(u || '').trim())
        .filter((u: string) => u.startsWith('/uploads/') || u.startsWith('/src/assets/images/'))
        .slice(0, 30)
    : [];

  let selectedTemplate: any = null;
  if (templateId && typeof templateId === 'string') {
    selectedTemplate = db.prepare('SELECT * FROM PresentationTemplates WHERE id = ?').get(templateId) as any;
    if (selectedTemplate && selectedTemplate.isPremium && !user.isFounder && !plan.allowsPremiumTemplates) {
      res.status(403).json({
        error: 'This premium template design requires a Pro, Business, or Founder account.',
        upgradeRequired: true,
      });
      return;
    }
  }

  const effectiveThemeId = themeId || selectedTemplate?.themeId;

  const cleanContent = String(content || '').trim();
  if (cleanContent.length < 3 && (!Array.isArray(sections) || sections.length === 0)) {
    res.status(400).json({ error: 'Please provide a topic, text, outline, or uploaded document.' });
    return;
  }

  const isVerbatim = Boolean(preserveExactContent);
  const minSlidesAllowed = isVerbatim ? 1 : 2;
  const effectiveSourceCount = Array.isArray(sections) && sections.length > 0 ? sections.length : Number(slideCount) || 8;
  const requestedSlides = Math.max(
    minSlidesAllowed,
    Math.min(50, isVerbatim && matchSourceSlides ? effectiveSourceCount : Number(slideCount) || 8)
  );

  if (!user.isFounder && requestedSlides > plan.maxSlidesPerPresentation) {
    res.status(403).json({
      error: `Your ${plan.name} plan allows up to ${plan.maxSlidesPerPresentation} slides per presentation. Upgrade to generate ${requestedSlides} slides.`,
      upgradeRequired: true,
    });
    return;
  }

  const selectedTemplateLayouts = selectedTemplate
    ? (JSON.parse(selectedTemplate.sampleSlidesJson || '[]') as Array<{ layout?: any }>)
        .map((s) => s.layout)
        .filter(Boolean)
    : undefined;

  const presentationId = `pres_${crypto.randomUUID()}`;
  try {
    const generated = isVerbatim
      ? buildVerbatimDeck({
          content: cleanContent,
          sections: Array.isArray(sections) ? sections : undefined,
          requestedSlideCount: requestedSlides,
          matchSourceSlides: Boolean(matchSourceSlides),
          preferredThemeId: effectiveThemeId,
          preferredImageUrl: selectedTemplate?.previewImageUrl || undefined,
          selectedImageUrls: safeSelectedImageUrls.length > 0 ? safeSelectedImageUrls : undefined,
          fallbackTitle: typeof uploadedFileName === 'string' && uploadedFileName ? uploadedFileName.replace(/\.[^.]+$/, '') : undefined,
          maxSlidesAllowed: user.isFounder ? 50 : plan.maxSlidesPerPresentation,
        })
      : await generatePresentationDeck({
          userId: user.id,
          presentationId,
          sourceType,
          content: cleanContent,
          slideCount: requestedSlides,
          audience,
          purpose,
          writingStyle,
          language,
          aspectRatio: aspectRatio === '4:3' ? '4:3' : '16:9',
          includeSpeakerNotes: user.isFounder || plan.allowsSpeakerNotes,
          includeCharts: user.isFounder || plan.allowsChartsAndDiagrams,
          preferredThemeId: effectiveThemeId,
          templateName: selectedTemplate?.name,
          templateCategory: selectedTemplate?.category,
          templateDescription: selectedTemplate?.description,
          templateImageUrl: selectedTemplate?.previewImageUrl,
          templateLayouts: selectedTemplateLayouts,
          selectedImageUrls: safeSelectedImageUrls.length > 0 ? safeSelectedImageUrls : undefined,
        });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO Presentations (
        id, userId, title, topic, sourceType, audience, purpose, style, language, aspectRatio, themeId, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY', ?, ?)
    `).run(
      presentationId,
      user.id,
      generated.deckTitle,
      cleanContent.slice(0, 240),
      sourceType,
      audience,
      purpose,
      writingStyle,
      language,
      aspectRatio === '4:3' ? '4:3' : '16:9',
      generated.recommendedThemeId || 'navy-indigo',
      now,
      now
    );

    saveSlidesForPresentation(presentationId, generated.slides);

    // Only increment credits AFTER successful generation & persistence
    db.prepare(`
      UPDATE UsageRecords SET presentationsGenerated = presentationsGenerated + 1, updatedAt = ?
      WHERE userId = ? AND billingMonth = ?
    `).run(now, user.id, billingMonth);

    res.status(201).json({
      presentationId,
      user: buildAuthUser(user.id),
    });
  } catch (err: any) {
    // Failed generations do NOT consume credits!
    res.status(500).json({
      error: err?.message || 'Presentation generation failed. No presentation credits were consumed.',
    });
  }
});

app.patch('/api/presentations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const pres = db.prepare('SELECT * FROM Presentations WHERE id = ?').get(req.params.id) as any;
  if (!pres || (pres.userId !== req.authUser!.id && !req.authUser!.isFounder)) {
    res.status(404).json({ error: 'Presentation not found.' });
    return;
  }

  const { title, themeId, aspectRatio, toggleShare } = req.body || {};
  const now = new Date().toISOString();
  let nextShareSlug = pres.shareSlug;
  if (toggleShare === true && !nextShareSlug) {
    nextShareSlug = crypto.randomBytes(6).toString('hex');
  } else if (toggleShare === false) {
    nextShareSlug = null;
  }

  db.prepare(`
    UPDATE Presentations
    SET title = ?, themeId = ?, aspectRatio = ?, shareSlug = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    title ? String(title).trim() : pres.title,
    themeId || pres.themeId,
    aspectRatio === '4:3' || aspectRatio === '16:9' ? aspectRatio : pres.aspectRatio,
    nextShareSlug,
    now,
    pres.id
  );

  const updated = db.prepare('SELECT * FROM Presentations WHERE id = ?').get(pres.id);
  res.json({ presentation: updated });
});

app.post('/api/presentations/:id/duplicate', requireAuth, (req: AuthenticatedRequest, res) => {
  const pres = db.prepare('SELECT * FROM Presentations WHERE id = ?').get(req.params.id) as any;
  if (!pres || (pres.userId !== req.authUser!.id && !req.authUser!.isFounder)) {
    res.status(404).json({ error: 'Presentation not found.' });
    return;
  }

  const newId = `pres_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO Presentations (
      id, userId, title, topic, sourceType, audience, purpose, style, language, aspectRatio, themeId, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    req.authUser!.id,
    `${pres.title} (Copy)`,
    pres.topic,
    pres.sourceType,
    pres.audience,
    pres.purpose,
    pres.style,
    pres.language,
    pres.aspectRatio,
    pres.themeId,
    pres.status,
    now,
    now
  );

  const slides = db
    .prepare('SELECT * FROM PresentationSlides WHERE presentationId = ? ORDER BY slideOrder ASC')
    .all(pres.id) as any[];
  saveSlidesForPresentation(
    newId,
    slides.map((s) => ({ ...parseSlideRow(s), id: undefined }))
  );

  res.status(201).json({ presentationId: newId });
});

app.delete('/api/presentations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const pres = db.prepare('SELECT * FROM Presentations WHERE id = ?').get(req.params.id) as any;
  if (!pres || (pres.userId !== req.authUser!.id && !req.authUser!.isFounder)) {
    res.status(404).json({ error: 'Presentation not found.' });
    return;
  }
  db.prepare('DELETE FROM Presentations WHERE id = ?').run(pres.id);
  res.json({ ok: true });
});

app.put('/api/presentations/:id/slides', requireAuth, (req: AuthenticatedRequest, res) => {
  const pres = db.prepare('SELECT * FROM Presentations WHERE id = ?').get(req.params.id) as any;
  if (!pres || (pres.userId !== req.authUser!.id && !req.authUser!.isFounder)) {
    res.status(404).json({ error: 'Presentation not found.' });
    return;
  }

  const slides = Array.isArray(req.body?.slides) ? req.body.slides : null;
  if (!slides) {
    res.status(400).json({ error: 'Invalid slides payload.' });
    return;
  }

  saveSlidesForPresentation(pres.id, slides);
  db.prepare('UPDATE Presentations SET updatedAt = ? WHERE id = ?').run(new Date().toISOString(), pres.id);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

// ---------------- AI SLIDE ASSISTANT ----------------
app.post('/api/ai/slide-assist', requireAuth, aiLimiter, async (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const plan = SUBSCRIPTION_PLANS[user.subscription.planCode];
  const billingMonth = getCurrentBillingMonth();
  const usage = ensureUsageRecord(user.id, billingMonth);

  if (!user.isFounder && usage.aiEditsCount >= plan.aiEditsLimit) {
    res.status(403).json({
      error: `Monthly AI editing limit (${plan.aiEditsLimit}) reached for your ${plan.name} plan.`,
      upgradeRequired: true,
    });
    return;
  }

  const { presentationId, slide, action, targetTone, language } = req.body || {};
  if (!presentationId || !slide || !action) {
    res.status(400).json({ error: 'Missing required slide assist parameters.' });
    return;
  }

  if (action === 'speaker-notes' && !user.isFounder && !plan.allowsSpeakerNotes) {
    res.status(403).json({
      error: 'AI Speaker Notes generation requires Pro, Business, or Founder access.',
      upgradeRequired: true,
    });
    return;
  }

  try {
    const patch = await assistSlide({
      userId: user.id,
      presentationId,
      slide,
      action: action as SlideAssistAction,
      targetTone,
      language,
    });

    db.prepare('UPDATE UsageRecords SET aiEditsCount = aiEditsCount + 1, updatedAt = ? WHERE userId = ? AND billingMonth = ?').run(
      new Date().toISOString(),
      user.id,
      billingMonth
    );

    res.json({ patch, user: buildAuthUser(user.id) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'AI slide assistant failed.' });
  }
});

app.post('/api/ai/deck-assist', requireAuth, aiLimiter, async (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const plan = SUBSCRIPTION_PLANS[user.subscription.planCode];
  const billingMonth = getCurrentBillingMonth();
  const usage = ensureUsageRecord(user.id, billingMonth);

  if (!user.isFounder && usage.aiEditsCount >= plan.aiEditsLimit) {
    res.status(403).json({
      error: `Monthly AI editing limit (${plan.aiEditsLimit}) reached.`,
      upgradeRequired: true,
    });
    return;
  }

  const { presentationId, mode, deckTitle, language, prompt, existingTitles } = req.body || {};
  if (!presentationId || !mode) {
    res.status(400).json({ error: 'Missing deck assist parameters.' });
    return;
  }

  try {
    const slide = await generateSingleSlideOrSummary({
      userId: user.id,
      presentationId,
      mode,
      deckTitle: deckTitle || 'Presentation',
      language: language || 'English',
      prompt,
      existingTitles: Array.isArray(existingTitles) ? existingTitles : [],
    });

    db.prepare('UPDATE UsageRecords SET aiEditsCount = aiEditsCount + 1, updatedAt = ? WHERE userId = ? AND billingMonth = ?').run(
      new Date().toISOString(),
      user.id,
      billingMonth
    );

    res.json({
      slide: {
        ...slide,
        id: `slide_${crypto.randomUUID()}`,
        presentationId,
      },
      user: buildAuthUser(user.id),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate slide.' });
  }
});

// ---------------- REAL PPTX, PDF & TXT EXPORTS ----------------
app.get('/api/presentations/:id/export/:format', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const pres = db.prepare('SELECT * FROM Presentations WHERE id = ?').get(req.params.id) as any;
  if (!pres || (pres.userId !== user.id && !user.isFounder)) {
    res.status(404).json({ error: 'Presentation not found.' });
    return;
  }

  const format = String(req.params.format || '').toLowerCase();
  const plan = SUBSCRIPTION_PLANS[user.subscription.planCode];

  if (format === 'pdf' && !user.isFounder && !plan.allowsPdfExport) {
    res.status(403).json({
      error: 'PDF export is available on Starter, Pro, Business, and Founder plans.',
      upgradeRequired: true,
    });
    return;
  }

  const slideRows = db
    .prepare('SELECT * FROM PresentationSlides WHERE presentationId = ? ORDER BY slideOrder ASC')
    .all(pres.id) as any[];
  const slides = slideRows.map(parseSlideRow);
  const safeName = pres.title.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'presentation';

  try {
    if (format === 'pptx') {
      const buf = await generatePptxBuffer(pres, slides);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pptx"`);
      res.send(buf);
      return;
    }

    if (format === 'pdf') {
      const buf = await generatePdfBuffer(pres, slides);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.send(buf);
      return;
    }

    if (format === 'txt') {
      const txt = generateOutlineText(pres, slides);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_outline.txt"`);
      res.send(txt);
      return;
    }

    res.status(400).json({ error: 'Unsupported export format. Use pptx, pdf, or txt.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Export generation failed.' });
  }
});

// ---------------- RAZORPAY SUBSCRIPTIONS & BILLING ----------------
app.get('/api/billing/status', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const payments = db
    .prepare('SELECT * FROM Payments WHERE userId = ? ORDER BY createdAt DESC LIMIT 20')
    .all(user.id) as any[];
  const promotions = db
    .prepare('SELECT code, discountPercent, description, validUntil FROM Promotions WHERE active = 1')
    .all() as any[];

  res.json({
    razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    subscription: user.subscription,
    payments,
    promotions,
  });
});

app.post('/api/billing/create-order', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  if (user.isFounder) {
    res.status(400).json({
      error: 'Founder account has permanent Lifetime Premium access. No subscription payment is required.',
    });
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    res.status(503).json({
      error:
        'Razorpay payment credentials are not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings > Secrets to enable live INR checkout.',
      missingCredentials: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    });
    return;
  }

  const { planCode, billingCycle = 'MONTHLY', promoCode } = req.body || {};
  const plan = SUBSCRIPTION_PLANS[planCode as PlanCode];
  if (!plan || plan.code === 'FREE' || plan.code === 'FOUNDER_LIFETIME') {
    res.status(400).json({ error: 'Please select a valid paid plan (STARTER, PRO, or BUSINESS).' });
    return;
  }

  const cycle = billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
  let amountInr = cycle === 'ANNUAL' ? plan.annualPriceInr : plan.monthlyPriceInr;

  if (promoCode) {
    const promo = db
      .prepare('SELECT * FROM Promotions WHERE UPPER(code) = UPPER(?) AND active = 1')
      .get(String(promoCode).trim()) as any;
    if (promo && (!promo.validUntil || new Date(promo.validUntil).getTime() > Date.now())) {
      amountInr = Math.max(1, Math.round(amountInr * (1 - promo.discountPercent / 100)));
    }
  }

  const amountPaise = amountInr * 100;
  const receipt = `sc_${Date.now()}_${user.id.slice(0, 8)}`;

  try {
    const authToken = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          userId: user.id,
          planCode: plan.code,
          billingCycle: cycle,
        },
      }),
    });

    const orderData = (await rzpRes.json()) as any;
    if (!rzpRes.ok || !orderData.id) {
      res.status(502).json({
        error: orderData?.error?.description || 'Failed to create Razorpay order.',
      });
      return;
    }

    const subRow = db.prepare('SELECT id FROM Subscriptions WHERE userId = ?').get(user.id) as any;
    const paymentId = `pay_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO Payments (
        id, userId, subscriptionId, amountInr, currency, billingCycle, planCode, razorpayOrderId, status, createdAt
      ) VALUES (?, ?, ?, ?, 'INR', ?, ?, ?, 'CREATED', ?)
    `).run(
      paymentId,
      user.id,
      subRow?.id || null,
      amountInr,
      cycle,
      plan.code,
      orderData.id,
      new Date().toISOString()
    );

    res.json({
      orderId: orderData.id,
      amountPaise,
      amountInr,
      currency: 'INR',
      keyId,
      planName: plan.name,
      billingCycle: cycle,
      prefill: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error connecting to Razorpay API.' });
  }
});

app.post('/api/billing/verify-payment', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    res.status(503).json({ error: 'Razorpay secret is not configured.' });
    return;
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing Razorpay payment verification fields.' });
    return;
  }

  const paymentRow = db
    .prepare('SELECT * FROM Payments WHERE razorpayOrderId = ? AND userId = ?')
    .get(razorpay_order_id, user.id) as any;
  if (!paymentRow) {
    res.status(404).json({ error: 'Payment order record not found.' });
    return;
  }

  const expectedSig = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isValid =
    expectedSig.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(razorpay_signature));

  if (!isValid) {
    db.prepare("UPDATE Payments SET status = 'FAILED', razorpayPaymentId = ? WHERE id = ?").run(
      razorpay_payment_id,
      paymentRow.id
    );
    res.status(400).json({ error: 'Payment signature verification failed. Subscription was not activated.' });
    return;
  }

  const now = new Date();
  const durationDays = paymentRow.billingCycle === 'ANNUAL' ? 365 : 30;
  const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  db.transaction(() => {
    db.prepare(`
      UPDATE Payments
      SET status = 'PAID', razorpayPaymentId = ?, razorpaySignature = ?
      WHERE id = ?
    `).run(razorpay_payment_id, razorpay_signature, paymentRow.id);

    db.prepare(`
      UPDATE Subscriptions
      SET planCode = ?, billingCycle = ?, status = 'ACTIVE', currentPeriodStart = ?, currentPeriodEnd = ?, cancelAtPeriodEnd = 0, updatedAt = ?
      WHERE userId = ?
    `).run(
      paymentRow.planCode,
      paymentRow.billingCycle,
      now.toISOString(),
      periodEnd,
      now.toISOString(),
      user.id
    );
  })();

  res.json({ ok: true, user: buildAuthUser(user.id) });
});

app.post('/api/billing/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  if (user.isFounder) {
    res.status(400).json({ error: 'Founder lifetime access does not expire or require cancellation.' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE Subscriptions SET cancelAtPeriodEnd = 1, updatedAt = ? WHERE userId = ?').run(
    now,
    user.id
  );
  res.json({ ok: true, user: buildAuthUser(user.id) });
});

app.post('/api/billing/downgrade-free', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  if (user.isFounder) {
    res.status(400).json({ error: 'Founder lifetime access cannot be downgraded via billing.' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE Subscriptions
    SET planCode = 'FREE', billingCycle = 'MONTHLY', status = 'ACTIVE', cancelAtPeriodEnd = 0, updatedAt = ?
    WHERE userId = ?
  `).run(now, user.id);
  res.json({ ok: true, user: buildAuthUser(user.id) });
});

// ---------------- FOUNDER & ADMIN DASHBOARD ----------------
app.get('/api/admin/overview', requireAuth, requireAdminOrFounder, (_req, res) => {
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM Users').get() as any).c;
  const activePaidSubs = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM Subscriptions WHERE status = 'ACTIVE' AND planCode IN ('STARTER', 'PRO', 'BUSINESS')"
      )
      .get() as any
  ).c;
  const totalPresentations = (db.prepare('SELECT COUNT(*) as c FROM Presentations').get() as any).c;
  const totalSlides = (db.prepare('SELECT COUNT(*) as c FROM PresentationSlides').get() as any).c;
  const paidRevenueRow = db
    .prepare("SELECT COALESCE(SUM(amountInr), 0) as total FROM Payments WHERE status = 'PAID'")
    .get() as any;

  const aiStats = db
    .prepare(`
      SELECT
        COUNT(*) as totalRequests,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedRequests,
        COALESCE(SUM(inputTokens), 0) as totalInputTokens,
        COALESCE(SUM(outputTokens), 0) as totalOutputTokens,
        COALESCE(SUM(estimatedCostUsd), 0) as totalCostUsd
      FROM AIRequests
    `)
    .get() as any;

  const users = db
    .prepare(`
      SELECT u.id, u.email, u.name, u.role, u.emailVerified, u.createdAt,
             s.planCode, s.billingCycle, s.status as subStatus, s.currentPeriodEnd,
             COALESCE(ur.presentationsGenerated, 0) as monthlyPresentations,
             COALESCE(ur.aiEditsCount, 0) as monthlyAiEdits
      FROM Users u
      LEFT JOIN Subscriptions s ON s.userId = u.id
      LEFT JOIN UsageRecords ur ON ur.userId = u.id AND ur.billingMonth = ?
      ORDER BY u.createdAt DESC
    `)
    .all(getCurrentBillingMonth()) as any[];

  const payments = db
    .prepare(`
      SELECT p.*, u.email as userEmail, u.name as userName
      FROM Payments p
      LEFT JOIN Users u ON u.id = p.userId
      ORDER BY p.createdAt DESC LIMIT 50
    `)
    .all() as any[];

  const failedAIRequests = db
    .prepare(`
      SELECT a.*, u.email as userEmail
      FROM AIRequests a
      LEFT JOIN Users u ON u.id = a.userId
      WHERE a.status = 'FAILED'
      ORDER BY a.createdAt DESC LIMIT 25
    `)
    .all() as any[];

  const promotions = db.prepare('SELECT * FROM Promotions ORDER BY createdAt DESC').all() as any[];
  const settings = db.prepare('SELECT * FROM AppSettings').all() as any[];

  // Build monthly chart series from real DB timestamps
  const monthsMap = new Map<
    string,
    { month: string; revenueInr: number; registrations: number; presentations: number; paidSubscribers: number }
  >();

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    monthsMap.set(key, {
      month: key,
      revenueInr: 0,
      registrations: 0,
      presentations: 0,
      paidSubscribers: 0,
    });
  }

  const allUsers = db.prepare('SELECT createdAt FROM Users').all() as any[];
  for (const u of allUsers) {
    const m = String(u.createdAt).slice(0, 7);
    if (monthsMap.has(m)) monthsMap.get(m)!.registrations += 1;
  }

  const allPres = db.prepare('SELECT createdAt FROM Presentations').all() as any[];
  for (const p of allPres) {
    const m = String(p.createdAt).slice(0, 7);
    if (monthsMap.has(m)) monthsMap.get(m)!.presentations += 1;
  }

  const allPaid = db.prepare("SELECT createdAt, amountInr FROM Payments WHERE status = 'PAID'").all() as any[];
  for (const pay of allPaid) {
    const m = String(pay.createdAt).slice(0, 7);
    if (monthsMap.has(m)) {
      monthsMap.get(m)!.revenueInr += Number(pay.amountInr) || 0;
      monthsMap.get(m)!.paidSubscribers += 1;
    }
  }

  res.json({
    metrics: {
      totalUsers,
      activePaidSubs,
      totalPresentations,
      totalSlides,
      totalRevenueInr: paidRevenueRow.total,
      conversionRate: totalUsers > 0 ? Number(((activePaidSubs / totalUsers) * 100).toFixed(1)) : 0,
      aiStats,
    },
    charts: Array.from(monthsMap.values()),
    users,
    payments,
    failedAIRequests,
    promotions,
    settings,
  });
});

app.patch('/api/admin/users/:id', requireAuth, requireAdminOrFounder, (req: AuthenticatedRequest, res) => {
  const target = db.prepare('SELECT * FROM Users WHERE id = ?').get(req.params.id) as any;
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // Strictly protect Founder account integrity
  if (target.email.toLowerCase().trim() === FOUNDER_EMAIL) {
    res.status(403).json({ error: 'Founder privileges are protected and cannot be modified by admin endpoints.' });
    return;
  }

  const { role, planCode } = req.body || {};
  const now = new Date().toISOString();

  if (role && (role === 'USER' || role === 'ADMIN')) {
    // Only Founder can promote/demote ADMIN; nobody else can ever be assigned FOUNDER
    if (role === 'ADMIN' && !req.authUser!.isFounder) {
      res.status(403).json({ error: 'Only the Founder can assign Admin roles.' });
      return;
    }
    db.prepare('UPDATE Users SET role = ?, updatedAt = ? WHERE id = ?').run(role, now, target.id);
  }

  if (planCode && ['FREE', 'STARTER', 'PRO', 'BUSINESS'].includes(planCode)) {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE Subscriptions SET planCode = ?, status = 'ACTIVE', currentPeriodEnd = ?, updatedAt = ? WHERE userId = ?
    `).run(planCode, periodEnd, now, target.id);
  }

  res.json({ ok: true });
});

app.post('/api/admin/promotions', requireAuth, requireAdminOrFounder, (req, res) => {
  const { code, discountPercent, description } = req.body || {};
  const cleanCode = String(code || '').toUpperCase().trim();
  const pct = Math.max(1, Math.min(90, Number(discountPercent) || 10));
  if (!cleanCode) {
    res.status(400).json({ error: 'Promo code is required.' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO Promotions (id, code, discountPercent, description, active, createdAt)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(code) DO UPDATE SET discountPercent = excluded.discountPercent, description = excluded.description, active = 1
  `).run(`promo_${crypto.randomUUID()}`, cleanCode, pct, String(description || `${pct}% promotional discount`), now);

  res.status(201).json({ ok: true });
});

app.patch('/api/admin/promotions/:id', requireAuth, requireAdminOrFounder, (req, res) => {
  const active = req.body?.active ? 1 : 0;
  db.prepare('UPDATE Promotions SET active = ? WHERE id = ?').run(active, req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/templates', requireAuth, requireAdminOrFounder, (req, res) => {
  const { name, category, description, themeId, previewImageUrl, isPremium, slideCount } = req.body || {};
  if (!name || !category) {
    res.status(400).json({ error: 'Template name and category are required.' });
    return;
  }
  const slug = `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
  const id = `tpl_${slug}`;
  db.prepare(`
    INSERT INTO PresentationTemplates (id, slug, name, category, description, themeId, previewImageUrl, isPremium, slideCount, sampleSlidesJson, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    slug,
    String(name).trim(),
    String(category).trim(),
    String(description || '').trim(),
    themeId || 'navy-indigo',
    previewImageUrl || CURATED_VISUALS[0].url,
    isPremium ? 1 : 0,
    Number(slideCount) || 8,
    JSON.stringify([
      {
        layout: 'full-image-title',
        title: String(name).trim(),
        subtitle: String(description || ''),
        imageUrl: previewImageUrl || CURATED_VISUALS[0].url,
        paragraphs: [],
        bullets: [],
      },
    ]),
    new Date().toISOString()
  );
  res.status(201).json({ id });
});

app.delete('/api/admin/templates/:id', requireAuth, requireAdminOrFounder, (req, res) => {
  db.prepare('DELETE FROM PresentationTemplates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.patch('/api/admin/settings', requireAuth, requireAdminOrFounder, (req: AuthenticatedRequest, res) => {
  if (!req.authUser!.isFounder) {
    res.status(403).json({ error: 'Only the Founder can modify sensitive application settings.' });
    return;
  }
  const { key, value } = req.body || {};
  if (!key) {
    res.status(400).json({ error: 'Setting key is required.' });
    return;
  }
  db.prepare(`
    INSERT INTO AppSettings (key, value, updatedAt) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(String(key), String(value), new Date().toISOString());
  res.json({ ok: true });
});

app.get('/api/admin/android-studio-project', requireAuth, requireAdminOrFounder, async (req: AuthenticatedRequest, res) => {
  if (!req.authUser!.isFounder) {
    res.status(403).json({ error: 'Only the Founder can download the Android Studio project bundle.' });
    return;
  }

  try {
    const pkgRow = db
      .prepare("SELECT value FROM AppSettings WHERE key = 'play_store_package_name'")
      .get() as { value: string } | undefined;

    const packageName =
      pkgRow?.value || process.env.ANDROID_PACKAGE_NAME || 'com.slidecraft.ai';
    const rawHost =
      (typeof req.query.host === 'string' && req.query.host.trim()) ||
      process.env.APP_URL ||
      req.headers.host ||
      'ais-pre-wlqshm6emdlmrytnmfqxcj-576423299118.asia-east1.run.app';

    const zipBuffer = await generateAndroidStudioProjectZip({
      packageName,
      hostName: String(rawHost),
      appName: 'SlideCraft AI',
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="SlideCraftAI-AndroidStudio.zip"');
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to package Android Studio project.' });
  }
});

app.post('/api/admin/refund', requireAuth, requireAdminOrFounder, async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    res.status(503).json({ error: 'Razorpay credentials are not configured for refunds.' });
    return;
  }

  const { paymentId } = req.body || {};
  const payRow = db.prepare('SELECT * FROM Payments WHERE id = ?').get(paymentId) as any;
  if (!payRow || payRow.status !== 'PAID' || !payRow.razorpayPaymentId) {
    res.status(400).json({ error: 'Eligible paid Razorpay transaction not found.' });
    return;
  }

  try {
    const authToken = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(payRow.razorpayPaymentId)}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: payRow.amountInr * 100 }),
      }
    );
    const refundData = (await rzpRes.json()) as any;
    if (!rzpRes.ok) {
      res.status(502).json({ error: refundData?.error?.description || 'Razorpay refund failed.' });
      return;
    }
    db.prepare("UPDATE Payments SET status = 'REFUNDED', refundId = ? WHERE id = ?").run(
      refundData.id,
      payRow.id
    );
    res.json({ ok: true, refundId: refundData.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Refund request failed.' });
  }
});

// ---------------- VITE / STATIC SERVING ----------------
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=300');
          } else if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Service-Worker-Allowed', '/');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SlideCraft AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
