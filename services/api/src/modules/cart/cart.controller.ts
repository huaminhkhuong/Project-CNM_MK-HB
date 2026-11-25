import { Request, Response } from "express";

import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import {
  addCartItem,
  clearCart,
  deleteCartItem,
  findCartItemByCartAndSku,
  findCartItemById,
  getCartDetailByUserId,
  getOrCreateCartByUserId,
  updateCartItem
} from "./cart.repository";
import { addCartItemSchema, mergeCartSchema, updateCartItemSchema } from "./cart.validator";

function formatCartItem(item: any) {
  const variant = item.ProductSku;
  const product = variant.Product;
  const price = Number(variant.price);
  
  return {
    id: item.id,
    quantity: item.quantity,
    unitPrice: price,
    lineTotal: price * item.quantity,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.Category,
      imageUrl: product.image_url // Fix: added image map
    },
    variant: {
      id: variant.id,
      sku: variant.sku,
      price: price,
      stock: variant.stock,
      imageUrl: variant.image_url
    }
  };
}

function calculateCartTotals(items: any[]) {
  let subtotal = 0;
  let itemCount = 0;

  const formattedItems = items.map(item => {
    const formatted = formatCartItem(item);
    subtotal += formatted.lineTotal;
    itemCount += formatted.quantity;
    return formatted;
  });

  return {
    items: formattedItems,
    subtotal,
    itemCount,
    totalAmount: subtotal, // For frontend compatibility
    totalItems: itemCount   // For frontend compatibility
  };
}

function getAuthUserId(user: any): number {
  const rawId = user?.userId ?? user?.id;
  const parsed = Number(rawId);
  if (!parsed || Number.isNaN(parsed)) {
    throw new AppError("Invalid user identification", 401);
  }
  return parsed;
}

export const getMyCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const userId = getAuthUserId(req.user);
  const cart = await getCartDetailByUserId(userId);
  if (!cart) {
    throw new AppError("Cart not found", 404);
  }

  const totals = calculateCartTotals(cart.CartItem);

  res.status(200).json({
    success: true,
    data: {
      id: cart.id,
      userId: cart.user_id,
      ...totals
    }
  });
});

export const postCartItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const payload = addCartItemSchema.parse(req.body);
  const requestedProductId = payload.productId ? Number(payload.productId) : null;
  const requestedVariantId = Number(payload.productVariantId || payload.variantId || 0);

  let product: any = null;
  let primarySku: any = null;

  if (requestedVariantId > 0) {
    primarySku = await prisma.productSku.findUnique({
      where: { id: requestedVariantId },
      include: {
        Product: {
          include: {
            Category: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    product = primarySku?.Product || null;

    if (!primarySku || !product || !product.is_active) {
      if (requestedProductId) {
        const fallbackProduct = await prisma.product.findUnique({
          where: { id: requestedProductId },
          include: {
            Category: { select: { id: true, name: true } },
            ProductSku: { where: { status: "ACTIVE" }, take: 1 }
          }
        });
        if (fallbackProduct && fallbackProduct.is_active && fallbackProduct.ProductSku[0]) {
          product = fallbackProduct;
          primarySku = fallbackProduct.ProductSku[0];
        }
      }
      if (!primarySku || !product || !product.is_active) {
        throw new AppError("Product variant not found or inactive", 404);
      }
    }

    if (requestedProductId && Number(product.id) !== requestedProductId) {
      const fallbackProduct = await prisma.product.findUnique({
        where: { id: requestedProductId },
        include: {
          Category: { select: { id: true, name: true } },
          ProductSku: { where: { status: "ACTIVE" }, take: 1 }
        }
      });
      if (fallbackProduct && fallbackProduct.is_active && fallbackProduct.ProductSku[0]) {
        product = fallbackProduct;
        primarySku = fallbackProduct.ProductSku[0];
      } else {
        throw new AppError("Product and variant do not match", 400);
      }
    }
  } else {
    if (!requestedProductId) {
      throw new AppError("Product or variant is required", 400);
    }

    product = await prisma.product.findUnique({
      where: { id: requestedProductId },
      include: { ProductSku: { where: { status: "ACTIVE" }, take: 1 } }
    });

    if (!product || !product.is_active) {
      throw new AppError("Product not found or inactive", 404);
    }

    primarySku = product.ProductSku[0];
    if (!primarySku) {
      throw new AppError("Product has no active SKU", 400);
    }
  }

  const availableStock = Number(primarySku.stock || 0);
  if (availableStock < payload.quantity) {
    throw new AppError("Insufficient stock", 400);
  }

  const userId = getAuthUserId(req.user);
  const cart = await getOrCreateCartByUserId(userId);
  const existingItem = await findCartItemByCartAndSku(cart.id, primarySku.id);

  if (existingItem) {
    const nextQty = existingItem.quantity + payload.quantity;
    if (nextQty > availableStock) {
      throw new AppError("Requested quantity exceeds stock", 400);
    }

    await updateCartItem(existingItem.id, nextQty);
  } else {
    await addCartItem({
      cartId: cart.id,
      productVariantId: primarySku.id,
      quantity: payload.quantity
    });
  }

  const updatedCart = await getCartDetailByUserId(userId);
  const totals = calculateCartTotals(updatedCart?.CartItem || []);

  res.status(200).json({
    success: true,
    data: {
      id: cart.id,
      userId: cart.user_id,
      ...totals
    }
  });
});

export const patchCartItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const userId = getAuthUserId(req.user);
  const payload = updateCartItemSchema.parse(req.body);
  const item = await findCartItemById(req.params.itemId);

  // Ownership check with coercion
  if (!item || Number(item.Cart.user_id) !== userId) {
    throw new AppError("Cart item not found", 404);
  }

  // Check stock of the SKU
  const sku = await prisma.productSku.findUnique({ where: { id: item.product_variant_id } });
  if (!sku || Number(sku.stock || 0) < payload.quantity) {
    throw new AppError("Insufficient stock", 400);
  }

  await updateCartItem(item.id, payload.quantity);

  const updatedCart = await getCartDetailByUserId(userId);
  const totals = calculateCartTotals(updatedCart?.CartItem || []);

  res.status(200).json({
    success: true,
    data: {
      id: item.Cart.id,
      userId: item.Cart.user_id,
      ...totals
    }
  });
});

export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const userId = getAuthUserId(req.user);
  const item = await findCartItemById(req.params.itemId);

  // Ownership check with coercion
  if (!item || Number(item.Cart.user_id) !== userId) {
    throw new AppError("Cart item not found", 404);
  }

  await deleteCartItem(item.id);

  const updatedCart = await getCartDetailByUserId(userId);
  const totals = calculateCartTotals(updatedCart?.CartItem || []);

  res.status(200).json({
    success: true,
    data: {
      id: item.Cart.id,
      userId: item.Cart.user_id,
      ...totals
    }
  });
});

