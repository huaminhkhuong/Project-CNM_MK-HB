const { prisma } = require("../../config/prisma");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");

async function getCurrentCart(userId) {
  const cleanUserId = toPositiveInteger(userId, "userId");
  let cart = await prisma.cart.findFirst({
    where: { user_id: cleanUserId }
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { user_id: cleanUserId }
    });
  }

  const items = await prisma.cartItem.findMany({
    where: { cart_id: cart.id },
    include: {
      ProductSku: {
        include: {
          Product: true
        }
      }
    },
    orderBy: { id: "desc" }
  });

  const formattedItems = items
    .filter((it) => it.ProductSku && it.ProductSku.Product && it.ProductSku.Product.is_active)
    .map((it) => {
      const price = Number(it.ProductSku.price || 0);
      const qty = Number(it.quantity || 0);
      return {
        id: it.id,
        quantity: qty,
        unitPrice: price,
        lineTotal: price * qty,
        product: {
          id: it.ProductSku.Product.id,
          name: it.ProductSku.Product.name,
          slug: it.ProductSku.Product.slug
        },
        variant: {
          id: it.ProductSku.id,
          sku: it.ProductSku.sku,
          price: price,
          stock: Number(it.ProductSku.stock || 0),
          imageUrl: it.ProductSku.image_url
        }
      };
    });

  const totalAmount = formattedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalItems = formattedItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cart.id,
    userId: cart.user_id,
    totalItems,
    totalAmount,
    items: formattedItems
  };
}

async function addItem(userId, payload) {
  const cleanUserId = toPositiveInteger(userId, "userId");
  const variantId = toPositiveInteger(payload.productVariantId, "productVariantId");
  const quantity = toPositiveInteger(payload.quantity || 1, "quantity");

  const variant = await prisma.productSku.findUnique({
    where: { id: variantId },
    include: { Product: true }
  });

  if (!variant || !variant.Product || !variant.Product.is_active) {
    throw createError("Product variant not found", 404);
  }

  if (Number(variant.stock || 0) < quantity) {
    throw createError("Not enough stock for this product variant", 400);
  }

  return prisma.$transaction(async (tx) => {
    let cart = await tx.cart.findFirst({
      where: { user_id: cleanUserId }
    });
    if (!cart) {
      cart = await tx.cart.create({
        data: { user_id: cleanUserId }
      });
    }

    const existingItem = await tx.cartItem.findFirst({
      where: {
        cart_id: cart.id,
        product_variant_id: variantId
      }
    });

    if (existingItem) {
      const newQuantity = Number(existingItem.quantity) + quantity;
      if (Number(variant.stock || 0) < newQuantity) {
        throw createError("Not enough stock for this product variant", 400);
      }
      await tx.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity }
      });
    } else {
      await tx.cartItem.create({
        data: {
          cart_id: cart.id,
          product_variant_id: variantId,
          quantity: quantity
        }
      });
    }

    return getCurrentCart(userId);
  });
}

async function updateItemQuantity(userId, itemId, payload) {
  const cleanUserId = toPositiveInteger(userId, "userId");
  const parsedItemId = toPositiveInteger(itemId, "itemId");
  const quantity = toPositiveInteger(payload.quantity, "quantity");

  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { user_id: cleanUserId }
    });
    if (!cart) {
      throw createError("Cart item not found", 404);
    }

    const existingItem = await tx.cartItem.findFirst({
      where: {
        id: parsedItemId,
        cart_id: cart.id
      },
      include: {
        ProductSku: true
      }
    });

    if (!existingItem) {
      throw createError("Cart item not found", 404);
    }

    const variant = existingItem.ProductSku;
    if (!variant) {
      throw createError("Product variant not found", 404);
    }

    if (Number(variant.stock || 0) < quantity) {
      throw createError("Not enough stock for this product variant", 400);
    }

    await tx.cartItem.update({
      where: { id: parsedItemId },
      data: { quantity }
    });

    return getCurrentCart(userId);
  });
}

async function removeItem(userId, itemId) {
  const cleanUserId = toPositiveInteger(userId, "userId");
  const parsedItemId = toPositiveInteger(itemId, "itemId");

  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: { user_id: cleanUserId }
    });
    if (!cart) {
      throw createError("Cart item not found", 404);
    }

    const existingItem = await tx.cartItem.findFirst({
      where: {
        id: parsedItemId,
        cart_id: cart.id
      }
    });

    if (!existingItem) {
      throw createError("Cart item not found", 404);
    }

    await tx.cartItem.delete({
      where: { id: parsedItemId }
    });

    return getCurrentCart(userId);
  });
}

module.exports = {
  getCurrentCart,
  addItem,
  updateItemQuantity,
  removeItem
};
