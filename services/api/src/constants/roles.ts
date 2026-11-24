export const ROLES = {
  CUSTOMER: "CUSTOMER",
  SALES: "SALES_STAFF",
  SALES_STAFF: "SALES_STAFF",
  TECHNICIAN: "TECH_STAFF",
  TECH_STAFF: "TECH_STAFF",
  ADMIN: "ADMIN"
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_ALIASES: Record<string, Role> = {
  ADMIN: ROLES.ADMIN,
  CUSTOMER: ROLES.CUSTOMER,
  SALES: ROLES.SALES_STAFF,
  SALES_STAFF: ROLES.SALES_STAFF,
  TECHNICIAN: ROLES.TECH_STAFF,
  TECH_STAFF: ROLES.TECH_STAFF
};

export function normalizeRole(value?: string): Role | string {
  const normalized = String(value || "").trim().toUpperCase();
  return ROLE_ALIASES[normalized] || normalized;
}

export function expandRole(role?: string): string[] {
  const normalized = normalizeRole(role);
  if (normalized === ROLES.SALES_STAFF) {
    return [ROLES.SALES_STAFF, "SALES"];
  }
  if (normalized === ROLES.TECH_STAFF) {
    return [ROLES.TECH_STAFF, "TECHNICIAN"];
  }
  return [normalized];
}

export function roleMatches(userRole?: string, allowedRole?: string): boolean {
  const normalizedUserRole = normalizeRole(userRole);
  return expandRole(allowedRole).includes(normalizedUserRole);
}

export function hasAnyRole(userRole?: string, allowedRoles: (Role | string)[] = []): boolean {
  return allowedRoles.some((allowedRole) => roleMatches(userRole, String(allowedRole)));
}