export const clearMyCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const userId = getAuthUserId(req.user);
  const cart = await getOrCreateCartByUserId(userId);
  await clearCart(cart.id);

  res.status(200).json({
    success: true,
    data: {
      id: cart.id,
      userId: cart.user_id,
      items: [],
      subtotal: 0,
      itemCount: 0,
      totalAmount: 0,
      totalItems: 0
    }
  });
});

export const mergeMyCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const userId = getAuthUserId(req.user);
  const payload = mergeCartSchema.parse(req.body);
  const cart = await getOrCreateCartByUserId(userId);

  if (Array.isArray(payload.items) && payload.items.length > 0) {
    for (const item of payload.items) {
      const requestedProductId = item.productId ? Number(item.productId) : null;
      const requestedVariantId = Number(item.productVariantId || item.variantId || 0);

      let primarySku: any = null;

      if (requestedVariantId > 0) {
        primarySku = await prisma.productSku.findUnique({
          where: { id: requestedVariantId },
          include: { Product: true }
        });
      }

      if ((!primarySku || !primarySku.Product?.is_active) && requestedProductId) {
        const product = await prisma.product.findUnique({
          where: { id: requestedProductId },
          include: { ProductSku: { where: { status: "ACTIVE" }, take: 1 } }
        });
        if (product && product.is_active && product.ProductSku[0]) {
          primarySku = product.ProductSku[0];
        }
      }

      if (!primarySku || !primarySku.Product?.is_active) {
        continue;
      }

      if (!primarySku) continue;

      const availableStock = Number(primarySku.stock || 0);
      if (availableStock <= 0) continue;

      const existingItem = await findCartItemByCartAndSku(cart.id, primarySku.id);
      if (existingItem) {
        const nextQty = Math.min(existingItem.quantity + item.quantity, availableStock);
        await updateCartItem(existingItem.id, nextQty);
      } else {
        const addQty = Math.min(item.quantity, availableStock);
        await addCartItem({
          cartId: cart.id,
          productVariantId: primarySku.id,
          quantity: addQty
        });
      }
    }
  }

  const updatedCart = await getCartDetailByUserId(userId);
  const totals = calculateCartTotals(updatedCart?.CartItem || []);

  res.status(200).json({
    success: true,
    data: {
      id: cart.id,
      userId: cart.user_id,
      ...totals
    }
  });
});

