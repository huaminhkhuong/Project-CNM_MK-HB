import { httpClient } from "./http";
import { getAuthState } from "../store/authStore";
import {
  addGuestCartItem,
  clearGuestCart,
  getGuestCart,
  removeGuestCartItem,
  updateGuestCartItemQuantity
} from "../utils/guestStorage";

export async function getCart() {
  if (getAuthState()?.accessToken) {
    const response = await httpClient.get("/cart");
    return response.data;
  }
  return { success: true, data: getGuestCart() };
}

function dispatchCartChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cnm_cart_changed"));
  }
}

export async function updateCartItem(itemId, payload) {
  let result;
  if (getAuthState()?.accessToken) {
    const response = await httpClient.patch(`/cart/items/${itemId}`, payload);
    result = response.data;
  } else {
    const updated = updateGuestCartItemQuantity(itemId, payload?.quantity);
    result = { success: true, data: updated };
  }
  dispatchCartChanged();
  return result;
}

export async function addItemToCart(payload) {
  let result;
  if (getAuthState()?.accessToken) {
    const response = await httpClient.post("/cart/items", payload);
    result = response.data;
  } else {
    const updated = addGuestCartItem(payload);
    result = { success: true, data: updated };
  }
  dispatchCartChanged();
  return result;
}

export async function removeCartItem(itemId) {
  let result;
  if (getAuthState()?.accessToken) {
    const response = await httpClient.delete(`/cart/items/${itemId}`);
    result = response.data;
  } else {
    const updated = removeGuestCartItem(itemId);
    result = { success: true, data: updated };
  }
  dispatchCartChanged();
  return result;
}

export async function mergeCart(items) {
  const response = await httpClient.post("/cart/merge", { items });
  return response.data;
}

export async function migrateGuestCartToAccount() {
  const guestCart = getGuestCart();
  if (!guestCart?.items || guestCart.items.length === 0) {
    return { merged: 0 };
  }

  const items = guestCart.items.map((item) => ({
    productId: item.productId ? Number(item.productId) : undefined,
    productVariantId: item.productVariantId ? Number(item.productVariantId) : undefined,
    quantity: Math.max(1, Number(item.quantity || 1))
  }));

  try {
    const response = await mergeCart(items);
    clearGuestCart();
    return { merged: items.length, data: response?.data || response };
  } catch (error) {
    console.warn("[migrateGuestCartToAccount] Error merging guest cart:", error);
    return { merged: 0, error };
  }
}
