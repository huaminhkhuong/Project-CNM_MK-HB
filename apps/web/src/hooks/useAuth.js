import { useCallback, useEffect, useState } from "react";

import { getCurrentProfile, login as loginRequest } from "../services/auth.service";
import { clearAuthState, getAuthState, setAuthState, subscribeAuth } from "../store/authStore";
import { runCustomerOnboarding } from "../utils/customerOnboarding";

function getRedirectPathByRole(role) {
  const normalizedRole = String(role || "").trim().toUpperCase();

  if (normalizedRole === "ADMIN") {
    return "/admin/dashboard";
  }

  if (normalizedRole === "SALES_STAFF") {
    return "/staff/orders";
  }

  if (normalizedRole === "TECH_STAFF" || normalizedRole === "TECHNICIAN") {
    return "/tech/tickets";
  }

  return "/profile";
}

export function useAuth() {
  const [authState, setLocalAuthState] = useState(getAuthState());

  useEffect(() => subscribeAuth(setLocalAuthState), []);

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials);
    const accessToken = response?.data?.accessToken || "";
    const refreshToken = response?.data?.refreshToken || "";
    const user = response?.data?.user || null;

    if (!accessToken || !user) {
      throw new Error("Login response is invalid");
    }

    setAuthState({
      accessToken,
      refreshToken,
      user
    });

    let onboarding = { buildsMigrated: 0 };
    if (String(user.role || "").toUpperCase() === "CUSTOMER") {
      try {
        onboarding = await runCustomerOnboarding();
      } catch (_error) {
        onboarding = { buildsMigrated: 0 };
      }
    }

    return {
      accessToken,
      refreshToken,
      user,
      redirectPath: getRedirectPathByRole(user.role),
      onboarding
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getAuthState()?.accessToken) {
      return null;
    }

    const response = await getCurrentProfile();
    const user = response?.data || response;
    const current = getAuthState();

    setAuthState({
      accessToken: current.accessToken,
      refreshToken: current.refreshToken || "",
      user
    });

    return user;
  }, []);

  const loginAsDemo = useCallback(async () => {
    try {
      return await login({
        email: "customer@pcmall.vn",
        password: "password123"
      });
    } catch (_err) {
      // If default demo credentials don't exist on server, fallback to customer login path
      return {
        redirectPath: "/login"
      };
    }
  }, [login]);

  const logout = useCallback(() => {
    clearAuthState();
  }, []);

  return {
    authState,
    isAuthenticated: Boolean(authState.accessToken),
    login,
    refreshProfile,
    loginAsDemo,
    logout,
    getRedirectPathByRole
  };
}
