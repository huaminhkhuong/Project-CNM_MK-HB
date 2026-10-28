import {
  addItemToCart as serviceAddItem,
  getCart as serviceGetCart,
  removeCartItem as serviceRemoveItem,
  updateCartItem as serviceUpdateItem
} from "../services/cart.service";
import { subscribeAuth } from "./authStore";

let cartState = {
  items: [],
  totalCount: 0,
  totalAmount: 0,
  loading: false
};

const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("cnm_cart_changed", () => {
    refreshCart();
  });
  window.addEventListener("cnm_guest_cart_updated", () => {
    refreshCart();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "cnm_guest_cart_v1" || e.key === "cnm_auth_state") {
      refreshCart();
    }
  });
  subscribeAuth(() => {
    refreshCart();
  });
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(cartState);
    } catch (err) {
      console.warn("[cartStore] Error in listener:", err);
    }
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cnm_cart_updated", {
        detail: { totalCount: cartState.totalCount, items: cartState.items }
      })
    );
  }
}

export function getCartState() {
  return cartState;
}

export function setCartState(nextState) {
  cartState = { ...cartState, ...nextState };
  notify();
}

export function subscribeCart(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshCart() {
  try {
    cartState = { ...cartState, loading: true };
    const res = await serviceGetCart();
    const data = res?.data || res || {};
    const rawItems = data?.items || [];
    const items = Array.isArray(rawItems) ? rawItems : [];

    const totalCount = items.reduce(
      (sum, item) => sum + Math.max(1, Number(item.quantity || 1)),
      0
    );
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price || item.unitPrice || 0) * Math.max(1, Number(item.quantity || 1)),
      0
    );

    cartState = {
      items,
      totalCount,
      totalAmount,
      loading: false
    };
    notify();
    return cartState;
  } catch (err) {
    console.warn("[cartStore] Failed to refresh cart:", err);
    cartState = { ...cartState, loading: false };
    notify();
    return cartState;
  }
}

export async function addCartItem(payload) {
  const res = await serviceAddItem(payload);
  await refreshCart();
  return res;
}

export async function updateCartItemQuantity(itemId, quantity) {
  const res = await serviceUpdateItem(itemId, { quantity });
  await refreshCart();
  return res;
}

export async function removeCartItemById(itemId) {
  const res = await serviceRemoveItem(itemId);
  await refreshCart();
  return res;
}
