import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const COOKIE = "md_account_session";
const DATA_DIR = join(process.cwd(), ".data");
const STORE_PATH = join(DATA_DIR, "store.json");

export type Plan = "free" | "pro" | "teams";

export type Licence = {
  key: string;
  plan: Plan;
  installId: string | null;
  seatLabel: string | null;
  orgId: string | null;
  seatId: string | null;
  networkEnabled: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  interval: "month" | "year" | null;
  status: "active" | "none" | "canceled";
  updatedAt: string;
};

export type User = {
  email: string;
  name: string;
  licence: Licence;
  invoices: { id: string; amount: string; date: string; url?: string }[];
  createdAt: string;
};

type Store = { users: Record<string, User> };

function ensureStore(): Store {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    const empty: Store = { users: {} };
    writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    return { users: {} };
  }
}

function writeStore(store: Store) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function secret() {
  return process.env.MD_ACCOUNT_SECRET || "dev-only-change-me";
}

function sign(email: string) {
  return createHmac("sha256", secret()).update(email.toLowerCase()).digest("hex");
}

export async function getSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [email, sig] = raw.split("|");
  if (!email || !sig) return null;
  const expected = sign(email);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return email.toLowerCase();
}

function cookieSecure() {
  // next start sets NODE_ENV=production; still allow http://127.0.0.1 for local smoke.
  const base = (process.env.MD_ACCOUNT_URL || "").trim();
  if (base.startsWith("https://")) return true;
  if (base.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production" && process.env.MD_COOKIE_SECURE === "1";
}

export async function setSessionEmail(email: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${email.toLowerCase()}|${sign(email)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieSecure(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

function emptyLicence(): Licence {
  return {
    key: "",
    plan: "free",
    installId: null,
    seatLabel: null,
    orgId: null,
    seatId: null,
    networkEnabled: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    interval: null,
    status: "none",
    updatedAt: new Date().toISOString(),
  };
}

function displayName(email: string) {
  const local = email.split("@")[0] || "You";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getOrCreateUser(email: string): User {
  const store = ensureStore();
  const key = email.toLowerCase();
  if (!store.users[key]) {
    store.users[key] = {
      email: key,
      name: displayName(key),
      licence: emptyLicence(),
      invoices: [],
      createdAt: new Date().toISOString(),
    };
    writeStore(store);
  }
  return store.users[key];
}

export function saveUser(user: User) {
  const store = ensureStore();
  store.users[user.email.toLowerCase()] = user;
  writeStore(store);
}

export function mintLicenceKey(plan: Plan = "pro") {
  const body = randomBytes(6).toString("hex").toUpperCase();
  const prefix = plan === "teams" ? "MDS-TEAM" : "MDS";
  return `${prefix}-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 12)}${randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;
}

export function findUserByInstallId(installId: string): User | null {
  const store = ensureStore();
  for (const user of Object.values(store.users)) {
    if (user.licence.installId === installId) return user;
  }
  return null;
}

export function findUserByLicenceKey(key: string): User | null {
  const normalized = key.trim().toUpperCase();
  if (!normalized) return null;
  const store = ensureStore();
  for (const user of Object.values(store.users)) {
    if (user.licence.key.toUpperCase() === normalized) return user;
  }
  return null;
}

export function bindInstallId(
  user: User,
  installId: string,
): { ok: true } | { ok: false; error: string } {
  const id = installId.trim();
  if (!id) return { ok: false, error: "missing installId" };
  if (user.licence.status !== "active") return { ok: false, error: "no active licence" };

  const holder = findUserByInstallId(id);
  if (holder && holder.email !== user.email) {
    return { ok: false, error: "installId already bound to another account" };
  }
  if (user.licence.installId && user.licence.installId !== id) {
    return { ok: false, error: "licence already bound to another machine — unbind first" };
  }

  user.licence.installId = id;
  user.licence.updatedAt = new Date().toISOString();
  saveUser(user);
  return { ok: true };
}

/** Same shape as web/license-sim entitlement JSON for the desktop app. */
export function entitlementForInstall(installId: string) {
  const user = findUserByInstallId(installId);
  if (!user || user.licence.status !== "active") {
    return {
      plan: "community",
      trialEndsAt: null,
      orgId: null,
      seatId: null,
      seatLabel: null,
      networkEnabled: false,
    };
  }
  const plan =
    user.licence.plan === "teams" ? "teams" : user.licence.plan === "pro" ? "pro" : "community";
  return {
    plan,
    trialEndsAt: null,
    orgId: user.licence.orgId,
    seatId: user.licence.seatId,
    seatLabel: user.licence.seatLabel,
    networkEnabled: !!user.licence.networkEnabled && plan === "teams",
  };
}
