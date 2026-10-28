import { prisma } from "../../config/prisma";

export async function getOrCreateCartByUserId(userId: string | number) {
  const finalUserId = typeof userId === "string" ? parseInt(userId, 10) : Number(userId);
  if (!finalUserId || Number.isNaN(finalUserId)) {
    throw new Error("Invalid userId provided to getOrCreateCartByUserId");
  }
  let cart = await prisma.cart.findFirst({ where: { user_id: finalUserId } });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { user_id: finalUserId }
    });
  }

  return cart;
}

export async function getCartDetailByUserId(userId: string | number) {
  const cart = await getOrCreateCartByUserId(userId);

  return prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      CartItem: {
        include: {
          ProductSku: {
            include: {
              Product: {
                include: {
                  Category: {
                    select: { id: true, name: true }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          created_at: "desc"
        }
      }
    }
  });
}

export function findCartItemById(id: string | number) {
  const finalId = typeof id === "string" ? parseInt(id, 10) : Number(id);
  return prisma.cartItem.findUnique({
    where: { id: finalId },
    include: { Cart: true }
  });
}

export function findCartItemByCartAndSku(cartId: string | number, productVariantId: string | number) {
  return prisma.cartItem.findFirst({
    where: {
      cart_id: typeof cartId === "string" ? parseInt(cartId, 10) : Number(cartId),
      product_variant_id: typeof productVariantId === "string" ? parseInt(productVariantId, 10) : Number(productVariantId)
    }
  });
}

export function addCartItem(data: { cartId: string | number; productVariantId: string | number; quantity: number }) {
  return prisma.cartItem.create({
    data: {
      cart_id: typeof data.cartId === "string" ? parseInt(data.cartId, 10) : Number(data.cartId),
      product_variant_id: typeof data.productVariantId === "string" ? parseInt(data.productVariantId, 10) : Number(data.productVariantId),
      quantity: data.quantity
    }
  });
}

export function updateCartItem(id: string | number, quantity: number) {
  const finalId = typeof id === "string" ? parseInt(id, 10) : Number(id);
  return prisma.cartItem.update({
    where: { id: finalId },
    data: { quantity }
  });
}

export function deleteCartItem(id: string | number) {
  const finalId = typeof id === "string" ? parseInt(id, 10) : Number(id);
  return prisma.cartItem.delete({
    where: { id: finalId }
  });
}

export function clearCart(cartId: string | number) {
  const finalCartId = typeof cartId === "string" ? parseInt(cartId, 10) : Number(cartId);
  return prisma.cartItem.deleteMany({
    where: { cart_id: finalCartId }
  });
}
