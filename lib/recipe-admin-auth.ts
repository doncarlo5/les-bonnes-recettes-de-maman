import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const adminAccessCookieName = "recipe-admin-access";
const cookieVersion = "v1";
const oneYearInSeconds = 60 * 60 * 24 * 365;

type AdminAccessResult =
  | {
      ok: true;
      adminPassword: string;
    }
  | {
      ok: false;
      status: 401 | 500;
      message: string;
    };

export function getRecipeAdminPassword() {
  return process.env.RECIPE_ADMIN_PASSWORD ?? null;
}

export function verifyRecipeAdminPassword(password: string) {
  const expectedPassword = getRecipeAdminPassword();
  if (!expectedPassword) return false;
  return timingSafeStringEqual(password, expectedPassword);
}

export async function hasRecipeAdminAccess() {
  return (await getRecipeAdminAccess()).ok;
}

export async function getRecipeAdminAccess(): Promise<AdminAccessResult> {
  const adminPassword = getRecipeAdminPassword();

  if (!adminPassword) {
    return {
      ok: false,
      status: 500,
      message: "Mot de passe admin non configure.",
    };
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(adminAccessCookieName)?.value;

  if (!cookieValue || !isValidAdminSession(cookieValue, adminPassword)) {
    return {
      ok: false,
      status: 401,
      message: "Acces admin requis.",
    };
  }

  return {
    ok: true,
    adminPassword,
  };
}

export async function grantRecipeAdminAccess() {
  const adminPassword = getRecipeAdminPassword();

  if (!adminPassword) {
    throw new Error("RECIPE_ADMIN_PASSWORD_MISSING");
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: adminAccessCookieName,
    value: createAdminSession(adminPassword),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: oneYearInSeconds,
    secure: process.env.NODE_ENV === "production",
  });
}

export function adminUnauthorizedResponse(access: Exclude<AdminAccessResult, { ok: true }>) {
  return Response.json({ error: access.message }, { status: access.status });
}

function createAdminSession(adminPassword: string) {
  const issuedAt = String(Date.now());
  const payload = `${cookieVersion}.${issuedAt}`;
  return `${payload}.${signAdminSession(payload, adminPassword)}`;
}

function isValidAdminSession(cookieValue: string, adminPassword: string) {
  const [version, issuedAt, signature] = cookieValue.split(".");

  if (version !== cookieVersion || !issuedAt || !signature) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) return false;

  const expiresAtMs = issuedAtMs + oneYearInSeconds * 1000;
  if (expiresAtMs < Date.now()) return false;

  const payload = `${version}.${issuedAt}`;
  return timingSafeStringEqual(signature, signAdminSession(payload, adminPassword));
}

function signAdminSession(payload: string, adminPassword: string) {
  return createHmac("sha256", adminPassword).update(payload).digest("base64url");
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
