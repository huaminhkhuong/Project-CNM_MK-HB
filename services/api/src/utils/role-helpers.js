const ROLES = {
  ADMIN: "ADMIN",
  SALES_STAFF: "SALES_STAFF",
  TECH_STAFF: "TECH_STAFF",
  CUSTOMER: "CUSTOMER"
};

const ROLE_ALIASES = {
  ADMIN: ROLES.ADMIN,
  CUSTOMER: ROLES.CUSTOMER,
  SALES: ROLES.SALES_STAFF,
  SALES_STAFF: ROLES.SALES_STAFF,
  TECHNICIAN: ROLES.TECH_STAFF,
  TECH_STAFF: ROLES.TECH_STAFF
};

function normalizeRole(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ROLE_ALIASES[normalized] || normalized;
}

function expandRole(role) {
  const normalized = normalizeRole(role);

  if (normalized === ROLES.SALES_STAFF) {
    return [ROLES.SALES_STAFF, "SALES"];
  }

  if (normalized === ROLES.TECH_STAFF) {
    return [ROLES.TECH_STAFF, "TECHNICIAN"];
  }

  return [normalized];
}

function roleMatches(userRole, allowedRole) {
  const normalizedUserRole = normalizeRole(userRole);
  return expandRole(allowedRole).includes(normalizedUserRole);
}

function hasAnyRole(userRole, allowedRoles = []) {
  return allowedRoles.some((allowedRole) => roleMatches(userRole, allowedRole));
}

module.exports = {
  ROLES,
  normalizeRole,
  expandRole,
  roleMatches,
  hasAnyRole
};
