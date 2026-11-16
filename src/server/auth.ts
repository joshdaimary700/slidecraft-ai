import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { SUBSCRIPTION_PLANS } from '../shared/types.ts';
import type { AuthUser } from '../shared/types.ts';
import {
  db,
  ensureSubscriptionForUser,
  ensureUsageRecord,
  FOUNDER_EMAIL,
  getCurrentBillingMonth,
  getEffectivePlanCode,
} from './db.ts';

const SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`slidecraft-local-dev-${process.cwd()}`).digest('hex');

export const SESSION_COOKIE_NAME = 'slidecraft_session';

export interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
}

export function signSessionToken(userId: string, email: string): string {
  const payload: SessionPayload = {
    userId,
    email: email.toLowerCase().trim(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || !payload.email || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const part of cookies) {
      const idx = part.indexOf('=');
      if (idx > -1) {
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (k === SESSION_COOKIE_NAME) {
          return decodeURIComponent(v);
        }
      }
    }
  }
  return null;
}

export function buildAuthUser(userId: string): AuthUser | null {
  const user = db.prepare('SELECT * FROM Users WHERE id = ?').get(userId) as any;
  if (!user) return null;

  const profile = db.prepare('SELECT * FROM UserProfiles WHERE userId = ?').get(userId) as any;
  const subscription = ensureSubscriptionForUser(user.id, user.email);
  // Re-fetch user in case Founder role was synced
  const freshUser = db.prepare('SELECT * FROM Users WHERE id = ?').get(userId) as any;
  const isFounder =
    freshUser.email.toLowerCase().trim() === FOUNDER_EMAIL && freshUser.role === 'FOUNDER';

  const effectivePlanCode = getEffectivePlanCode(freshUser, subscription);
  const plan = SUBSCRIPTION_PLANS[effectivePlanCode];
  const billingMonth = getCurrentBillingMonth();
  const usage = ensureUsageRecord(freshUser.id, billingMonth);

  const remaining = isFounder
    ? 'UNLIMITED'
    : Math.max(0, plan.monthlyPresentationsLimit - usage.presentationsGenerated);

  return {
    id: freshUser.id,
    email: freshUser.email,
    name: freshUser.name,
    role: freshUser.role,
    emailVerified: Boolean(freshUser.emailVerified),
    isFounder,
    organization: profile?.organization || '',
    jobTitle: profile?.jobTitle || '',
    preferredLanguage: profile?.preferredLanguage || 'English',
    subscription: {
      planCode: effectivePlanCode,
      billingCycle: isFounder ? 'LIFETIME' : subscription.billingCycle,
      status: subscription.status,
      currentPeriodEnd: isFounder ? null : subscription.currentPeriodEnd,
      cancelAtPeriodEnd: isFounder ? false : Boolean(subscription.cancelAtPeriodEnd),
    },
    usage: {
      billingMonth,
      presentationsGenerated: usage.presentationsGenerated,
      aiEditsCount: usage.aiEditsCount,
      imagesGenerated: usage.imagesGenerated,
      presentationsLimit: plan.monthlyPresentationsLimit,
      maxSlidesPerPresentation: plan.maxSlidesPerPresentation,
      remainingPresentations: remaining,
    },
  };
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

export function attachOptionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractTokenFromReq(req);
  const payload = verifySessionToken(token);
  if (payload) {
    const authUser = buildAuthUser(payload.userId);
    if (authUser) {
      req.authUser = authUser;
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractTokenFromReq(req);
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const authUser = buildAuthUser(payload.userId);
  if (!authUser) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  req.authUser = authUser;
  next();
}

export function requireAdminOrFounder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const isVerifiedFounder =
    req.authUser.isFounder &&
    req.authUser.email.toLowerCase().trim() === FOUNDER_EMAIL &&
    req.authUser.role === 'FOUNDER';

  if (!isVerifiedFounder && req.authUser.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied. Administrator or Founder privileges required.' });
    return;
  }
  next();
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}
