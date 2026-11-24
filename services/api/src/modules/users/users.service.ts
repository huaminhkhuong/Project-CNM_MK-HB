export interface UserProfile {
  id: number | string;
  roleId?: number | string;
  role?: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
  status?: string;
}

export function getProfile(user: any): UserProfile {
  return {
    id: user.id,
    roleId: user.roleId,
    role: user.role,
    fullName: user.fullName || user.full_name,
    email: user.email,
    phone: user.phone,
    status: user.status
  };
}

export default {
  getProfile
};
