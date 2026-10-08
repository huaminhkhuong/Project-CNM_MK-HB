import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import type { AuthTokenPayload } from "../types/auth";
import { ROLES, type Role } from "../constants/roles";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Public route exemptions
  if (req.path.includes("/warranties/lookup/") || req.path.includes("/ai-advisor/")) {
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Unauthorized", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AuthTokenPayload;
    req.user = payload;
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

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AuthTokenPayload;
    req.user = payload;
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

// requirePermission: pass-through middleware — actual access control is done by requireRole.
// This exists to support admin.route.js imports without crashing the server.
export function requirePermission(_permission: Permission | string) {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export { ROLES };
