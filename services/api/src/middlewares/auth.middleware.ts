import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../errors/app-error";
import type { AuthTokenPayload } from "../types/auth";
import { ROLES, type Role } from "../constants/roles";
import { isTokenBlacklisted } from "../services/token-blacklist.service";

interface CachedUserAuthState {
  status: string;
  roleName: string | null;
  email: string | null;
  expiresAt: number;
}

const USER_AUTH_CACHE_TTL_MS = 2000;
// Share cache across CJS (.js) and ESM (.ts) module instances via globalThis
const globalScope = globalThis as typeof globalThis & {
  __pcmallUserAuthCache?: Map<number, CachedUserAuthState>;
};
const userAuthCache: Map<number, CachedUserAuthState> =
  globalScope.__pcmallUserAuthCache ?? (globalScope.__pcmallUserAuthCache = new Map<number, CachedUserAuthState>());

export function invalidateUserAuthCache(userId: number | string) {
  const numId = Number(userId);
  if (Number.isInteger(numId) && numId > 0) {
    userAuthCache.delete(numId);
  }
}

export async function getLiveUserAuthState(userId: number): Promise<CachedUserAuthState | null> {
  const now = Date.now();
  const cached = userAuthCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        email: true,
        Role: { select: { name: true } }
      }
    });
    if (!user) return null;

    const entry: CachedUserAuthState = {
      status: String(user.status || "ACTIVE").toUpperCase(),
      roleName: user.Role?.name || null,
      email: user.email || null,
      expiresAt: now + USER_AUTH_CACHE_TTL_MS
    };
    userAuthCache.set(userId, entry);
    return entry;
  } catch {
    return null;
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Unauthorized", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AuthTokenPayload;
    const revoked = await isTokenBlacklisted(token);
    if (revoked) {
      return next(new AppError("Token has been revoked", 401));
    }

    const numericUserId = Number(payload.userId);
    let effectiveRole = payload.role;
    if (Number.isInteger(numericUserId) && numericUserId > 0) {
      const liveUser = await getLiveUserAuthState(numericUserId);
      if (liveUser) {
        if (liveUser.status !== "ACTIVE") {
          return next(new AppError("Tài khoản đã bị khóa hoặc tạm ngừng hoạt động", 403));
        }
        // Sync live role when JWT belongs to this exact DB user (immediate role-demotion enforcement)
        if (
          liveUser.roleName &&
          (!payload.email || !liveUser.email || payload.email.toLowerCase() === liveUser.email.toLowerCase())
        ) {
          effectiveRole = liveUser.roleName as Role;
        }
      }
    }

    req.user = {
      ...payload,
      role: effectiveRole,
      userId: numericUserId || payload.userId,
      id: numericUserId || payload.userId
    } as any;
    return next();
  } catch (_error) {
    return next(new AppError("Invalid or expired token", 401));
  }
}

const ROLE_ALIASES: Record<string, Role> = {
  TECHNICIAN: ROLES.TECH_STAFF,
  TECH_STAFF: ROLES.TECH_STAFF,
  SALES: ROLES.SALES_STAFF,
  SALES_STAFF: ROLES.SALES_STAFF
};

function normalizeAuthRole(role?: string): Role | string {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();
  return ROLE_ALIASES[normalized] || normalized;
}

function isRoleAllowed(userRole: string | undefined, allowedRoles: Role[]) {
  const normalizedUserRole = normalizeAuthRole(userRole);
  return allowedRoles.some((allowed) => normalizeAuthRole(allowed) === normalizedUserRole);
}

export function authorize(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!isRoleAllowed(req.user.role, allowedRoles)) {
      return next(new AppError("Forbidden", 403));
    }

    return next();
  };
}

export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AuthTokenPayload;
    const revoked = await isTokenBlacklisted(token).catch(() => false);
    if (revoked) {
      return next();
    }
    const numericUserId = Number(payload.userId);
    let effectiveRole = payload.role;
    if (Number.isInteger(numericUserId) && numericUserId > 0) {
      const liveUser = await getLiveUserAuthState(numericUserId);
      if (liveUser) {
        if (liveUser.status !== "ACTIVE") {
          return next();
        }
        if (
          liveUser.roleName &&
          (!payload.email || !liveUser.email || payload.email.toLowerCase() === liveUser.email.toLowerCase())
        ) {
          effectiveRole = liveUser.roleName as Role;
        }
      }
    }
    req.user = {
      ...payload,
      role: effectiveRole,
      userId: numericUserId || payload.userId,
      id: numericUserId || payload.userId
    } as any;
  } catch (_error) {
    // Non-blocking: continue as guest if token is invalid or expired
  }
  return next();
}

export const verifyToken = authenticate;
export const requireAuth = authenticate;
export const optionalAuth = optionalAuthenticate;

export function requireRole(...allowedRoles: Role[]) {
  return authorize(allowedRoles);
}

// PERMISSIONS constant — used by admin.route.js for fine-grained route labeling.
// Role-level enforcement is already handled by requireRole(ROLES.ADMIN).
// requirePermission acts as a pass-through after role check succeeds.
export const PERMISSIONS = {
  ADMIN_DASHBOARD: "admin:dashboard",
  MANAGE_PRODUCTS: "admin:products",
  MANAGE_USERS: "admin:users",
  MANAGE_ORDERS: "admin:orders",
  MANAGE_COMPATIBILITY_RULES: "admin:compatibility-rules",
  MANAGE_SYSTEM_SETTINGS: "admin:system-settings",
  VIEW_REPORTS: "admin:reports",
  MANAGE_TICKETS: "staff:tickets",
  MANAGE_WARRANTIES: "tech:warranties"
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// requirePermission: enforces granular permissions mapped to authenticated roles
export function requirePermission(permission: Permission | string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }
    const userRole = normalizeAuthRole(req.user.role);
    if (userRole === ROLES.ADMIN) {
      return next();
    }
    const permStr = String(permission);
    if (permStr.startsWith("staff:") && userRole === ROLES.SALES_STAFF) {
      return next();
    }
    if (permStr.startsWith("tech:") && userRole === ROLES.TECH_STAFF) {
      return next();
    }
    return next(new AppError(`Forbidden: missing required permission ${permStr}`, 403));
  };
}

export { ROLES };
