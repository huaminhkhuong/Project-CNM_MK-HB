import { useCallback, useEffect, useState } from "react";
import {
  addCartItem,
  getCartState,
  refreshCart,
  removeCartItemById,
  subscribeCart,
  updateCartItemQuantity
} from "../store/cartStore";

export function useCart() {
  const [state, setState] = useState(getCartState());

  useEffect(() => {
    const unsubscribe = subscribeCart(setState);
    // Initial fetch if empty
    if (!state.items.length && !state.loading) {
      refreshCart();
    }
    return unsubscribe;
  }, []);

  const addItem = useCallback(async (payload) => {
    return await addCartItem(payload);
  }, []);

  const updateQuantity = useCallback(async (itemId, qty) => {
    return await updateCartItemQuantity(itemId, qty);
  }, []);

  const removeItem = useCallback(async (itemId) => {
    return await removeCartItemById(itemId);
  }, []);

  const reloadCart = useCallback(async () => {
    return await refreshCart();
  }, []);

  return {
    items: state.items,
    totalCount: state.totalCount,
    totalAmount: state.totalAmount,
    loading: state.loading,
    addItem,
    updateQuantity,
    removeItem,
    reloadCart
  };
}
