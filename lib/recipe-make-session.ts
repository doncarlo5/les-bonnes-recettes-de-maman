import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const sessionCookieName = "recipe-make-participant-v1";
const sessionVersion = "v1";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;

type RecipeMakeSession = {
  digest: string;
};

type RecipeMakeSessionIssue = {
  digest: string;
  issuedAt: number;
};

const oneDayInMs = 24 * 60 * 60 * 1000;

export async function ensureRecipeMakeSession() {
  const store = await cookies();
  const rawSession = store.get(sessionCookieName)?.value;
  const existing = parseSession(rawSession);

  if (existing) {
    const refresh = createSession(existing.digest);
    store.set(buildSessionCookie(refresh));
    return existing.digest;
  }

  const fresh = createSession(generateDigest());
  store.set(buildSessionCookie(fresh));
  return fresh.digest;
}

export async function readRecipeMakeSessionDigest(): Promise<RecipeMakeSession | null> {
  const store = await cookies();
  const rawSession = store.get(sessionCookieName)?.value;
  const existing = parseSession(rawSession);
  return existing ? { digest: existing.digest } : null;
}

export function computeIpDigest(ip: string | null): string {
  const secret = getSessionSecret();
  return createHash(secret, ip ?? "unknown");
}

function createSession(digest: string) {
  const issuedAt = Date.now();
  const payload = `${sessionVersion}.${issuedAt}.${digest}`;
  return {
    digest,
    issuedAt,
    signature: signSession(payload),
  };
}

function generateDigest() {
  return randomBytes(24).toString("hex");
}

function buildSessionCookie(session: {
  digest: string;
  issuedAt: number;
  signature: string;
}) {
  const value = `${sessionVersion}.${session.issuedAt}.${session.digest}.${session.signature}`;

  return {
    name: sessionCookieName,
    value,
    maxAge: Math.round(sessionDurationMs / 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

function parseSession(rawValue: string | undefined) {
  if (!rawValue) return null;
  const [version, issuedAtText, digest, signature] = rawValue.split(".");
  if (version !== sessionVersion || !issuedAtText || !digest || !signature) return null;

  const issuedAt = Number(issuedAtText);
  if (!Number.isFinite(issuedAt)) return null;
  const now = Date.now();
  if (issuedAt + sessionDurationMs < now) return null;

  const payload = `${version}.${issuedAtText}.${digest}`;
  const expectedSignature = signSession(payload);
  if (!timingSafeStringEqual(signature, expectedSignature)) return null;

  return { digest, issuedAt, version };
}

function getSessionSecret() {
  const secret = process.env.RECIPE_MAKE_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "development-only-recipe-make-session-secret";
  throw new Error("RECIPE_MAKE_SESSION_SECRET_MISSING");
}

function signSession(payload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function createHash(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getCallerIpDigest(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const remote = forwardedFor?.split(",")[0]?.trim();
  const candidateIp = remote || request.headers.get("x-real-ip");
  const fallbackIp = request.headers.get("cf-connecting-ip");
  const selectedIp = (candidateIp || fallbackIp || "0.0.0.0").trim();
  if (!selectedIp) return undefined;

  const secret = process.env.RECIPE_MAKE_IP_HMAC_SECRET
    || (process.env.NODE_ENV !== "production" ? "development-only-recipe-make-ip-secret" : null);
  if (!secret) throw new Error("RECIPE_MAKE_IP_HMAC_SECRET_MISSING");
  return createHash(secret, selectedIp);
}

export function getSessionDurationMs() {
  return sessionDurationMs;
}

export function getRecipeMakeSessionRetentionMessage() {
  return {
    durationHours: Math.round(sessionDurationMs / (60 * 60 * 1000)),
    oneDayInMs,
  };
}
