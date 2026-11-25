import { httpClient } from "./http";

export async function logout(payload) {
  const response = await httpClient.post("/auth/logout", payload);
  return response.data;
}

export async function login(payload) {
  const response = await httpClient.post("/auth/login", payload);
  return response.data;
}

export async function refreshAuthToken(payload) {
  const response = await httpClient.post("/auth/refresh", payload);
  return response.data;
}

export async function register(payload) {
  const response = await httpClient.post("/auth/register", payload);
  return response.data;
}

export async function checkEmailAvailability(email) {
  const response = await httpClient.get("/auth/check-email", { params: { email } });
  return response.data;
}

export async function googleLoginMock(payload) {
  const response = await httpClient.post("/auth/google-mock", payload);
  return response.data;
}

export async function getCurrentProfile() {
  const response = await httpClient.get("/auth/me");
  return response.data;
}

export async function updateCurrentProfile(payload) {
  const response = await httpClient.patch("/auth/me", payload);
  return response.data;
}

export async function changePassword(payload) {
  const response = await httpClient.patch("/auth/me/password", payload);
  return response.data;
}

export async function getMyAddresses() {
  const response = await httpClient.get("/auth/me/addresses");
  return response.data;
}

export async function createMyAddress(payload) {
  const response = await httpClient.post("/auth/me/addresses", payload);
  return response.data;
}

export async function updateMyAddress(addressId, payload) {
  const response = await httpClient.patch(`/auth/me/addresses/${addressId}`, payload);
  return response.data;
}

export async function deleteMyAddress(addressId) {
  const response = await httpClient.delete(`/auth/me/addresses/${addressId}`);
  return response.data;
}
